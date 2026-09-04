/**
 * Echoes of Aurion - Delta Snapshot Manager
 * 
 * Manages the background Web Worker lifecycle and orchestrates 60-second periodic delta-snapshots:
 * - Decouples state diffing and network transmissions from the primary Three.js render thread
 * - Computes delta payloads sent to MariaDB instance via /api/world/delta-snapshot
 * - Preserves game state across server reboots, spikes, and connection drops
 * - Exposes real-time engine metrics for HUD display
 */

export interface DeltaWorkerMetrics {
  lastSnapshotTimestamp: number;
  totalSnapshots: number;
  status: 'idle' | 'syncing' | 'saved' | 'error';
  lastPayloadBytes: number;
  nextSnapshotInSec: number;
}

export type SnapshotStateProvider = () => {
  player: any;
  world: any;
  activeChunkKeys?: string[];
};

export class DeltaSnapshotManager {
  private worker: Worker | null = null;
  private stateProvider: SnapshotStateProvider | null = null;
  private intervalSec: number = 60;
  private secondsUntilNext: number = 60;
  private countdownTimer: any = null;

  private metrics: DeltaWorkerMetrics = {
    lastSnapshotTimestamp: 0,
    totalSnapshots: 0,
    status: 'idle',
    lastPayloadBytes: 0,
    nextSnapshotInSec: 60,
  };

  constructor(stateProvider?: SnapshotStateProvider, intervalSec: number = 60) {
    this.stateProvider = stateProvider || null;
    this.intervalSec = intervalSec;
    this.secondsUntilNext = intervalSec;
  }

  public setStateProvider(provider: SnapshotStateProvider): void {
    this.stateProvider = provider;
  }

  public initialize(): void {
    if (typeof window === 'undefined') return;

    try {
      // Modern Vite module worker instantiation
      this.worker = new Worker(
        new URL('../../workers/DeltaSnapshotWorker.ts', import.meta.url),
        { type: 'module' }
      );
      this.attachWorkerListeners();
    } catch (err: any) {
      console.warn('[DeltaSnapshotManager] Module worker creation failed, spawning Blob fallback:', err.message);
      this.initializeFallbackWorker();
    }

    // Start 1-second countdown ticker for UI metrics
    this.countdownTimer = setInterval(() => {
      if (this.secondsUntilNext > 0) {
        this.secondsUntilNext--;
      } else {
        this.secondsUntilNext = this.intervalSec;
      }
      this.metrics.nextSnapshotInSec = this.secondsUntilNext;
    }, 1000);

    // Tell worker to start 60s periodic snapshots
    this.worker?.postMessage({
      type: 'START_WORKER',
      data: { intervalMs: this.intervalSec * 1000 },
    });
  }

  private attachWorkerListeners(): void {
    if (!this.worker) return;

    this.worker.onmessage = (e: MessageEvent) => {
      const { type, totalSnapshots, payloadBytes, timestamp } = e.data || {};

      switch (type) {
        case 'REQUEST_SNAPSHOT_DATA':
          this.handleSnapshotRequest();
          break;

        case 'SNAPSHOT_COMPLETED':
          this.metrics.status = 'saved';
          this.metrics.lastSnapshotTimestamp = timestamp || Date.now();
          this.metrics.totalSnapshots = totalSnapshots || this.metrics.totalSnapshots + 1;
          this.metrics.lastPayloadBytes = payloadBytes || 0;
          this.secondsUntilNext = this.intervalSec;
          break;

        case 'SNAPSHOT_FAILED_RETRYING':
          this.metrics.status = 'error';
          break;

        case 'WORKER_INITIALIZED':
          this.metrics.status = 'idle';
          break;
      }
    };

    this.worker.onerror = (err) => {
      console.error('[DeltaSnapshotManager] Worker error:', err);
      this.metrics.status = 'error';
    };
  }

  private initializeFallbackWorker(): void {
    // In-memory fallback if Web Workers are restricted by browser policy
    const fallbackScript = `
      let timer = null;
      self.onmessage = function(e) {
        if (e.data.type === 'START_WORKER') {
          if (timer) clearInterval(timer);
          timer = setInterval(function() {
            self.postMessage({ type: 'REQUEST_SNAPSHOT_DATA' });
          }, e.data.data?.intervalMs || 60000);
        }
        if (e.data.type === 'SUBMIT_SNAPSHOT_DATA') {
          fetch('/api/world/delta-snapshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sequenceId: 1,
              timestamp: Date.now(),
              worldState: e.data.data.world,
              playerDeltas: [e.data.data.player],
              chunkKeys: e.data.data.activeChunkKeys || []
            })
          }).then(function(r) { return r.json(); })
            .then(function() {
              self.postMessage({ type: 'SNAPSHOT_COMPLETED', timestamp: Date.now(), totalSnapshots: 1, payloadBytes: 512 });
            }).catch(function() {
              self.postMessage({ type: 'SNAPSHOT_FAILED_RETRYING' });
            });
        }
      };
    `;

    try {
      const blob = new Blob([fallbackScript], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob));
      this.attachWorkerListeners();
    } catch (e) {
      console.error('[DeltaSnapshotManager] Inline fallback worker failed:', e);
    }
  }

  private handleSnapshotRequest(): void {
    if (!this.stateProvider) return;

    this.metrics.status = 'syncing';
    try {
      const snapshotData = this.stateProvider();
      this.worker?.postMessage({
        type: 'SUBMIT_SNAPSHOT_DATA',
        data: snapshotData,
      });
    } catch (err: any) {
      console.error('[DeltaSnapshotManager] Failed to gather snapshot state:', err);
      this.metrics.status = 'error';
    }
  }

  /**
   * Forces an immediate asynchronous delta snapshot without waiting for the 60s timer.
   */
  public triggerImmediateSnapshot(): void {
    this.metrics.status = 'syncing';
    this.worker?.postMessage({ type: 'FORCE_SNAPSHOT_NOW' });
    this.secondsUntilNext = this.intervalSec;
  }

  public getMetrics(): DeltaWorkerMetrics {
    return { ...this.metrics };
  }

  public destroy(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.worker) {
      this.worker.postMessage({ type: 'STOP_WORKER' });
      this.worker.terminate();
      this.worker = null;
    }
  }
}
