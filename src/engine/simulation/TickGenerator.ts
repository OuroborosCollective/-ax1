/**
 * TickGenerator.ts
 *
 * ARE Deterministic Tick System
 *
 * AXIOM 3 (Zeitstempel-Integrität) COMPLIANT:
 * - Uses tick-based logical time, NOT wall-clock Date.now()
 * - Each tick increments ARE time by TICK_INTERVAL_MS
 * - Deterministic timestamp calculated strictly from tick count
 */

export interface AREPayload {
  tick: number;
  timestamp: number; // Deterministic tick-based milliseconds
  data: Record<string, unknown>;
}

export type TickListener = (payload: AREPayload) => void;

export class TickGenerator {
  public static readonly TICK_INTERVAL_MS = 50; // 20 Hz default ARE frequency
  private running: boolean = false;
  private tickCount: number = 0;
  private areTickTimeMs: number = 0;
  private timerId: number | ReturnType<typeof setInterval> | null = null;
  private listeners: Set<TickListener> = new Set();

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.tickCount = 0;
    this.areTickTimeMs = 0;

    this.timerId = setInterval(() => {
      this.processTick();
    }, TickGenerator.TICK_INTERVAL_MS);
  }

  public stop(): void {
    this.running = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public stepManual(): AREPayload {
    return this.processTick();
  }

  private processTick(): AREPayload {
    this.tickCount++;
    this.areTickTimeMs += TickGenerator.TICK_INTERVAL_MS;

    const payload: AREPayload = {
      tick: this.tickCount,
      timestamp: this.areTickTimeMs,
      data: {},
    };

    for (const listener of this.listeners) {
      listener(payload);
    }

    return payload;
  }

  public onTick(listener: TickListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getTickCount(): number {
    return this.tickCount;
  }

  public getAreTimeMs(): number {
    return this.areTickTimeMs;
  }

  public isRunning(): boolean {
    return this.running;
  }

  public reset(): void {
    this.stop();
    this.tickCount = 0;
    this.areTickTimeMs = 0;
    this.listeners.clear();
  }
}

export const tickGenerator = new TickGenerator();
