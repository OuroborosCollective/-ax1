import { ElementalSynergyEvent, ElementalSynergyType } from '../../types';
import { MOB_ELEMENTAL_AFFINITIES, MobElementalAffinity } from '../../data/combatProgressionData';

export interface EntityStatusRecord {
  frozen: number;      // remaining duration (s)
  chilled: number;
  burning: number;
  burnStacks: number;
  shocked: number;
  poisoned: number;
  vulnerable: number;
}

export interface SynergyCheckResult {
  synergyTriggered?: ElementalSynergyEvent;
  modifiedDamage: number;
  appliedStatus?: string;
  bonusFloatingTags?: { tag: string; color: string }[];
}

export class ElementalSynergyEngine {
  private entityStatuses: Map<string, EntityStatusRecord> = new Map();

  public getStatus(entityId: string): EntityStatusRecord {
    let status = this.entityStatuses.get(entityId);
    if (!status) {
      status = {
        frozen: 0,
        chilled: 0,
        burning: 0,
        burnStacks: 0,
        shocked: 0,
        poisoned: 0,
        vulnerable: 0,
      };
      this.entityStatuses.set(entityId, status);
    }
    return status;
  }

  public applyStatus(
    entityId: string,
    statusType: 'frozen' | 'chilled' | 'burning' | 'shocked' | 'poisoned' | 'vulnerable',
    duration: number,
    stacks = 1
  ): void {
    const status = this.getStatus(entityId);
    if (statusType === 'frozen') {
      status.frozen = Math.max(status.frozen, duration);
    } else if (statusType === 'chilled') {
      status.chilled = Math.max(status.chilled, duration);
    } else if (statusType === 'burning') {
      status.burning = Math.max(status.burning, duration);
      status.burnStacks = Math.min(5, (status.burnStacks || 0) + stacks);
    } else if (statusType === 'shocked') {
      status.shocked = Math.max(status.shocked, duration);
    } else if (statusType === 'poisoned') {
      status.poisoned = Math.max(status.poisoned, duration);
    } else if (statusType === 'vulnerable') {
      status.vulnerable = Math.max(status.vulnerable, duration);
    }
  }

  public update(delta: number, onDotTick?: (entityId: string, damage: number, type: string, color: string) => void): void {
    this.entityStatuses.forEach((status, entityId) => {
      if (status.frozen > 0) status.frozen = Math.max(0, status.frozen - delta);
      if (status.chilled > 0) status.chilled = Math.max(0, status.chilled - delta);
      if (status.shocked > 0) status.shocked = Math.max(0, status.shocked - delta);
      if (status.vulnerable > 0) status.vulnerable = Math.max(0, status.vulnerable - delta);

      // Process Burning DoT
      if (status.burning > 0) {
        status.burning = Math.max(0, status.burning - delta);
        if (Math.random() < delta * 1.5) { // periodic tick
          const dotDmg = Math.round(18 * (status.burnStacks || 1));
          onDotTick?.(entityId, dotDmg, 'burning', '#ef4444');
        }
        if (status.burning === 0) status.burnStacks = 0;
      }

      // Process Poison DoT
      if (status.poisoned > 0) {
        status.poisoned = Math.max(0, status.poisoned - delta);
        if (Math.random() < delta * 1.5) {
          onDotTick?.(entityId, 14, 'poisoned', '#22c55e');
        }
      }
    });
  }

  /**
   * Deterministic Combat Synergy Calculation:
   * Checks for element reactions and calculates elemental multipliers and synergy explosions
   */
  public processSkillHit(
    targetId: string,
    targetType: string,
    targetPos: { x: number; y: number; z: number },
    baseDamage: number,
    damageType: 'physical' | 'arcane' | 'fire' | 'frost' | 'electric' | 'nature',
    isHeavyImpact: boolean,
    isWeatherRainOrWet: boolean,
    nearbyEntitiesCallback?: (radius: number) => { id: string; x: number; z: number }[]
  ): SynergyCheckResult {
    const status = this.getStatus(targetId);
    const affinity: MobElementalAffinity = MOB_ELEMENTAL_AFFINITIES[targetType] || {
      physicalResist: 1.0,
      arcaneResist: 1.0,
      fireResist: 1.0,
      frostResist: 1.0,
      electricResist: 1.0,
      vulnerabilityLabel: 'Neutral',
      resistanceLabel: 'Neutral',
    };

    // Calculate base resistance factor
    let elementMult = 1.0;
    if (damageType === 'physical') elementMult = affinity.physicalResist;
    else if (damageType === 'arcane') elementMult = affinity.arcaneResist;
    else if (damageType === 'fire') elementMult = affinity.fireResist;
    else if (damageType === 'frost') elementMult = affinity.frostResist;
    else if (damageType === 'electric') elementMult = affinity.electricResist;

    let modifiedDamage = Math.round(baseDamage * elementMult);
    const tags: { tag: string; color: string }[] = [];
    let synergyEvent: ElementalSynergyEvent | undefined;

    // Vulnerability buff on target
    if (status.vulnerable > 0) {
      modifiedDamage = Math.round(modifiedDamage * 1.25);
      tags.push({ tag: 'VULNERABLE +25%', color: '#f59e0b' });
    }

    // Reaction 1: SHATTER (Frozen/Chilled + Heavy Physical Impact / Frost)
    if ((status.frozen > 0 || status.chilled > 0) && (isHeavyImpact || damageType === 'physical')) {
      const shatterBonus = Math.round(modifiedDamage * 0.65);
      modifiedDamage += shatterBonus;
      status.frozen = 0; // consume freeze
      status.chilled = 0;

      tags.push({ tag: '💥 SHATTER!', color: '#38bdf8' });

      // AoE Frost Shrapnel to nearby mobs
      const nearby = nearbyEntitiesCallback ? nearbyEntitiesCallback(6.0) : [];
      synergyEvent = {
        type: 'shatter',
        name: 'Frost Shatter Burst',
        color: '#38bdf8',
        damage: Math.round(shatterBonus * 0.75),
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
        targetCount: nearby.length,
      };
    }

    // Reaction 2: FIRESTORM (Burning + Physical Wind/Blast or Fire Impact)
    else if (status.burning > 0 && (damageType === 'fire' || isHeavyImpact)) {
      const burnDmgBonus = Math.round(modifiedDamage * 0.35);
      modifiedDamage += burnDmgBonus;
      tags.push({ tag: '🔥 FIRESTORM!', color: '#f97316' });

      const nearby = nearbyEntitiesCallback ? nearbyEntitiesCallback(5.5) : [];
      // Spread burning to all nearby targets
      nearby.forEach((m) => {
        if (m.id !== targetId) {
          this.applyStatus(m.id, 'burning', 5.0, 2);
        }
      });

      synergyEvent = {
        type: 'firestorm',
        name: 'Firestorm Conflagration',
        color: '#f97316',
        damage: Math.round(burnDmgBonus * 0.8),
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
        targetCount: nearby.length,
      };
    }

    // Reaction 3: CHAIN DISCHARGE (Shocked or Rain/Wet + Electric)
    else if ((status.shocked > 0 || isWeatherRainOrWet) && damageType === 'electric') {
      const shockBonus = Math.round(modifiedDamage * 0.45);
      modifiedDamage += shockBonus;
      tags.push({ tag: '⚡ CHAIN DISCHARGE!', color: '#00f0ff' });

      const nearby = nearbyEntitiesCallback ? nearbyEntitiesCallback(7.0) : [];
      synergyEvent = {
        type: 'chain_discharge',
        name: 'Aether Chain Arc',
        color: '#00f0ff',
        damage: Math.round(modifiedDamage * 0.5),
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
        targetCount: Math.min(3, nearby.length),
      };
    }

    // Apply status effects based on incoming skill damage type
    if (damageType === 'frost') {
      this.applyStatus(targetId, 'chilled', 4.5);
    } else if (damageType === 'fire') {
      this.applyStatus(targetId, 'burning', 6.0, 1);
    } else if (damageType === 'electric') {
      this.applyStatus(targetId, 'shocked', 5.0);
    }

    return {
      synergyTriggered: synergyEvent,
      modifiedDamage,
      bonusFloatingTags: tags,
    };
  }

  public clear(): void {
    this.entityStatuses.clear();
  }
}

export const elementalSynergyEngine = new ElementalSynergyEngine();
