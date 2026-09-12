/**
 * Aurion Classless Skill & Mastery Progression Engine
 *
 * Implements RuneScape-style learning-by-doing across:
 * - Weapon Masteries (Blades, Greatswords, Daggers, Warhammers, Bows, Rifles, Staves, Arcane)
 * - Armor Schools (Heavy Plate, Medium Leather, Light Cloth, Shields)
 * - Gathering & Farming Skills (Woodcutting, Mining, Farming, Herbalism, Fishing, Hunting)
 * - Crafting Disciplines (Blacksmith, Alchemist, Tailor, Leatherworker, Carpenter, Enchanter)
 *
 * Golden Rule:
 * Every 10-level milestone:
 * - Skill Impact / Output improves by +0.1 (+10%)
 * - Crafting disciplines gain a +0.1 (10%) chance to craft a second / duplicate item
 */

export interface SkillMilestoneStats {
  level: number;
  /** Decimal bonus (e.g. 0.1 at lv 10, 0.2 at lv 20, 1.0 at lv 100) */
  bonusRate: number;
  /** Formatted percentage string, e.g. "+20%" */
  percentString: string;
  /** Next 10-level milestone tier (10, 20, 30... 100) */
  nextMilestone: number;
  /** Levels remaining until next milestone */
  levelsToNext: number;
}

/**
 * Calculates the +0.1 (+10%) impact/output milestone scaling for any uncapped 0-unlimited skill.
 */
export function getSkillMilestoneStats(level: number): SkillMilestoneStats {
  const safeLevel = Math.max(0, Math.floor(level || 0));
  const completedTiers = Math.floor(safeLevel / 10);
  const bonusRate = completedTiers * 0.1;
  const nextMilestone = (completedTiers + 1) * 10;
  const levelsToNext = Math.max(0, nextMilestone - safeLevel);

  return {
    level: safeLevel,
    bonusRate,
    percentString: `+${Math.round(bonusRate * 100)}%`,
    nextMilestone,
    levelsToNext,
  };
}

export interface ThresholdProgressData {
  level: number;
  completedThresholds: number;
  impactBonusPercent: number; // 0.1% per 10 levels
  impactBonusString: string; // e.g. "+0.3%"
  nextThresholdLevel: number; // e.g. 40
  nextImpactBonusString: string; // e.g. "+0.4%"
  levelsToNextThreshold: number;
  cycleProgressPercent: number; // 0-100% within current 10-level bracket
}

/**
 * Calculates the uncapped 0-unlimited 10-level threshold markers and +0.1% impact bonus.
 */
export function getUncappedThresholdData(level: number): ThresholdProgressData {
  const safeLevel = Math.max(0, Math.floor(level || 0));
  const completedThresholds = Math.floor(safeLevel / 10);
  const impactBonusPercent = Number((completedThresholds * 0.1).toFixed(1));
  const nextThresholdLevel = (completedThresholds + 1) * 10;
  const nextImpactBonus = Number(((completedThresholds + 1) * 0.1).toFixed(1));
  const levelsToNextThreshold = nextThresholdLevel - safeLevel;
  const cycleProgressPercent = Math.min(100, Math.max(0, ((safeLevel % 10) / 10) * 100));

  return {
    level: safeLevel,
    completedThresholds,
    impactBonusPercent,
    impactBonusString: `+${impactBonusPercent.toFixed(1)}%`,
    nextThresholdLevel,
    nextImpactBonusString: `+${nextImpactBonus.toFixed(1)}%`,
    levelsToNextThreshold,
    cycleProgressPercent,
  };
}

/**
 * Calculates the duplicate craft probability for crafting professions:
 * 0% at Lv 1-9
 * 10% (0.1) at Lv 10-19
 * 20% (0.2) at Lv 20-29
 * ...
 * 50% (0.5) at Lv 50-59
 * 100% (1.0) at Lv 100
 */
export function getCraftingDuplicateChance(level: number): {
  chance: number;
  percentage: number;
  percentString: string;
  nextTierLevel: number;
} {
  const stats = getSkillMilestoneStats(level);
  return {
    chance: stats.bonusRate,
    percentage: Math.round(stats.bonusRate * 100),
    percentString: `${Math.round(stats.bonusRate * 100)}%`,
    nextTierLevel: stats.nextMilestone,
  };
}

/**
 * Calculates the gathering / farming yield multiplier (+10% per 10 levels).
 */
export function getGatheringYieldMultiplier(level: number): {
  multiplier: number;
  extraPercent: number;
} {
  const stats = getSkillMilestoneStats(level);
  return {
    multiplier: 1.0 + stats.bonusRate,
    extraPercent: Math.round(stats.bonusRate * 100),
  };
}

/**
 * Calculates combat weapon & spell damage multiplier (+10% per 10 levels).
 */
export function getCombatMasteryMultiplier(level: number): {
  damageMultiplier: number;
  bonusPercent: number;
} {
  const stats = getSkillMilestoneStats(level);
  return {
    damageMultiplier: 1.0 + stats.bonusRate,
    bonusPercent: Math.round(stats.bonusRate * 100),
  };
}

/**
 * Calculates armor damage absorption & defensive efficiency (+10% per 10 levels).
 */
export function getArmorEfficiencyMultiplier(level: number): {
  reductionBonus: number;
  bonusPercent: number;
} {
  const stats = getSkillMilestoneStats(level);
  return {
    reductionBonus: stats.bonusRate,
    bonusPercent: Math.round(stats.bonusRate * 100),
  };
}
