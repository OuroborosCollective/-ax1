/**
 * TimestampedInputBuffer.ts
 *
 * Deterministic Timestamped Input Buffer for Networked Action & Movement Commands.
 *
 * Implements latency-compensated, tick-scheduled command queuing:
 * 1. Measures Round-Trip Time (RTT) and latency jitter.
 * 2. Assigns each user command a target deterministic server tick based on estimated one-way delay.
 * 3. Queues commands into a tick-indexed deterministic ring buffer.
 * 4. Executes commands deterministically on the exact server tick during the simulation loop.
 * 5. Handles late arrivals, jitter smoothing, and prediction reconciliation.
 */

import { sha256Hex, canonicalize } from '../math/DeterministicHash';

export type UserActionType =
  | 'MOVE'
  | 'ATTACK'
  | 'CAST_SPELL'
  | 'DODGE_ROLL'
  | 'JUMP'
  | 'INTERACT'
  | 'USE_ITEM'
  | 'ZONE_TRANSITION'
  | 'CUSTOM';

export interface MoveActionPayload {
  x: number;
  z: number;
  facingAngle: number;
  speed: number;
  isRunning?: boolean;
}

export interface AttackActionPayload {
  weaponType: string;
  attackIndex: number;
  targetId?: string;
  targetPos?: { x: number; y: number; z: number };
}

export interface CastSpellActionPayload {
  spellId: string;
  skillIndex: number;
  targetPos?: { x: number; y: number; z: number };
  targetEntityId?: string;
}

export interface DodgeRollActionPayload {
  dirX: number;
  dirZ: number;
  speed: number;
}

export interface InteractActionPayload {
  targetId: string;
  interactionType: string;
}

export interface UseItemActionPayload {
  itemId: string;
  slotIndex: number;
}

export type TimestampedActionPayload =
  | MoveActionPayload
  | AttackActionPayload
  | CastSpellActionPayload
  | DodgeRollActionPayload
  | InteractActionPayload
  | UseItemActionPayload
  | Record<string, unknown>;

export interface TimestampedUserCommand {
  sequenceId: number;
  playerId: string;
  actionType: UserActionType;
  payload: TimestampedActionPayload;
  clientTimestampMs: number;
  targetTick: number;
  estimatedLatencyMs: number;
  commandHash: string;
  status: 'queued' | 'executed' | 'dropped_late' | 'predicted';
  executedAtTick: number | null;
}

export interface InputBufferStats {
  queuedCount: number;
  totalExecuted: number;
  totalDroppedLate: number;
  currentEstimatedPingMs: number;
  jitterMs: number;
  bufferedLeadTicks: number;
  bufferHealth: 'optimal' | 'recovering' | 'jittery' | 'starved';
}

export interface InputBufferOptions {
  tickRateHz?: number; // Default 20 Hz (50ms per tick)
  minBufferDelayTicks?: number; // Default 1 tick minimum buffer margin
  maxBufferDelayTicks?: number; // Default 8 ticks maximum buffer window
  maxLateToleranceTicks?: number; // Ticks allowed for rollback/replay before drop
  rttSampleWindowSize?: number;
}

export class TimestampedInputBuffer {
  private static instance: TimestampedInputBuffer | null = null;

  public readonly tickRateHz: number;
  public readonly tickIntervalMs: number;
  public readonly minBufferDelayTicks: number;
  public readonly maxBufferDelayTicks: number;
  public readonly maxLateToleranceTicks: number;

  private sequenceCounter: number = 0;
  private commandsByTick: Map<number, TimestampedUserCommand[]> = new Map();
  private commandHistory: TimestampedUserCommand[] = [];
  private readonly maxHistoryLength = 500;

  // Latency and jitter estimation
  private rttSamples: number[] = [40]; // Default initial assumption ~40ms
  private readonly rttSampleWindowSize: number;
  private estimatedRttMs: number = 40;
  private estimatedJitterMs: number = 4;
  private clockOffsetMs: number = 0;

  // Stats
  private totalExecuted: number = 0;
  private totalDroppedLate: number = 0;

  constructor(options: InputBufferOptions = {}) {
    this.tickRateHz = options.tickRateHz ?? 20;
    this.tickIntervalMs = 1000 / this.tickRateHz;
    this.minBufferDelayTicks = options.minBufferDelayTicks ?? 1;
    this.maxBufferDelayTicks = options.maxBufferDelayTicks ?? 8;
    this.maxLateToleranceTicks = options.maxLateToleranceTicks ?? 3;
    this.rttSampleWindowSize = options.rttSampleWindowSize ?? 20;
  }

  public static getInstance(): TimestampedInputBuffer {
    if (!TimestampedInputBuffer.instance) {
      TimestampedInputBuffer.instance = new TimestampedInputBuffer();
    }
    return TimestampedInputBuffer.instance;
  }

  /**
   * Updates network RTT sample from heartbeats / ping packets to adaptively tune buffer lead time.
   */
  public recordRttSample(sampleMs: number, serverTimeMs?: number): void {
    if (sampleMs <= 0 || !Number.isFinite(sampleMs)) return;

    this.rttSamples.push(sampleMs);
    if (this.rttSamples.length > this.rttSampleWindowSize) {
      this.rttSamples.shift();
    }

    // Compute moving average and standard deviation (jitter)
    const avg = this.rttSamples.reduce((sum, s) => sum + s, 0) / this.rttSamples.length;
    const variance =
      this.rttSamples.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / this.rttSamples.length;
    this.estimatedRttMs = Math.round(avg);
    this.estimatedJitterMs = Math.round(Math.sqrt(variance));

    if (serverTimeMs !== undefined) {
      const now = performance.now();
      const currentEstimatedServerTime = serverTimeMs + this.estimatedRttMs / 2;
      this.clockOffsetMs = currentEstimatedServerTime - now;
    }
  }

  /**
   * Computes the deterministic execution tick for a new client command based on latency and jitter.
   */
  public computeTargetTick(currentServerTick: number): number {
    const oneWayLatency = this.estimatedRttMs / 2;
    const safetyMargin = this.estimatedJitterMs * 1.5;
    const totalDelayMs = oneWayLatency + safetyMargin;

    let delayTicks = Math.ceil(totalDelayMs / this.tickIntervalMs);
    delayTicks = Math.max(
      this.minBufferDelayTicks,
      Math.min(this.maxBufferDelayTicks, delayTicks)
    );

    return currentServerTick + delayTicks;
  }

  /**
   * Enqueues a user action into the timestamped deterministic input buffer.
   */
  public enqueueCommand(
    playerId: string,
    actionType: UserActionType,
    payload: TimestampedActionPayload,
    currentServerTick: number,
    forcedTargetTick?: number
  ): TimestampedUserCommand {
    this.sequenceCounter++;
    const now = performance.now();
    const targetTick =
      forcedTargetTick !== undefined ? forcedTargetTick : this.computeTargetTick(currentServerTick);

    const canonicalPayload = canonicalize(payload) as TimestampedActionPayload;
    const hashData = {
      sequenceId: this.sequenceCounter,
      playerId,
      actionType,
      targetTick,
      payload: canonicalPayload,
    };
    const commandHash = sha256Hex(hashData);

    const command: TimestampedUserCommand = {
      sequenceId: this.sequenceCounter,
      playerId,
      actionType,
      payload: canonicalPayload,
      clientTimestampMs: now,
      targetTick,
      estimatedLatencyMs: Math.round(this.estimatedRttMs / 2),
      commandHash,
      status: 'queued',
      executedAtTick: null,
    };

    // Store in tick bucket
    const bucket = this.commandsByTick.get(targetTick) || [];
    bucket.push(command);
    // Sort bucket by sequence ID to guarantee deterministic order
    bucket.sort((a, b) => a.sequenceId - b.sequenceId);
    this.commandsByTick.set(targetTick, bucket);

    return command;
  }

  /**
   * Processes all commands scheduled for the current deterministic simulation tick.
   * Called strictly by the deterministic fixed timestep loop (e.g. 20 Hz).
   */
  public processTick(
    currentTick: number,
    executor: (cmd: TimestampedUserCommand) => void
  ): TimestampedUserCommand[] {
    const executed: TimestampedUserCommand[] = [];

    // 1. Check for commands scheduled for this exact tick
    const commands = this.commandsByTick.get(currentTick);
    if (commands && commands.length > 0) {
      for (const cmd of commands) {
        cmd.status = 'executed';
        cmd.executedAtTick = currentTick;
        try {
          executor(cmd);
          executed.push(cmd);
          this.totalExecuted++;
        } catch (err) {
          console.error(`[TimestampedInputBuffer] Error executing command #${cmd.sequenceId}:`, err);
        }
        this.archiveCommand(cmd);
      }
      this.commandsByTick.delete(currentTick);
    }

    // 2. Clean up any stale ticks in the past that were never processed (late drops)
    for (const [tick, lateCommands] of this.commandsByTick.entries()) {
      if (tick < currentTick - this.maxLateToleranceTicks) {
        for (const lateCmd of lateCommands) {
          lateCmd.status = 'dropped_late';
          this.totalDroppedLate++;
          this.archiveCommand(lateCmd);
        }
        this.commandsByTick.delete(tick);
      }
    }

    return executed;
  }

  /**
   * Peeks all queued commands for upcoming ticks.
   */
  public getQueuedCommands(): TimestampedUserCommand[] {
    const all: TimestampedUserCommand[] = [];
    for (const cmds of this.commandsByTick.values()) {
      all.push(...cmds);
    }
    return all.sort((a, b) => a.targetTick - b.targetTick || a.sequenceId - b.sequenceId);
  }

  /**
   * Returns recent command history.
   */
  public getHistory(): readonly TimestampedUserCommand[] {
    return this.commandHistory;
  }

  /**
   * Returns diagnostic stats regarding input buffer health and network latency.
   */
  public getStats(currentServerTick: number): InputBufferStats {
    let queuedCount = 0;
    for (const cmds of this.commandsByTick.values()) {
      queuedCount += cmds.length;
    }

    const leadTicks = this.computeTargetTick(currentServerTick) - currentServerTick;

    let bufferHealth: InputBufferStats['bufferHealth'] = 'optimal';
    if (this.estimatedJitterMs > 25) {
      bufferHealth = 'jittery';
    } else if (this.totalDroppedLate > 5) {
      bufferHealth = 'recovering';
    } else if (queuedCount === 0) {
      bufferHealth = 'optimal';
    }

    return {
      queuedCount,
      totalExecuted: this.totalExecuted,
      totalDroppedLate: this.totalDroppedLate,
      currentEstimatedPingMs: this.estimatedRttMs,
      jitterMs: this.estimatedJitterMs,
      bufferedLeadTicks: leadTicks,
      bufferHealth,
    };
  }

  public clear(): void {
    this.commandsByTick.clear();
    this.commandHistory = [];
    this.sequenceCounter = 0;
    this.totalExecuted = 0;
    this.totalDroppedLate = 0;
  }

  private archiveCommand(cmd: TimestampedUserCommand): void {
    this.commandHistory.push(cmd);
    if (this.commandHistory.length > this.maxHistoryLength) {
      this.commandHistory.shift();
    }
  }
}

export const timestampedInputBuffer = new TimestampedInputBuffer();
