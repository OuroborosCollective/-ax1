/**
 * FixedTimestepLoop.ts
 *
 * Decouples deterministic gameplay simulation (e.g. 20 Hz / 50ms) from
 * variable monitor rendering framerates (60-144+ Hz).
 *
 * Implements an accumulator-based fixed timestep loop with interpolation
 * alpha computation, guaranteeing identical physics and combat outcomes
 * regardless of framerate spikes or hardware capability.
 */

export interface FixedStepMetrics {
  tickRate: number;
  currentTick: number;
  fixedDelta: number;
  accumulatedLagMs: number;
  interpolationAlpha: number;
  totalTicksSimulated: number;
}

export class FixedTimestepLoop {
  public readonly targetTickRate: number;
  public readonly fixedDelta: number; // e.g. 0.05s for 20 Hz
  private accumulator: number = 0;
  private currentTick: number = 0;
  private maxFrameTime: number = 0.25; // Prevents "spiral of death" on severe stalls
  private totalTicks: number = 0;

  public onTick?: (tick: number, fixedDelta: number) => void;

  constructor(targetTickRate: number = 20) {
    this.targetTickRate = targetTickRate;
    this.fixedDelta = 1.0 / targetTickRate;
  }

  /**
   * Advance the simulation accumulator by real frame delta time.
   * Runs exactly the required number of fixed ticks.
   *
   * @param renderDelta Seconds elapsed since last render frame
   * @returns Alpha (0.0 to 1.0) for interpolating visual rendering between previous and current state
   */
  public advance(renderDelta: number): number {
    // Clamp render delta to avoid spiral of death on background tab suspension
    const clampedDelta = Math.min(renderDelta, this.maxFrameTime);
    this.accumulator += clampedDelta;

    while (this.accumulator >= this.fixedDelta) {
      this.currentTick++;
      this.totalTicks++;

      if (this.onTick) {
        this.onTick(this.currentTick, this.fixedDelta);
      }

      this.accumulator -= this.fixedDelta;
    }

    // Alpha represents how far into the next fixed tick we currently are
    return Math.max(0, Math.min(1.0, this.accumulator / this.fixedDelta));
  }

  public getMetrics(): FixedStepMetrics {
    return {
      tickRate: this.targetTickRate,
      currentTick: this.currentTick,
      fixedDelta: this.fixedDelta,
      accumulatedLagMs: Math.round(this.accumulator * 1000),
      interpolationAlpha: this.accumulator / this.fixedDelta,
      totalTicksSimulated: this.totalTicks,
    };
  }

  public reset(): void {
    this.accumulator = 0;
    this.currentTick = 0;
    this.totalTicks = 0;
  }
}
