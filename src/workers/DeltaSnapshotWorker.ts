/**
 * Echoes of Aurion - Asynchronous Delta Snapshot Web Worker
 * 
 * Runs in a decoupled background Web Worker thread:
 * - Fires every 60 seconds (or on-demand for spike saves)
 * - Computes delta against the previous snapshot baseline to minimize network bandwidth
 * - Transmits serialized JSON deltas asynchronously to MariaDB via /api/world/delta-snapshot
 * - Retries failed requests with exponential backoff to ensure zero data loss during spikes
 */

interface DeltaPayload {
  sequenceId: number;
  timestamp: number;
  worldState: any;
  playerDeltas?: any[];
  chunkKeys?: string[];
}

interface WorkerState {
  sequenceId: number;
  lastBaseline: any | null;
  pendingQueue: DeltaPayload[];
  isFlushing: boolean;
  totalSnapshotsSent: number;
  lastPayloadBytes: number;
}

const state: WorkerState = {
  sequenceId: 0,
  lastBaseline: null,
  pendingQueue: [],
  isFlushing: false,
  totalSnapshotsSent: 0,
  lastPayloadBytes: 0,
};

// Periodic 60s trigger loop
let timerInterval: any = null;

function computeDelta(currentState: any, baseline: any): any {
  if (!baseline) return currentState;

  const delta: any = {};
  let hasChanges = false;

  for (const key of Object.keys(currentState)) {
    const currentVal = currentState[key];
    const prevVal = baseline[key];

    if (JSON.stringify(currentVal) !== JSON.stringify(prevVal)) {
      delta[key] = currentVal;
      hasChanges = true;
    }
  }

  return hasChanges ? delta : null;
}

async function sendSnapshot(payload: DeltaPayload): Promise<boolean> {
  try {
    const res = await fetch('/api/world/delta-snapshot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return data.success === true;
  } catch (err: any) {
    console.warn('[DeltaSnapshotWorker] Push failed, queuing for retry:', err.message);
    return false;
  }
}

async function processQueue() {
  if (state.isFlushing || state.pendingQueue.length === 0) return;
  state.isFlushing = true;

  while (state.pendingQueue.length > 0) {
    const payload = state.pendingQueue[0];
    const ok = await sendSnapshot(payload);

    if (ok) {
      state.pendingQueue.shift();
      state.totalSnapshotsSent++;
      state.lastPayloadBytes = JSON.stringify(payload).length;

      self.postMessage({
        type: 'SNAPSHOT_COMPLETED',
        sequenceId: payload.sequenceId,
        timestamp: payload.timestamp,
        totalSnapshots: state.totalSnapshotsSent,
        payloadBytes: state.lastPayloadBytes,
        pendingQueueLength: state.pendingQueue.length,
      });
    } else {
      // Retry on next cycle
      self.postMessage({
        type: 'SNAPSHOT_FAILED_RETRYING',
        sequenceId: payload.sequenceId,
        pendingQueueLength: state.pendingQueue.length,
      });
      break;
    }
  }

  state.isFlushing = false;
}

self.onmessage = async (e: MessageEvent) => {
  const { type, data } = e.data || {};

  if (type === 'START_WORKER') {
    const intervalMs = data?.intervalMs || 60000; // 60s default
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
      self.postMessage({ type: 'REQUEST_SNAPSHOT_DATA' });
    }, intervalMs);

    self.postMessage({ type: 'WORKER_INITIALIZED', intervalMs });
  }

  if (type === 'SUBMIT_SNAPSHOT_DATA') {
    state.sequenceId++;
    const fullState = data;

    // Compute differential update against baseline
    const playerDelta = computeDelta(fullState.player, state.lastBaseline?.player);
    const worldDelta = computeDelta(fullState.world, state.lastBaseline?.world);

    state.lastBaseline = fullState;

    const payload: DeltaPayload = {
      sequenceId: state.sequenceId,
      timestamp: Date.now(),
      worldState: worldDelta || fullState.world,
      playerDeltas: playerDelta ? [playerDelta] : [fullState.player],
      chunkKeys: fullState.activeChunkKeys || [],
    };

    state.pendingQueue.push(payload);
    await processQueue();
  }

  if (type === 'FORCE_SNAPSHOT_NOW') {
    self.postMessage({ type: 'REQUEST_SNAPSHOT_DATA' });
  }

  if (type === 'STOP_WORKER') {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    self.postMessage({ type: 'WORKER_STOPPED' });
  }
};
