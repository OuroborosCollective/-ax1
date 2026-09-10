export interface ThreatRecord {
  entityId: string;
  threat: number;
  totalDamageDealt: number;
  lastEngageTime: number;
  entityName?: string;
  isTank?: boolean;
}

export interface MobThreatTable {
  mobId: string;
  currentTargetId: string | null;
  threats: Map<string, ThreatRecord>;
  spawnPosition: { x: number; z: number };
  fightStartPosition: { x: number; z: number } | null;
  maxLeashDistance: number;
  isEvading: boolean;
}

/**
 * ThreatMatrix
 * Authoritative aggro and threat calculation for MMORPG combat.
 * Replaces simple single-player distance checks with multi-target threat tables,
 * role-specific threat multipliers (Tanks, Healers, DPS), leash resets,
 * and player death disengage logic.
 */
export class ThreatMatrix {
  private tables: Map<string, MobThreatTable> = new Map();

  public registerMob(mobId: string, spawnX: number, spawnZ: number, maxLeashDistance: number = 48.0): void {
    this.tables.set(mobId, {
      mobId,
      currentTargetId: null,
      threats: new Map(),
      spawnPosition: { x: spawnX, z: spawnZ },
      fightStartPosition: null,
      maxLeashDistance,
      isEvading: false,
    });
  }

  public unregisterMob(mobId: string): void {
    this.tables.delete(mobId);
  }

  /**
   * Records the initial coordinates where fight combat commenced.
   */
  public recordFightStart(mobId: string, currentX: number, currentZ: number): void {
    const table = this.tables.get(mobId);
    if (table && !table.fightStartPosition) {
      table.fightStartPosition = { x: currentX, z: currentZ };
    }
  }

  public getFightStartPosition(mobId: string): { x: number; z: number } | null {
    const table = this.tables.get(mobId);
    if (!table) return null;
    return table.fightStartPosition || table.spawnPosition;
  }

  /**
   * Register damage threat from an attacker
   */
  public addDamageThreat(
    mobId: string,
    attackerId: string,
    damage: number,
    isTankRole: boolean = false,
    attackerName?: string
  ): void {
    const table = this.tables.get(mobId);
    if (!table || table.isEvading) return;

    const multiplier = isTankRole ? 3.5 : 1.0;
    const addedThreat = Math.max(1, Math.round(damage * multiplier));

    let rec = table.threats.get(attackerId);
    if (!rec) {
      rec = {
        entityId: attackerId,
        threat: 0,
        totalDamageDealt: 0,
        lastEngageTime: Date.now(),
        entityName: attackerName || (attackerId === 'hero_player_1' ? 'Hero Player' : attackerId),
        isTank: isTankRole,
      };
      table.threats.set(attackerId, rec);
    }

    rec.threat += addedThreat;
    rec.totalDamageDealt += damage;
    rec.lastEngageTime = Date.now();
    if (attackerName) rec.entityName = attackerName;
    if (isTankRole) rec.isTank = true;

    this.reevaluateTarget(table);
  }

  /**
   * Taunt ability: instantly sets threat 25% higher than the top threat holder + flat 350
   */
  public applyTaunt(mobId: string, taunterId: string, taunterName?: string): void {
    const table = this.tables.get(mobId);
    if (!table) return;

    let maxThreat = 0;
    table.threats.forEach((r) => {
      if (r.threat > maxThreat) maxThreat = r.threat;
    });

    const newThreat = Math.max(500, Math.round(maxThreat * 1.25 + 350));
    let rec = table.threats.get(taunterId);
    if (!rec) {
      rec = {
        entityId: taunterId,
        threat: 0,
        totalDamageDealt: 0,
        lastEngageTime: Date.now(),
        entityName: taunterName || (taunterId === 'hero_player_1' ? 'Hero Player' : taunterId),
        isTank: true,
      };
      table.threats.set(taunterId, rec);
    }
    rec.threat = newThreat;
    rec.lastEngageTime = Date.now();
    if (taunterName) rec.entityName = taunterName;

    table.currentTargetId = taunterId;
  }

  /**
   * Distribute healing threat across all mobs in combat with the healed target
   */
  public addHealingThreat(healerId: string, healAmount: number, healerName?: string): void {
    const splitThreat = Math.round((healAmount * 0.5) / Math.max(1, this.tables.size));
    this.tables.forEach((table) => {
      if (table.threats.size > 0 && !table.isEvading) {
        let rec = table.threats.get(healerId);
        if (!rec) {
          rec = {
            entityId: healerId,
            threat: 0,
            totalDamageDealt: 0,
            lastEngageTime: Date.now(),
            entityName: healerName || healerId,
          };
          table.threats.set(healerId, rec);
        }
        rec.threat += splitThreat;
        this.reevaluateTarget(table);
      }
    });
  }

  /**
   * Target selection with 10% hysteresis margin to prevent flapping
   */
  private reevaluateTarget(table: MobThreatTable): void {
    let topId: string | null = null;
    let topThreat = 0;

    table.threats.forEach((rec, id) => {
      if (rec.threat > topThreat) {
        topThreat = rec.threat;
        topId = id;
      }
    });

    if (!topId) {
      table.currentTargetId = null;
      return;
    }

    if (!table.currentTargetId) {
      table.currentTargetId = topId;
      return;
    }

    // Must exceed current target by 10% to pull aggro
    const currentRec = table.threats.get(table.currentTargetId);
    const currentThreat = currentRec ? currentRec.threat : 0;

    if (topThreat > currentThreat * 1.10) {
      table.currentTargetId = topId;
    }
  }

  /**
   * Checks leash distance and updates threat decay
   */
  public checkLeashAndDecay(
    mobId: string,
    currentMobX: number,
    currentMobZ: number
  ): { isEvading: boolean; targetId: string | null } {
    const table = this.tables.get(mobId);
    if (!table) return { isEvading: false, targetId: null };

    const dx = currentMobX - table.spawnPosition.x;
    const dz = currentMobZ - table.spawnPosition.z;
    const distFromSpawn = Math.hypot(dx, dz);

    if (distFromSpawn > table.maxLeashDistance) {
      // Exceeded leash boundary -> Evade mode, wipe threat, reset to spawn
      table.isEvading = true;
      table.threats.clear();
      table.currentTargetId = null;
      table.fightStartPosition = null;
      return { isEvading: true, targetId: null };
    }

    if (table.isEvading) {
      if (distFromSpawn < 3.0) {
        table.isEvading = false;
      }
      return { isEvading: table.isEvading, targetId: null };
    }

    // Threat decay over time for disengaged targets
    const now = Date.now();
    table.threats.forEach((rec, id) => {
      if (now - rec.lastEngageTime > 5000) {
        rec.threat *= 0.92; // 8% decay per check
        if (rec.threat < 1) {
          table.threats.delete(id);
        }
      }
    });

    this.reevaluateTarget(table);
    return { isEvading: false, targetId: table.currentTargetId };
  }

  public getTarget(mobId: string): string | null {
    return this.tables.get(mobId)?.currentTargetId || null;
  }

  public getTopThreats(mobId: string): ThreatRecord[] {
    const table = this.tables.get(mobId);
    if (!table) return [];
    return Array.from(table.threats.values()).sort((a, b) => b.threat - a.threat);
  }

  public getAggroTable(mobId: string): Record<string, number> {
    const table = this.tables.get(mobId);
    if (!table) return {};
    const result: Record<string, number> = {};
    table.threats.forEach((rec, id) => {
      result[id] = rec.threat;
    });
    return result;
  }

  public removeTarget(mobId: string, targetId: string): void {
    const table = this.tables.get(mobId);
    if (!table) return;
    table.threats.delete(targetId);
    if (table.currentTargetId === targetId) {
      this.reevaluateTarget(table);
    }
  }

  /**
   * Handles player or entity death.
   * Wipes the dead entity from all mob threat tables.
   * If any mob now has no remaining targets, it must disengage and return
   * directly to its fight start point on the map!
   */
  public handleEntityDeath(deadEntityId: string): {
    mobId: string;
    shouldReset: boolean;
    fightStartPos: { x: number; z: number };
  }[] {
    const affected: {
      mobId: string;
      shouldReset: boolean;
      fightStartPos: { x: number; z: number };
    }[] = [];

    this.tables.forEach((table, mobId) => {
      if (table.threats.has(deadEntityId) || table.currentTargetId === deadEntityId) {
        table.threats.delete(deadEntityId);
        this.reevaluateTarget(table);

        const returnPos = table.fightStartPosition || { ...table.spawnPosition };
        const shouldReset = table.threats.size === 0 || !table.currentTargetId;

        if (shouldReset) {
          table.isEvading = false;
          table.currentTargetId = null;
          table.threats.clear();
          table.fightStartPosition = null;
        }

        affected.push({
          mobId,
          shouldReset,
          fightStartPos: returnPos,
        });
      }
    });

    return affected;
  }

  public clearThreats(mobId: string): void {
    const table = this.tables.get(mobId);
    if (table) {
      table.threats.clear();
      table.currentTargetId = null;
      table.fightStartPosition = null;
    }
  }

  public resetMob(mobId: string): { x: number; z: number } | null {
    const table = this.tables.get(mobId);
    if (!table) return null;
    const returnPos = table.fightStartPosition || { ...table.spawnPosition };
    table.threats.clear();
    table.currentTargetId = null;
    table.isEvading = false;
    table.fightStartPosition = null;
    return returnPos;
  }
}

export const threatMatrix = new ThreatMatrix();

