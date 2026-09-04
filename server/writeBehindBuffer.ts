import { mariaDB } from './mariadb';

interface QueuedPlayerData {
  playerId: string;
  data: any;
  queuedAt: number;
  dirtyCount: number;
}

export class WriteBehindBuffer {
  private static instance: WriteBehindBuffer | null = null;
  private buffer: Map<string, QueuedPlayerData> = new Map();
  private flushIntervalTimer: NodeJS.Timeout | null = null;
  private isFlushing: boolean = false;
  private playerLocks: Map<string, { acquiredAt: number; expiryTimer: NodeJS.Timeout }> = new Map();
  public stats = {
    totalQueued: 0,
    totalFlushed: 0,
    totalBatches: 0,
    lastFlushDurationMs: 0,
    activeLocks: 0,
  };

  constructor(flushIntervalMs: number = 8000) {
    this.flushIntervalTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error('[WriteBehindBuffer] Background flush error:', err);
      });
    }, flushIntervalMs);
  }

  public static getInstance(): WriteBehindBuffer {
    if (!WriteBehindBuffer.instance) {
      WriteBehindBuffer.instance = new WriteBehindBuffer();
    }
    return WriteBehindBuffer.instance;
  }

  /**
   * Acquire atomic lock for player mutations (e.g. trading, dropping, equipment swapping)
   * Prevents race-condition item duplication (duping).
   */
  public async acquireLock(playerId: string, maxDurationMs: number = 3000): Promise<boolean> {
    if (this.playerLocks.has(playerId)) {
      return false; // Already locked
    }

    const expiryTimer = setTimeout(() => {
      this.releaseLock(playerId);
    }, maxDurationMs);

    this.playerLocks.set(playerId, {
      acquiredAt: Date.now(),
      expiryTimer,
    });
    this.stats.activeLocks = this.playerLocks.size;
    return true;
  }

  public releaseLock(playerId: string): void {
    const lock = this.playerLocks.get(playerId);
    if (lock) {
      clearTimeout(lock.expiryTimer);
      this.playerLocks.delete(playerId);
      this.stats.activeLocks = this.playerLocks.size;
    }
  }

  /**
   * Queue a player state update in the write-behind buffer.
   * Absorbs rapid updates (movements, combat xp, health ticks) with zero database load.
   */
  public queuePlayerSave(playerId: string, data: any): void {
    const existing = this.buffer.get(playerId);
    this.buffer.set(playerId, {
      playerId,
      data: { ...(existing?.data || {}), ...data },
      queuedAt: Date.now(),
      dirtyCount: (existing?.dirtyCount || 0) + 1,
    });
    this.stats.totalQueued++;
  }

  /**
   * Retrieve current buffered (unflushed) state if present
   */
  public getBufferedState(playerId: string): any | null {
    return this.buffer.get(playerId)?.data || null;
  }

  /**
   * Flush all dirty queued records to MariaDB
   */
  public async flush(): Promise<{ flushedCount: number; durationMs: number }> {
    if (this.isFlushing || this.buffer.size === 0) {
      return { flushedCount: 0, durationMs: 0 };
    }

    this.isFlushing = true;
    const startT = Date.now();
    const batch = Array.from(this.buffer.entries());
    this.buffer.clear();

    let successCount = 0;
    for (const [playerId, item] of batch) {
      try {
        await mariaDB.savePlayerState({ id: playerId, ...item.data });
        successCount++;
      } catch (err) {
        console.warn(`[WriteBehindBuffer] Failed to persist player ${playerId}, re-queueing:`, err);
        // Re-queue on failure so data is never dropped
        if (!this.buffer.has(playerId)) {
          this.buffer.set(playerId, item);
        }
      }
    }

    const durationMs = Date.now() - startT;
    this.stats.totalFlushed += successCount;
    this.stats.totalBatches++;
    this.stats.lastFlushDurationMs = durationMs;
    this.isFlushing = false;

    return { flushedCount: successCount, durationMs };
  }

  public shutdown(): Promise<any> {
    if (this.flushIntervalTimer) {
      clearInterval(this.flushIntervalTimer);
      this.flushIntervalTimer = null;
    }
    return this.flush();
  }
}

export const writeBehindBuffer = WriteBehindBuffer.getInstance();
