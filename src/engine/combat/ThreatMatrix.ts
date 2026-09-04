export interface ThreatRecord {
  entityId: string;
  threat: number;
  totalDamageDealt: number;
  lastEngageTime: number;
}

export interface MobThreatTable {
  mobId: string;
  currentTargetId: string | null;
  threats: Map<string, ThreatRecord>;
  spawnPosition: { x: number; z: number };
  maxLeashDistance: number;
  isEvading: boolean;
}

/**
 * ThreatMatrix
 * Authoritative aggro and threat calculation for MMORPG combat.
 * Replaces simple single-player distance checks with multi-target threat tables,
 * role-specific threat multipliers (Tanks, Healers, DPS), and leash resets.
 */
export class ThreatMatrix {
  private tables: Map<string, MobThreatTable> = new Map();

  public registerMob(mobId: string, spawnX: number, spawnZ: number, maxLeashDistance: number = 48.0): void {
    this.tables.set(mobId, {
      mobId,
      currentTargetId: null,
      threats: new Map(),
      spawnPosition: { x: spawnX, z: spawnZ },
      maxLeashDistance,
      isEvading: false,
    });
  }

  public unregisterMob(mobId: string): void {
    this.tables.delete(mobId);
  }

  /**
   * Register damage threat from an attacker
   */
  public addDamageThreat(mobId: string, attackerId: string, damage: number, isTankRole: boolean = false): void {
    const table = this.tables.get(mobId);
    if (!table || table.isEvading) return;

    const multiplier = isTankRole ? 3.5 : 1.0;
    const addedThreat = Math.max(1, damage * multiplier);

    let rec = table.threats.get(attackerId);
    if (!rec) {
      rec = {
        entityId: attackerId,
        threat: 0,
        totalDamageDealt: 0,
        lastEngageTime: Date.now(),
      };
      table.threats.set(attackerId, rec);
    }

    rec.threat += addedThreat;
    rec.totalDamageDealt += damage;
    rec.lastEngageTime = Date.now();

    this.reevaluateTarget(table);
  }

  /**
   * Taunt ability: instantly sets threat 20% higher than the top threat holder + flat 300
   */
  public applyTaunt(mobId: string, taunterId: string): void {
    const table = this.tables.get(mobId);
    if (!table) return;

    let maxThreat = 0;
    table.threats.forEach((r) => {
      if (r.threat > maxThreat) maxThreat = r.threat;
    });

    const newThreat = Math.max(500, maxThreat * 1.25 + 300);
    let rec = table.threats.get(taunterId);
    if (!rec) {
      rec = { entityId: taunterId, threat: 0, totalDamageDealt: 0, lastEngageTime: Date.now() };
      table.threats.set(taunterId, rec);
    }
    rec.threat = newThreat;
    rec.lastEngageTime = Date.now();

    table.currentTargetId = taunterId;
  }

  /**
   * Distribute healing threat across all mobs in combat with the healed target
   */
  public addHealingThreat(healerId: string, healAmount: number): void {
    const splitThreat = (healAmount * 0.5) / Math.max(1, this.tables.size);
    this.tables.forEach((table) => {
      if (table.threats.size > 0 && !table.isEvading) {
        let rec = table.threats.get(healerId);
        if (!rec) {
          rec = { entityId: healerId, threat: 0, totalDamageDealt: 0, lastEngageTime: Date.now() };
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

  public clearThreats(mobId: string): void {
    const table = this.tables.get(mobId);
    if (table) {
      table.threats.clear();
      table.currentTargetId = null;
    }
  }
}

export const threatMatrix = new ThreatMatrix();
