export interface StatModifier {
  stat: 'attack' | 'defense' | 'moveSpeed' | 'critChance' | 'spellPower';
  type: 'add' | 'mult';
  value: number; // e.g. +20 or 1.15
}

export interface ActiveBuff {
  id: string;
  name: string;
  icon: string;
  color: string;
  duration: number;
  maxDuration: number;
  stacks: number;
  maxStacks: number;
  modifiers: StatModifier[];
  tickInterval?: number;
  tickTimer?: number;
  onTick?: (entityId: string, stacks: number) => { damage?: number; heal?: number };
}

export class BuffDebuffSystem {
  private entityBuffs: Map<string, Map<string, ActiveBuff>> = new Map();

  /**
   * Apply or refresh a buff/debuff
   */
  public applyBuff(entityId: string, buffDef: Omit<ActiveBuff, 'stacks'> & { initialStacks?: number }): void {
    let buffs = this.entityBuffs.get(entityId);
    if (!buffs) {
      buffs = new Map();
      this.entityBuffs.set(entityId, buffs);
    }

    const existing = buffs.get(buffDef.id);
    if (existing) {
      // Refresh duration and stack
      existing.duration = buffDef.maxDuration;
      existing.stacks = Math.min(existing.maxStacks, existing.stacks + (buffDef.initialStacks || 1));
    } else {
      buffs.set(buffDef.id, {
        ...buffDef,
        stacks: buffDef.initialStacks || 1,
        tickTimer: buffDef.tickInterval || 0,
      });
    }
  }

  public removeBuff(entityId: string, buffId: string): void {
    const buffs = this.entityBuffs.get(entityId);
    buffs?.delete(buffId);
  }

  /**
   * Update active buffs, process durations and periodic DoT/HoT ticks
   */
  public update(
    delta: number,
    onEntityTickEffect?: (entityId: string, effect: { damage?: number; heal?: number; color: string }) => void
  ): void {
    this.entityBuffs.forEach((buffs, entityId) => {
      const expired: string[] = [];

      buffs.forEach((buff) => {
        buff.duration -= delta;

        // Process periodic tick
        if (buff.tickInterval && buff.onTick) {
          buff.tickTimer = (buff.tickTimer || 0) + delta;
          if (buff.tickTimer >= buff.tickInterval) {
            buff.tickTimer -= buff.tickInterval;
            const res = buff.onTick(entityId, buff.stacks);
            if (res.damage || res.heal) {
              onEntityTickEffect?.(entityId, { ...res, color: buff.color });
            }
          }
        }

        if (buff.duration <= 0) {
          expired.push(buff.id);
        }
      });

      for (const id of expired) {
        buffs.delete(id);
      }
    });
  }

  /**
   * Calculates modified stat with Additive and Multiplicative stages
   */
  public calculateModifiedStat(
    entityId: string,
    statName: 'attack' | 'defense' | 'moveSpeed' | 'critChance' | 'spellPower',
    baseValue: number
  ): number {
    const buffs = this.entityBuffs.get(entityId);
    if (!buffs || buffs.size === 0) return baseValue;

    let additiveBonus = 0;
    let multiplicativeFactor = 1.0;

    buffs.forEach((buff) => {
      for (const mod of buff.modifiers) {
        if (mod.stat === statName) {
          if (mod.type === 'add') {
            additiveBonus += mod.value * buff.stacks;
          } else if (mod.type === 'mult') {
            // e.g. 1.15 (+15%)
            multiplicativeFactor *= Math.pow(mod.value, buff.stacks);
          }
        }
      }
    });

    return (baseValue + additiveBonus) * multiplicativeFactor;
  }

  public getActiveBuffs(entityId: string): ActiveBuff[] {
    const buffs = this.entityBuffs.get(entityId);
    return buffs ? Array.from(buffs.values()) : [];
  }

  public clear(entityId: string): void {
    this.entityBuffs.delete(entityId);
  }
}

export const buffSystem = new BuffDebuffSystem();
