/**
 * DeterministicPRNG.ts
 *
 * Implements a high-quality, reproducible pseudo-random number generator (Mulberry32 algorithm).
 *
 * Replaces non-deterministic `Math.random()` in combat calculations, critical strike rolls,
 * loot distribution, and mob AI decisions, enabling bit-for-bit replayability
 * and authoritative server verification.
 */

export class DeterministicPRNG {
  private seed: number;

  constructor(initialSeed: number = 1337) {
    this.seed = initialSeed >>> 0;
  }

  public setSeed(newSeed: number): void {
    this.seed = newSeed >>> 0;
  }

  public getSeed(): number {
    return this.seed;
  }

  /**
   * Mulberry32 algorithm: 32-bit state generator with excellent statistical distribution.
   * Returns a deterministic float in range [0.0, 1.0).
   */
  public nextFloat(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a deterministic integer in range [min, max] inclusive.
   */
  public nextInt(min: number, max: number): number {
    return Math.floor(this.nextFloat() * (max - min + 1)) + min;
  }

  /**
   * Returns true if roll <= chancePercent (0 to 100).
   */
  public rollChance(chancePercent: number): boolean {
    return this.nextFloat() * 100.0 < chancePercent;
  }

  /**
   * Deterministisch wählt ein Element aus einem Array basierend auf Gewichten aus.
   */
  public rollWeighted<T>(items: { item: T; weight: number }[]): T | null {
    if (items.length === 0) return null;
    const totalWeight = items.reduce((acc, cur) => acc + cur.weight, 0);
    let roll = this.nextFloat() * totalWeight;

    for (const entry of items) {
      if (roll <= entry.weight) {
        return entry.item;
      }
      roll -= entry.weight;
    }

    return items[items.length - 1].item;
  }
}

export const deterministicRng = new DeterministicPRNG(424242);
