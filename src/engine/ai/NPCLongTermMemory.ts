/**
 * NPCLongTermMemory.ts
 *
 * Deterministic Long-Term Episodic & Relational Memory for Autonomous NPCs in Echoes of Aurion.
 * Tracks persistent knowledge across four core cognitive domains:
 * 1. Known Enemies (Hostile raiders, dangerous monsters, and player standing)
 * 2. High-Yield Trade Hubs (Best historical profit margins, trade deal counts, and merchant reliability)
 * 3. Best Resource Spots (Top harvest coordinates, yield ratings, and resource abundance)
 * 4. Zone Leadership & Social Standing (Zone leader awareness, faction ties, reputation score, and Good/Bad standing)
 *
 * Enforces strict bounded capacities and deterministic memory pruning (e.g. >3500 ticks)
 * to guarantee zero memory bloat and sub-microsecond queries across thousands of active agents.
 */

export interface KnownEnemyMemory {
  enemyId: string;
  name: string;
  threatLevel: number;        // 1 to 100
  lastSeenCoords: { x: number; z: number };
  lastSeenTick: number;
  hostilityScore: number;     // 1 to 100 (determines flee vs fight distance)
  encounterCount: number;
  defeatedCount: number;
}

export interface TradePointMemory {
  hubId: string;
  hubName: string;
  coords: { x: number; z: number };
  bestCommodityId: number;
  bestProfitCopper: number;
  successfulDealsCount: number;
  lastTradeTick: number;
  reliabilityRating: number;  // 0.0 to 1.0
  affinityScore: number;      // 1.0 (neutral) to 3.0 (devoted partner)
}

export interface ResourceSpotMemory {
  spotId: string;
  resourceId: number;
  resourceName: string;
  coords: { x: number; z: number };
  yieldRating: number;        // 1.0 to 3.0 (higher = richer vein / denser grove)
  harvestCount: number;
  lastHarvestTick: number;
}

export type SocialStandingTier = 'EXALTED' | 'HONORED' | 'RESPECTED' | 'NEUTRAL' | 'DISTRUSTED' | 'OUTCAST' | 'HOSTILE';

export interface ZoneLeadershipMemory {
  currentZoneId: string;
  zoneLeaderId: string;
  zoneLeaderName: string;
  zoneLeaderTitle: string;
  zoneLeaderFaction: string;
  socialStanding: SocialStandingTier;
  reputationScore: number;    // -100 (Despised) to +100 (Exalted)
  isGoodStanding: boolean;    // true if reputation >= 0
  lastStandingChangeTick: number;
  standingReason: string;
}

export interface NPCLongTermHighlight {
  npcName: string;
  topEnemy: KnownEnemyMemory | null;
  bestTradePoint: TradePointMemory | null;
  bestResourceSpot: ResourceSpotMemory | null;
  zoneLeadership: ZoneLeadershipMemory;
  totalEnemiesKnown: number;
  totalTradePointsKnown: number;
  totalResourceSpotsKnown: number;
}

export class NPCLongTermMemory {
  public static readonly MAX_ENEMIES_CAPACITY = 5;
  public static readonly MAX_TRADE_POINTS_CAPACITY = 5;
  public static readonly MAX_RESOURCE_SPOTS_CAPACITY = 5;
  public static readonly DEFAULT_MAX_MEMORY_AGE_TICKS = 3500;

  private enemies: KnownEnemyMemory[] = [];
  private tradePoints: TradePointMemory[] = [];
  private resourceSpots: ResourceSpotMemory[] = [];
  private zoneLeadership: ZoneLeadershipMemory;

  constructor(initialZoneId: string = 'sun_spire', initialZoneLeader?: Partial<ZoneLeadershipMemory>) {
    this.zoneLeadership = {
      currentZoneId: initialZoneId,
      zoneLeaderId: initialZoneLeader?.zoneLeaderId ?? 'archon_lysandros',
      zoneLeaderName: initialZoneLeader?.zoneLeaderName ?? 'Archon Lysandros',
      zoneLeaderTitle: initialZoneLeader?.zoneLeaderTitle ?? 'Wächter der Sonnen-Spitze',
      zoneLeaderFaction: initialZoneLeader?.zoneLeaderFaction ?? 'Aurion Sonnenorden',
      socialStanding: initialZoneLeader?.socialStanding ?? 'RESPECTED',
      reputationScore: initialZoneLeader?.reputationScore ?? 35,
      isGoodStanding: (initialZoneLeader?.reputationScore ?? 35) >= 0,
      lastStandingChangeTick: 0,
      standingReason: initialZoneLeader?.standingReason ?? 'Gesetzestreuer Bürger des Reichs',
    };
  }

  // ==========================================
  // 1. ENEMY MEMORY
  // ==========================================

  public recordEnemy(
    enemyId: string,
    name: string,
    threatLevel: number,
    coords: { x: number; z: number },
    currentTick: number,
    options?: { hostilityDelta?: number; isDefeat?: boolean }
  ): void {
    const existing = this.enemies.find((e) => e.enemyId === enemyId);
    if (existing) {
      existing.name = name;
      existing.threatLevel = Math.max(existing.threatLevel, threatLevel);
      existing.lastSeenCoords = { ...coords };
      existing.lastSeenTick = currentTick;
      existing.encounterCount++;
      if (options?.isDefeat) existing.defeatedCount++;
      if (options?.hostilityDelta) {
        existing.hostilityScore = Math.max(1, Math.min(100, existing.hostilityScore + options.hostilityDelta));
      }
      return;
    }

    const newRecord: KnownEnemyMemory = {
      enemyId,
      name,
      threatLevel,
      lastSeenCoords: { ...coords },
      lastSeenTick: currentTick,
      hostilityScore: 60,
      encounterCount: 1,
      defeatedCount: options?.isDefeat ? 1 : 0,
    };

    if (this.enemies.length >= NPCLongTermMemory.MAX_ENEMIES_CAPACITY) {
      // Evict lowest hostility or oldest record
      let evictIdx = 0;
      let minScore = Infinity;
      for (let i = 0; i < this.enemies.length; i++) {
        const score = this.enemies[i].hostilityScore * 10 - (currentTick - this.enemies[i].lastSeenTick) * 0.01;
        if (score < minScore) {
          minScore = score;
          evictIdx = i;
        }
      }
      this.enemies[evictIdx] = newRecord;
    } else {
      this.enemies.push(newRecord);
    }
  }

  public getKnownEnemies(): readonly KnownEnemyMemory[] {
    return this.enemies;
  }

  public getTopEnemyThreat(): KnownEnemyMemory | null {
    if (this.enemies.length === 0) return null;
    return this.enemies.reduce((prev, curr) => (curr.threatLevel > prev.threatLevel ? curr : prev), this.enemies[0]);
  }

  // ==========================================
  // 2. GOOD TRADE POINTS MEMORY
  // ==========================================

  public recordTradePoint(
    hubId: string,
    hubName: string,
    coords: { x: number; z: number },
    commodityId: number,
    profitCopper: number,
    currentTick: number
  ): void {
    const existing = this.tradePoints.find((t) => t.hubId === hubId);
    if (existing) {
      existing.hubName = hubName;
      existing.coords = { ...coords };
      existing.successfulDealsCount++;
      existing.lastTradeTick = currentTick;
      if (profitCopper > existing.bestProfitCopper) {
        existing.bestProfitCopper = profitCopper;
        existing.bestCommodityId = commodityId;
      }
      // Incrementally improve reliability & affinity from successful deals
      existing.reliabilityRating = Math.min(1.0, existing.reliabilityRating + 0.08);
      existing.affinityScore = Math.min(3.0, existing.affinityScore + 0.12);
      return;
    }

    const newRecord: TradePointMemory = {
      hubId,
      hubName,
      coords: { ...coords },
      bestCommodityId: commodityId,
      bestProfitCopper: profitCopper,
      successfulDealsCount: 1,
      lastTradeTick: currentTick,
      reliabilityRating: 0.7,
      affinityScore: 1.25,
    };

    if (this.tradePoints.length >= NPCLongTermMemory.MAX_TRADE_POINTS_CAPACITY) {
      let evictIdx = 0;
      let minAffinity = Infinity;
      for (let i = 0; i < this.tradePoints.length; i++) {
        if (this.tradePoints[i].affinityScore < minAffinity) {
          minAffinity = this.tradePoints[i].affinityScore;
          evictIdx = i;
        }
      }
      this.tradePoints[evictIdx] = newRecord;
    } else {
      this.tradePoints.push(newRecord);
    }
  }

  public getTradePoints(): readonly TradePointMemory[] {
    return this.tradePoints;
  }

  public getBestTradePoint(): TradePointMemory | null {
    if (this.tradePoints.length === 0) return null;
    return this.tradePoints.reduce((prev, curr) => (curr.affinityScore > prev.affinityScore ? curr : prev), this.tradePoints[0]);
  }

  // ==========================================
  // 3. BEST RESOURCE SPOTS MEMORY
  // ==========================================

  public recordResourceSpot(
    spotId: string,
    resourceId: number,
    resourceName: string,
    coords: { x: number; z: number },
    yieldRating: number,
    currentTick: number
  ): void {
    const existing = this.resourceSpots.find((r) => r.spotId === spotId || (r.resourceId === resourceId && Math.hypot(r.coords.x - coords.x, r.coords.z - coords.z) < 15.0));
    if (existing) {
      existing.harvestCount++;
      existing.lastHarvestTick = currentTick;
      existing.yieldRating = Math.max(existing.yieldRating, yieldRating);
      return;
    }

    const newRecord: ResourceSpotMemory = {
      spotId,
      resourceId,
      resourceName,
      coords: { ...coords },
      yieldRating,
      harvestCount: 1,
      lastHarvestTick: currentTick,
    };

    if (this.resourceSpots.length >= NPCLongTermMemory.MAX_RESOURCE_SPOTS_CAPACITY) {
      let evictIdx = 0;
      let minYield = Infinity;
      for (let i = 0; i < this.resourceSpots.length; i++) {
        if (this.resourceSpots[i].yieldRating < minYield) {
          minYield = this.resourceSpots[i].yieldRating;
          evictIdx = i;
        }
      }
      this.resourceSpots[evictIdx] = newRecord;
    } else {
      this.resourceSpots.push(newRecord);
    }
  }

  public getResourceSpots(): readonly ResourceSpotMemory[] {
    return this.resourceSpots;
  }

  public getBestResourceSpot(resourceId?: number): ResourceSpotMemory | null {
    const candidates = resourceId !== undefined ? this.resourceSpots.filter((r) => r.resourceId === resourceId) : this.resourceSpots;
    if (candidates.length === 0) return null;
    return candidates.reduce((prev, curr) => (curr.yieldRating > prev.yieldRating ? curr : prev), candidates[0]);
  }

  // ==========================================
  // 4. ZONE LEADER & SOCIAL STANDING MEMORY
  // ==========================================

  public updateZoneLeadership(
    zoneId: string,
    leaderId: string,
    leaderName: string,
    leaderTitle: string,
    faction: string,
    reputationDelta: number,
    reason: string,
    currentTick: number
  ): void {
    this.zoneLeadership.currentZoneId = zoneId;
    this.zoneLeadership.zoneLeaderId = leaderId;
    this.zoneLeadership.zoneLeaderName = leaderName;
    this.zoneLeadership.zoneLeaderTitle = leaderTitle;
    this.zoneLeadership.zoneLeaderFaction = faction;
    this.zoneLeadership.lastStandingChangeTick = currentTick;
    this.zoneLeadership.standingReason = reason;

    const newScore = Math.max(-100, Math.min(100, this.zoneLeadership.reputationScore + reputationDelta));
    this.zoneLeadership.reputationScore = newScore;
    this.zoneLeadership.isGoodStanding = newScore >= 0;

    // Classify into discrete tier
    if (newScore >= 80) this.zoneLeadership.socialStanding = 'EXALTED';
    else if (newScore >= 50) this.zoneLeadership.socialStanding = 'HONORED';
    else if (newScore >= 20) this.zoneLeadership.socialStanding = 'RESPECTED';
    else if (newScore >= -10) this.zoneLeadership.socialStanding = 'NEUTRAL';
    else if (newScore >= -40) this.zoneLeadership.socialStanding = 'DISTRUSTED';
    else if (newScore >= -75) this.zoneLeadership.socialStanding = 'OUTCAST';
    else this.zoneLeadership.socialStanding = 'HOSTILE';
  }

  public getZoneLeadership(): Readonly<ZoneLeadershipMemory> {
    return this.zoneLeadership;
  }

  public isGoodSocialStanding(): boolean {
    return this.zoneLeadership.isGoodStanding;
  }

  // ==========================================
  // 5. DETERMINISTIC MEMORY PRUNING (>= 3500 TICKS)
  // ==========================================

  /**
   * Prunes memories older than maxAgeTicks (default 3500 ticks) to maintain
   * constant-bounded, lightweight simulation memory across thousands of agents.
   */
  public pruneOldMemories(currentTick: number, maxAgeTicks: number = NPCLongTermMemory.DEFAULT_MAX_MEMORY_AGE_TICKS): {
    enemiesPruned: number;
    tradePointsPruned: number;
    resourceSpotsPruned: number;
  } {
    const prevEnemies = this.enemies.length;
    const prevTrades = this.tradePoints.length;
    const prevSpots = this.resourceSpots.length;

    // Prune stale enemy sightings older than 3500 ticks (unless extreme threat >= 90)
    this.enemies = this.enemies.filter((e) => {
      const age = currentTick - e.lastSeenTick;
      return age <= maxAgeTicks || e.threatLevel >= 90;
    });

    // Prune cold trade points older than 3500 ticks (unless top affinity >= 2.5)
    this.tradePoints = this.tradePoints.filter((t) => {
      const age = currentTick - t.lastTradeTick;
      return age <= maxAgeTicks || t.affinityScore >= 2.5;
    });

    // Prune resource spots not visited within 3500 ticks
    this.resourceSpots = this.resourceSpots.filter((r) => {
      const age = currentTick - r.lastHarvestTick;
      return age <= maxAgeTicks || r.yieldRating >= 2.8;
    });

    return {
      enemiesPruned: prevEnemies - this.enemies.length,
      tradePointsPruned: prevTrades - this.tradePoints.length,
      resourceSpotsPruned: prevSpots - this.resourceSpots.length,
    };
  }

  // ==========================================
  // 6. HIGHLIGHT SUMMARY EXTRACTOR
  // ==========================================

  public getHighlights(npcName: string = 'Citizen'): NPCLongTermHighlight {
    return {
      npcName,
      topEnemy: this.getTopEnemyThreat(),
      bestTradePoint: this.getBestTradePoint(),
      bestResourceSpot: this.getBestResourceSpot(),
      zoneLeadership: { ...this.zoneLeadership },
      totalEnemiesKnown: this.enemies.length,
      totalTradePointsKnown: this.tradePoints.length,
      totalResourceSpotsKnown: this.resourceSpots.length,
    };
  }
}
