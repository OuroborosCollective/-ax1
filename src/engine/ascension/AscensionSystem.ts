/**
 * Echoes of Aurion - Longterm Ascension (Endgame Paragon / Transcendent Leveling System)
 * 
 * Provides an infinite, deterministic progression curve beyond standard character milestones:
 * - Deterministic XP scaling curve with exponential diminishing returns per rank
 * - Celestial Talent Matrix across 4 specialized categories (Power, Defense, Utility, Transcendent)
 * - Prestige Titles reflecting deep commitment and milestone thresholds
 * - Dynamic attribute recalculation applied seamlessly onto PlayerStats
 */

import { AscensionTalent, CharacterAttributes, PlayerStats } from '../../types';

export const MAX_STANDARD_LEVEL = 25; // Base game cap before pure Ascension unlocks

export interface AscensionTalentDef extends AscensionTalent {
  applyBonus: (stats: PlayerStats, rank: number) => void;
}

export const ASCENSION_TALENTS_DATABASE: AscensionTalentDef[] = [
  // === CATEGORY: POWER ===
  {
    id: 'celestial_might',
    name: 'Celestial Might',
    category: 'power',
    description: 'Channels primordial energy through physical strikes, augmenting raw weapon power.',
    icon: 'Sword',
    color: '#f59e0b',
    currentRank: 0,
    maxRank: 50,
    statBonusPerRank: '+3.5 Attack Power',
    applyBonus: (stats, rank) => {
      stats.attackPower += rank * 3.5;
    },
  },
  {
    id: 'aether_overload',
    name: 'Aether Overload',
    category: 'power',
    description: 'Increases spell resonance and arcane output with every focused pulse.',
    icon: 'Sparkles',
    color: '#06b6d4',
    currentRank: 0,
    maxRank: 50,
    statBonusPerRank: '+4.0 Spell Power',
    applyBonus: (stats, rank) => {
      stats.spellPower += rank * 4.0;
    },
  },
  {
    id: 'fatal_resonance',
    name: 'Fatal Resonance',
    category: 'power',
    description: 'Hones strike precision, uncovering crystalline fracture points in enemy armor.',
    icon: 'Crosshair',
    color: '#ef4444',
    currentRank: 0,
    maxRank: 30,
    statBonusPerRank: '+0.5% Critical Strike Chance',
    applyBonus: (stats, rank) => {
      stats.critChance += rank * 0.5;
    },
  },

  // === CATEGORY: DEFENSE ===
  {
    id: 'titan_aegis',
    name: 'Titan Aegis',
    category: 'defense',
    description: 'Hardens the physical form with ancient honey-stone density.',
    icon: 'Shield',
    color: '#eab308',
    currentRank: 0,
    maxRank: 50,
    statBonusPerRank: '+12 Armor',
    applyBonus: (stats, rank) => {
      stats.armor += rank * 12;
    },
  },
  {
    id: 'vital_surge',
    name: 'Vital Surge',
    category: 'defense',
    description: 'Fortifies biological stamina and leylink vitality, expanding maximum health.',
    icon: 'Heart',
    color: '#10b981',
    currentRank: 0,
    maxRank: 50,
    statBonusPerRank: '+85 Maximum Health',
    applyBonus: (stats, rank) => {
      stats.maxHp += rank * 85;
      stats.hp = Math.min(stats.hp + rank * 85, stats.maxHp);
    },
  },
  {
    id: 'kinetic_deflection',
    name: 'Kinetic Deflection',
    category: 'defense',
    description: 'Displaces kinetic inertia into the midnight void, increasing evasive reaction.',
    icon: 'Wind',
    color: '#3b82f6',
    currentRank: 0,
    maxRank: 25,
    statBonusPerRank: '+0.4% Dodge Chance',
    applyBonus: (stats, rank) => {
      stats.dodgeChance += rank * 0.4;
    },
  },

  // === CATEGORY: UTILITY ===
  {
    id: 'leyline_stride',
    name: 'Leyline Stride',
    category: 'utility',
    description: 'Attunes footwear to magnetic ley currents, accelerating ground traverse speed.',
    icon: 'FastForward',
    color: '#14b8a6',
    currentRank: 0,
    maxRank: 30,
    statBonusPerRank: '+0.8% Movement Speed',
    applyBonus: (stats, rank) => {
      stats.moveSpeedMultiplier += rank * 0.008;
      stats.moveSpeed = 7.2 * stats.moveSpeedMultiplier;
    },
  },
  {
    id: 'resource_harmony',
    name: 'Resource Harmony',
    category: 'utility',
    description: 'Deepens the pool of internal combat catalysts (Mana / Steam / Energy).',
    icon: 'Zap',
    color: '#a855f7',
    currentRank: 0,
    maxRank: 40,
    statBonusPerRank: '+15 Max Resource',
    applyBonus: (stats, rank) => {
      stats.maxResource += rank * 15;
      stats.resource = Math.min(stats.resource + rank * 15, stats.maxResource);
    },
  },
  {
    id: 'fortune_seeker',
    name: 'Fortune Seeker',
    category: 'utility',
    description: 'Magnetizes bronze remnants and rare item frequency from defeated world threats.',
    icon: 'Coins',
    color: '#fbbf24',
    currentRank: 0,
    maxRank: 50,
    statBonusPerRank: '+2% Gold & Mastery Bonus',
    applyBonus: (_stats, _rank) => {
      // Applied directly on kill/loot generation
    },
  },

  // === CATEGORY: CELESTIAL (INFINITE ENDGAME PARAGON) ===
  {
    id: 'aurion_transcendence',
    name: 'Aurion Transcendence',
    category: 'celestial',
    description: 'The limitless realm of the Ancients. Uncapped scaling for eternity.',
    icon: 'Crown',
    color: '#00f0ff',
    currentRank: 0,
    maxRank: 999,
    statBonusPerRank: '+2 All Power, +40 HP, +5 Armor per rank',
    applyBonus: (stats, rank) => {
      stats.attackPower += rank * 2.0;
      stats.spellPower += rank * 2.0;
      stats.maxHp += rank * 40;
      stats.armor += rank * 5;
    },
  },
];

export class AscensionSystem {
  /**
   * Deterministic XP Curve for Longterm Ascension Levels:
   * Level 1: 5,000 XP
   * Level 10: ~14,000 XP
   * Level 50: ~1,400,000 XP
   * Level 100: ~400,000,000 XP
   */
  public static calculateMaxXpForLevel(ascensionLevel: number): number {
    const lvl = Math.max(1, ascensionLevel);
    // Base 5,000 with a gentle 1.115 growth curve
    return Math.floor(5000 * Math.pow(1.115, lvl - 1));
  }

  /**
   * Evaluates prestige title associated with current Ascension rank.
   */
  public static getPrestigeTitle(ascensionLevel: number): string {
    if (ascensionLevel <= 0) return 'Mortal Wanderer';
    if (ascensionLevel < 5) return 'Aether Initiate';
    if (ascensionLevel < 15) return 'Leyline Ascendant';
    if (ascensionLevel < 30) return 'Skyforge Paragon';
    if (ascensionLevel < 50) return 'Eternal Vanguard';
    if (ascensionLevel < 75) return 'Celestial Sovereign';
    if (ascensionLevel < 100) return 'Empyrean Demigod';
    return `Transcendent of Aurion (Rank ${ascensionLevel})`;
  }

  /**
   * Awards experience to player, automatically overflowing into the Longterm Ascension progression
   * once standard max level is reached or if already ascended.
   */
  public static awardExperience(
    stats: PlayerStats,
    xpGained: number
  ): {
    standardLevelUp: boolean;
    ascensionLevelUp: boolean;
    newAscensionLevel: number;
    pointsAwarded: number;
  } {
    let standardLevelUp = false;
    let ascensionLevelUp = false;
    let pointsAwarded = 0;

    // Ensure talent dictionary is initialized
    if (!stats.ascensionTalents) {
      stats.ascensionTalents = {};
    }

    if (stats.level < MAX_STANDARD_LEVEL) {
      // Normal progression towards level cap
      stats.xp += xpGained;
      while (stats.xp >= stats.maxXp && stats.level < MAX_STANDARD_LEVEL) {
        stats.xp -= stats.maxXp;
        stats.level++;
        stats.maxXp = Math.floor(stats.maxXp * 1.35);
        stats.statPoints = (stats.statPoints || 0) + 5;
        standardLevelUp = true;
      }

      // If just hit cap, convert any excess XP directly into first Ascension rank!
      if (stats.level >= MAX_STANDARD_LEVEL) {
        stats.ascensionLevel = Math.max(1, stats.ascensionLevel || 1);
        stats.ascensionMaxXp = this.calculateMaxXpForLevel(stats.ascensionLevel);
        stats.prestigeTitle = this.getPrestigeTitle(stats.ascensionLevel);
      }
    } else {
      // Longterm Endlich / Endgame Ascension Mode Active!
      stats.ascensionLevel = Math.max(1, stats.ascensionLevel || 1);
      stats.ascensionMaxXp = stats.ascensionMaxXp || this.calculateMaxXpForLevel(stats.ascensionLevel);

      stats.ascensionXp = (stats.ascensionXp || 0) + xpGained;

      while (stats.ascensionXp >= stats.ascensionMaxXp) {
        stats.ascensionXp -= stats.ascensionMaxXp;
        stats.ascensionLevel++;
        stats.ascensionPoints = (stats.ascensionPoints || 0) + 1;
        pointsAwarded++;
        ascensionLevelUp = true;

        stats.ascensionMaxXp = this.calculateMaxXpForLevel(stats.ascensionLevel);
        stats.prestigeTitle = this.getPrestigeTitle(stats.ascensionLevel);
      }
    }

    return {
      standardLevelUp,
      ascensionLevelUp,
      newAscensionLevel: stats.ascensionLevel || 0,
      pointsAwarded,
    };
  }

  /**
   * Allocates an Ascension Point into a celestial talent node.
   */
  public static allocateTalent(
    stats: PlayerStats,
    talentId: string
  ): { success: boolean; message: string } {
    if ((stats.ascensionPoints || 0) <= 0) {
      return { success: false, message: 'No Ascension Points remaining to allocate.' };
    }

    const talentDef = ASCENSION_TALENTS_DATABASE.find((t) => t.id === talentId);
    if (!talentDef) {
      return { success: false, message: 'Invalid talent identifier.' };
    }

    if (!stats.ascensionTalents) {
      stats.ascensionTalents = {};
    }

    const currentRank = stats.ascensionTalents[talentId] || 0;
    if (currentRank >= talentDef.maxRank) {
      return { success: false, message: `${talentDef.name} has already reached maximum rank (${talentDef.maxRank}).` };
    }

    // Deduct point and increment rank
    stats.ascensionPoints--;
    stats.ascensionTalents[talentId] = currentRank + 1;

    // Recalculate all stats from baseline
    this.recalculateAscensionBonuses(stats);

    return {
      success: true,
      message: `Allocated 1 Ascension Point into ${talentDef.name} (Rank ${currentRank + 1}/${talentDef.maxRank}).`,
    };
  }

  /**
   * Resets all allocated ascension points, returning them to the pool.
   */
  public static respecTalents(stats: PlayerStats): { refundedPoints: number } {
    if (!stats.ascensionTalents) {
      return { refundedPoints: 0 };
    }

    let totalPoints = 0;
    for (const key of Object.keys(stats.ascensionTalents)) {
      totalPoints += stats.ascensionTalents[key] || 0;
      stats.ascensionTalents[key] = 0;
    }

    stats.ascensionPoints = (stats.ascensionPoints || 0) + totalPoints;
    this.recalculateAscensionBonuses(stats);

    return { refundedPoints: totalPoints };
  }

  /**
   * Reapplies all talent bonuses onto player attributes.
   */
  public static recalculateAscensionBonuses(stats: PlayerStats): void {
    if (!stats.ascensionTalents) return;

    for (const talentDef of ASCENSION_TALENTS_DATABASE) {
      const rank = stats.ascensionTalents[talentDef.id] || 0;
      if (rank > 0) {
        talentDef.applyBonus(stats, rank);
      }
    }
  }

  /**
   * Returns a copy of all talent definitions merged with the player's current ranks.
   */
  public static getPlayerTalentTree(stats: PlayerStats): AscensionTalent[] {
    const ranks = stats.ascensionTalents || {};
    return ASCENSION_TALENTS_DATABASE.map((t) => ({
      ...t,
      currentRank: ranks[t.id] || 0,
    }));
  }
}
