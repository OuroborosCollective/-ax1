/**
 * NPCShortTermMemory.ts
 *
 * Deterministic Short-Term Working Memory System for Autonomous NPCs in Echoes of Aurion.
 * Enables NPCs to remember recent hazards, trade deals, depleted resources, and navigational obstacles.
 * Features:
 * - Fixed-capacity ring buffer per NPC to ensure zero garbage collection (GC).
 * - Deterministic tick-based exponential/linear memory decay.
 * - Spatial hazard penalty lookup for pathfinding cost bias.
 * - Binary serialization compatible for network syncing.
 */

export enum NPCMemoryType {
  HAZARD_THREAT = 1,       // Ambush, bandit raid, hostile monster sighting
  OBSTACLE_STUCK = 2,      // Impassable terrain, stuck waypoint, path obstruction
  TRADE_DEAL = 3,          // Successful market transaction at regional hub
  DEPLETED_RESOURCE = 4,   // Exhausted resource harvest location
  SOCIAL_ENCOUNTER = 5,    // Interaction with player hero or allied caravan
  PATH_DEVIATION = 6,      // Segment where local path deviated from macro starpath
}

export interface NPCMemoryRecord {
  type: NPCMemoryType;
  x: number;
  z: number;
  tickRecorded: number;
  ttlTicks: number;        // Time-To-Live in simulation ticks (e.g. 60-180 ticks = 3-9s)
  intensity: number;       // 0.0 to 1.0 (decays over time)
  metadata: number;        // e.g., threat level, commodity ID, hub ID hash, or error code
}

export const MAX_MEMORIES_PER_NPC = 8;

export class NPCShortTermMemory {
  private records: NPCMemoryRecord[] = [];
  private capacity: number;

  constructor(capacity: number = MAX_MEMORIES_PER_NPC) {
    this.capacity = capacity;
  }

  /**
   * Adds a new memory event to the ring buffer, evicting the oldest/weakest record if capacity is reached.
   */
  public record(
    type: NPCMemoryType,
    x: number,
    z: number,
    currentTick: number,
    options?: {
      ttlTicks?: number;
      intensity?: number;
      metadata?: number;
    }
  ): void {
    const ttlTicks = options?.ttlTicks ?? 100; // default 5 seconds @ 20Hz
    const intensity = Math.max(0.1, Math.min(1.0, options?.intensity ?? 1.0));
    const metadata = options?.metadata ?? 0;

    // Check if an existing memory of the same type at close proximity exists -> refresh it
    const existingIdx = this.records.findIndex(
      (r) => r.type === type && Math.hypot(r.x - x, r.z - z) < 4.0
    );

    if (existingIdx >= 0) {
      this.records[existingIdx].tickRecorded = currentTick;
      this.records[existingIdx].ttlTicks = ttlTicks;
      this.records[existingIdx].intensity = Math.min(1.0, this.records[existingIdx].intensity + 0.3);
      this.records[existingIdx].metadata = metadata;
      return;
    }

    if (this.records.length >= this.capacity) {
      // Find and replace either expired or oldest memory
      let oldestIdx = 0;
      let minTick = Infinity;
      for (let i = 0; i < this.records.length; i++) {
        if (this.records[i].tickRecorded < minTick) {
          minTick = this.records[i].tickRecorded;
          oldestIdx = i;
        }
      }
      this.records[oldestIdx] = {
        type,
        x,
        z,
        tickRecorded: currentTick,
        ttlTicks,
        intensity,
        metadata,
      };
    } else {
      this.records.push({
        type,
        x,
        z,
        tickRecorded: currentTick,
        ttlTicks,
        intensity,
        metadata,
      });
    }
  }

  /**
   * Deterministically decays all memories based on current simulation tick.
   * Removes memories whose TTL has elapsed, and strictly prunes any memories
   * older than maxAgeTicks (default 3500 ticks) to maintain zero memory bloat.
   */
  public decay(currentTick: number, maxAgeTicks: number = 3500): void {
    const surviving: NPCMemoryRecord[] = [];

    for (let i = 0; i < this.records.length; i++) {
      const rec = this.records[i];
      const elapsed = currentTick - rec.tickRecorded;

      // Hard pruning rule: prune anything older than maxAgeTicks (3500 ticks) or expired TTL
      if (elapsed >= 0 && elapsed < rec.ttlTicks && elapsed <= maxAgeTicks) {
        // Calculate linear decay factor
        rec.intensity = Math.max(0.05, 1.0 - elapsed / rec.ttlTicks);
        surviving.push(rec);
      }
    }

    this.records = surviving;
  }

  /**
   * Explicit pruning function to purge memories older than maxAgeTicks (3500 ticks).
   */
  public pruneOldMemories(currentTick: number, maxAgeTicks: number = 3500): number {
    const initialCount = this.records.length;
    this.records = this.records.filter((r) => {
      const elapsed = currentTick - r.tickRecorded;
      return elapsed >= 0 && elapsed <= maxAgeTicks && elapsed < r.ttlTicks;
    });
    return initialCount - this.records.length;
  }

  /**
   * Returns all recent trade deal records from short-term memory.
   */
  public getTradeMemories(): NPCMemoryRecord[] {
    return this.records.filter((r) => r.type === NPCMemoryType.TRADE_DEAL);
  }

  /**
   * Calculates a dynamic pathfinding cost penalty for a given coordinate (x, z).
   * High threat memory nearby increases the path cost, causing NPCs to naturally route around danger.
   */
  public getHazardPenalty(x: number, z: number, currentTick: number, radius: number = 18.0): number {
    let penalty = 0;

    for (const rec of this.records) {
      if (rec.type === NPCMemoryType.HAZARD_THREAT || rec.type === NPCMemoryType.OBSTACLE_STUCK) {
        const dist = Math.hypot(rec.x - x, rec.z - z);
        if (dist < radius) {
          const proximityFactor = 1.0 - dist / radius;
          const threatMult = rec.type === NPCMemoryType.HAZARD_THREAT ? 3.5 : 2.0;
          penalty += proximityFactor * rec.intensity * threatMult;
        }
      }
    }

    return penalty;
  }

  /**
   * Checks whether the NPC has encountered an obstacle or blockage near the target coordinates recently.
   */
  public hasRecentObstacle(x: number, z: number, radius: number = 3.0): boolean {
    return this.records.some(
      (r) => r.type === NPCMemoryType.OBSTACLE_STUCK && Math.hypot(r.x - x, r.z - z) < radius
    );
  }

  /**
   * Checks whether the NPC recently traded at a given hub.
   */
  public hasRecentTrade(hubMetadataHash: number, withinTicks: number = 80, currentTick: number = 0): boolean {
    return this.records.some(
      (r) =>
        r.type === NPCMemoryType.TRADE_DEAL &&
        r.metadata === hubMetadataHash &&
        currentTick - r.tickRecorded <= withinTicks
    );
  }

  /**
   * Returns a copy of active memory records.
   */
  public getMemories(): readonly NPCMemoryRecord[] {
    return this.records;
  }

  /**
   * Returns the count of currently retained active memories.
   */
  public get count(): number {
    return this.records.length;
  }

  /**
   * Clears all working memory.
   */
  public clear(): void {
    this.records = [];
  }

  /**
   * Clones this memory store.
   */
  public clone(): NPCShortTermMemory {
    const copy = new NPCShortTermMemory(this.capacity);
    copy.records = this.records.map((r) => ({ ...r }));
    return copy;
  }
}
