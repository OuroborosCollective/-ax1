/**
 * ArelorianLinguaGrammar.ts
 *
 * Deterministic ConLang Grammar, Procedural CFG Dialogue Engine,
 * and Deterministic Semantic Event-Word Association Learning for Echoes of Aurion.
 *
 * Implements:
 * 1. Arelorian Runic ConLang Lexicon & Glyph Transliteration
 * 2. Context-Free Grammar (CFG) for Dynamic NPC Role & Posture Dialogues
 * 3. Deterministic Event-Word Association Matrix (Learning semantic threat/trust correlations)
 * 4. Real-time Player Chat & Intent Analysis with NPC Reactive Posture Adjustments
 */

import { sha256Hex } from '../math/DeterministicHash';

export type LinguaEventType =
  | 'COMBAT_ATTACK'
  | 'RAID_THEFT'
  | 'TRADE_COMMERCE'
  | 'PEACE_GREETING'
  | 'THREAT_TAUNT'
  | 'QUEST_LORE';

export interface SemanticWordProfile {
  word: string;
  totalOccurrences: number;
  eventCounts: Record<LinguaEventType, number>;
  threatScore: number;    // -100 (Deep Peace/Trust) to +100 (Hostile/Raid Threat)
  commerceScore: number;  // 0 to 100
  lastObservedTick: number;
}

export interface PlayerUtteranceAnalysis {
  rawText: string;
  normalizedTokens: string[];
  inferredThreatLevel: number;    // -100 to +100
  inferredCommerceLevel: number;  // 0 to 100
  dominantEventType: LinguaEventType;
  learnedWordMatches: Array<{ word: string; threat: number; occurrences: number }>;
  recommendedNpcPosture: 'DEFENSIVE' | 'FRIENDLY' | 'SUSPICIOUS' | 'NEUTRAL' | 'ALERT_GUARDS';
  arelorianTranslation: string;
}

export interface NPCDialogueOutput {
  speakerName: string;
  role: 'guard' | 'merchant' | 'mystic' | 'citizen';
  posture: 'DEFENSIVE' | 'FRIENDLY' | 'SUSPICIOUS' | 'NEUTRAL' | 'ALERT_GUARDS';
  dialogueText: string;
  runicSubtext: string;
  appliedThreatModifier: number;
  priceModifierPercent: number; // e.g. +25% if suspicious, -10% if exalted trust
}

// ---------------------------------------------------------------------------
// 1. Arelorian Runic ConLang Lexicon
// ---------------------------------------------------------------------------

export const ARELORIAN_RUNES: Record<string, string> = {
  a: 'ᚨ', b: 'ᛒ', c: 'ᚲ', d: 'ᛞ', e: 'ᛖ', f: 'ᚠ', g: 'ᚷ', h: 'ᚺ',
  i: 'ᛁ', j: 'ᛃ', k: 'ᚲ', l: 'ᛚ', m: 'ᛗ', n: 'ᚾ', o: 'ᛟ', p: 'ᛈ',
  q: 'ᛩ', r: 'ᚱ', s: 'ᛋ', t: 'ᛏ', u: 'ᚢ', v: 'ᚡ', w: 'ᚹ', x: 'ᛪ',
  y: 'ᛇ', z: 'ᛉ', ä: 'ᚨᛖ', ö: 'ᛟᛖ', ü: 'ᚢᛖ', ß: 'ᛋᛋ', ' ': ' • '
};

export const ARELORIAN_ROOT_GLOSSARY: Record<string, { arelorian: string; glyph: string; meaning: string }> = {
  aurion: { arelorian: 'Aur-Iôn', glyph: 'ᚨᚢᚱ-ᛁᛟᚾ', meaning: 'The Eternal Golden Realm' },
  angriff: { arelorian: 'Vex-Krag', glyph: 'ᚡᛖᛪ-ᚲᚱᚨᚷ', meaning: 'Aggression / Strike' },
  kampf: { arelorian: 'Kael-Mor', glyph: 'ᚲᚨᛖᛚ-ᛗᛟᚱ', meaning: 'Combat / Energy Clash' },
  handel: { arelorian: 'Thar-Vel', glyph: 'ᚦᚨᚱ-ᚡᛖᛚ', meaning: 'Trade / Exchange' },
  gold: { arelorian: 'Aur-Lek', glyph: 'ᚨᚢᚱ-ᛚᛖᚲ', meaning: 'Gold / Sun Metal' },
  beute: { arelorian: 'Zul-Drak', glyph: 'ᛉᚢᛚ-ᛞᚱᚨᚲ', meaning: 'Loot / Seized Wealth' },
  raub: { arelorian: 'Zul-Kael', glyph: 'ᛉᚢᛚ-ᚲᚨᛖᛚ', meaning: 'Raid / Plunder' },
  frieden: { arelorian: 'Sol-Arel', glyph: 'ᛋᛟᛚ-ᚨᚱᛖᛚ', meaning: 'Harmony / Peace' },
  wache: { arelorian: 'Kael-Vanguard', glyph: 'ᚲᚨᛖᛚ-ᚡᚨᚾ', meaning: 'Sentinel Shield' },
  gefahr: { arelorian: 'Vex-Vur', glyph: 'ᚡᛖᛪ-ᚡᚢᚱ', meaning: 'Peril / Warning' },
  tor: { arelorian: 'Oros-Pyl', glyph: 'ᛟᚱᛟᛋ-ᛈᛇᛚ', meaning: 'Threshold Gate' },
  danke: { arelorian: 'Bel-Aura', glyph: 'ᛒᛖᛚ-ᚨᚢᚱᚨ', meaning: 'Gratitude / Blessing' },
};

// ---------------------------------------------------------------------------
// 2. Deterministic Semantic Event-Word Learning Memory
// ---------------------------------------------------------------------------

export class DeterministicSemanticLearner {
  private static instance: DeterministicSemanticLearner | null = null;

  // Word -> Profile lookup
  private readonly vocabulary = new Map<string, SemanticWordProfile>();
  private readonly recentUtterances: Array<{ tick: number; text: string; inferredThreat: number }> = [];
  private readonly maxTrackedWords = 500;
  private readonly maxUtteranceHistory = 50;

  // Baseline seeds so NPCs recognize core domain concepts out of the box
  constructor() {
    this.seedBaselineVocabulary();
  }

  public static getInstance(): DeterministicSemanticLearner {
    if (!DeterministicSemanticLearner.instance) {
      DeterministicSemanticLearner.instance = new DeterministicSemanticLearner();
    }
    return DeterministicSemanticLearner.instance;
  }

  private seedBaselineVocabulary(): void {
    const baselines: Array<{ word: string; event: LinguaEventType; threat: number; commerce: number; count: number }> = [
      { word: 'angriff', event: 'COMBAT_ATTACK', threat: 85, commerce: 0, count: 5 },
      { word: 'attack', event: 'COMBAT_ATTACK', threat: 85, commerce: 0, count: 5 },
      { word: 'töten', event: 'COMBAT_ATTACK', threat: 95, commerce: 0, count: 5 },
      { word: 'kill', event: 'COMBAT_ATTACK', threat: 95, commerce: 0, count: 5 },
      { word: 'raub', event: 'RAID_THEFT', threat: 90, commerce: 10, count: 4 },
      { word: 'beute', event: 'RAID_THEFT', threat: 70, commerce: 20, count: 3 },
      { word: 'loot', event: 'RAID_THEFT', threat: 60, commerce: 30, count: 3 },
      { word: 'überfall', event: 'RAID_THEFT', threat: 90, commerce: 0, count: 4 },
      { word: 'handel', event: 'TRADE_COMMERCE', threat: -40, commerce: 85, count: 5 },
      { word: 'trade', event: 'TRADE_COMMERCE', threat: -40, commerce: 85, count: 5 },
      { word: 'kaufen', event: 'TRADE_COMMERCE', threat: -30, commerce: 80, count: 4 },
      { word: 'verkaufen', event: 'TRADE_COMMERCE', threat: -30, commerce: 80, count: 4 },
      { word: 'gold', event: 'TRADE_COMMERCE', threat: -10, commerce: 75, count: 4 },
      { word: 'preis', event: 'TRADE_COMMERCE', threat: -20, commerce: 80, count: 3 },
      { word: 'danke', event: 'PEACE_GREETING', threat: -80, commerce: 50, count: 6 },
      { word: 'hallo', event: 'PEACE_GREETING', threat: -60, commerce: 40, count: 6 },
      { word: 'frieden', event: 'PEACE_GREETING', threat: -90, commerce: 60, count: 6 },
      { word: 'peace', event: 'PEACE_GREETING', threat: -90, commerce: 60, count: 6 },
      { word: 'hilfe', event: 'PEACE_GREETING', threat: -30, commerce: 30, count: 4 },
      { word: 'portal', event: 'QUEST_LORE', threat: 0, commerce: 40, count: 4 },
      { word: 'turm', event: 'QUEST_LORE', threat: 0, commerce: 30, count: 4 },
      { word: 'aurion', event: 'QUEST_LORE', threat: -40, commerce: 50, count: 5 },
    ];

    for (const b of baselines) {
      this.recordWordEvent(b.word, b.event, 0, b.count);
    }
  }

  /**
   * Deterministically normalizes and tokenizes text.
   */
  public tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2);
  }

  /**
   * Learns and records word frequencies correlated with in-game events (attacks, raids, trades).
   */
  public recordWordEvent(word: string, eventType: LinguaEventType, tick: number, weight: number = 1): void {
    const cleanWord = word.toLowerCase().trim();
    if (!cleanWord || cleanWord.length < 2) return;

    let profile = this.vocabulary.get(cleanWord);
    if (!profile) {
      profile = {
        word: cleanWord,
        totalOccurrences: 0,
        eventCounts: {
          COMBAT_ATTACK: 0,
          RAID_THEFT: 0,
          TRADE_COMMERCE: 0,
          PEACE_GREETING: 0,
          THREAT_TAUNT: 0,
          QUEST_LORE: 0,
        },
        threatScore: 0,
        commerceScore: 0,
        lastObservedTick: tick,
      };
      this.vocabulary.set(cleanWord, profile);
    }

    profile.eventCounts[eventType] = (profile.eventCounts[eventType] || 0) + weight;
    profile.totalOccurrences += weight;
    profile.lastObservedTick = tick;

    // Recalculate deterministic threat & commerce scores based on empirical event ratios
    const total = profile.totalOccurrences;
    const combat = profile.eventCounts.COMBAT_ATTACK || 0;
    const raid = profile.eventCounts.RAID_THEFT || 0;
    const taunt = profile.eventCounts.THREAT_TAUNT || 0;
    const trade = profile.eventCounts.TRADE_COMMERCE || 0;
    const peace = profile.eventCounts.PEACE_GREETING || 0;

    // Threat = +100 for purely hostile to -100 for purely peaceful
    const hostileWeights = (combat * 1.0 + raid * 1.1 + taunt * 0.9);
    const peacefulWeights = (peace * 1.0 + trade * 0.5);
    const rawThreat = ((hostileWeights - peacefulWeights) / total) * 100;
    profile.threatScore = Math.max(-100, Math.min(100, Math.round(rawThreat)));

    // Commerce score (0 to 100)
    profile.commerceScore = Math.min(100, Math.round((trade / total) * 100));

    // Enforce memory bounds
    if (this.vocabulary.size > this.maxTrackedWords) {
      this.pruneOldestWord();
    }
  }

  /**
   * Learns from an entire player sentence uttered during a specific game event context.
   */
  public learnFromContextualUtterance(text: string, eventType: LinguaEventType, tick: number): void {
    const tokens = this.tokenize(text);
    for (const token of tokens) {
      this.recordWordEvent(token, eventType, tick, 1);
    }
  }

  /**
   * Evaluates a player chat input against the learned semantic matrix to determine
   * the player's apparent intent, threat level, and the recommended NPC reaction.
   */
  public analyzeUtterance(text: string, currentTick: number): PlayerUtteranceAnalysis {
    const tokens = this.tokenize(text);
    const matches: Array<{ word: string; threat: number; occurrences: number }> = [];

    let totalThreatAccumulator = 0;
    let totalCommerceAccumulator = 0;
    let matchedTokenCount = 0;

    const eventVoteCounts: Record<LinguaEventType, number> = {
      COMBAT_ATTACK: 0,
      RAID_THEFT: 0,
      TRADE_COMMERCE: 0,
      PEACE_GREETING: 0,
      THREAT_TAUNT: 0,
      QUEST_LORE: 0,
    };

    for (const token of tokens) {
      const profile = this.vocabulary.get(token);
      if (profile) {
        matches.push({
          word: token,
          threat: profile.threatScore,
          occurrences: profile.totalOccurrences,
        });
        totalThreatAccumulator += profile.threatScore;
        totalCommerceAccumulator += profile.commerceScore;
        matchedTokenCount++;

        // Accumulate event votes
        for (const [evt, count] of Object.entries(profile.eventCounts)) {
          eventVoteCounts[evt as LinguaEventType] += count;
        }
      }
    }

    const avgThreat = matchedTokenCount > 0 ? Math.round(totalThreatAccumulator / matchedTokenCount) : 0;
    const avgCommerce = matchedTokenCount > 0 ? Math.round(totalCommerceAccumulator / matchedTokenCount) : 0;

    // Determine dominant learned event
    let dominantEvent: LinguaEventType = 'QUEST_LORE';
    let maxVote = -1;
    for (const [evt, count] of Object.entries(eventVoteCounts)) {
      if (count > maxVote) {
        maxVote = count;
        dominantEvent = evt as LinguaEventType;
      }
    }

    // Determine recommended posture
    let posture: PlayerUtteranceAnalysis['recommendedNpcPosture'] = 'NEUTRAL';
    if (avgThreat >= 65) {
      posture = 'ALERT_GUARDS';
    } else if (avgThreat >= 35) {
      posture = 'DEFENSIVE';
    } else if (avgThreat >= 15) {
      posture = 'SUSPICIOUS';
    } else if (avgThreat <= -30) {
      posture = 'FRIENDLY';
    }

    const arelorianTranslation = this.transliterateToArelorian(text);

    const result: PlayerUtteranceAnalysis = {
      rawText: text,
      normalizedTokens: tokens,
      inferredThreatLevel: avgThreat,
      inferredCommerceLevel: avgCommerce,
      dominantEventType: dominantEvent,
      learnedWordMatches: matches,
      recommendedNpcPosture: posture,
      arelorianTranslation,
    };

    // Save to utterance history
    this.recentUtterances.push({ tick: currentTick, text, inferredThreat: avgThreat });
    if (this.recentUtterances.length > this.maxUtteranceHistory) {
      this.recentUtterances.shift();
    }

    return result;
  }

  /**
   * Generates a context-aware deterministic NPC response based on the speaker's role,
   * the analyzed player intent, and the learned threat posture.
   */
  public generateNPCReaction(
    speakerName: string,
    role: 'guard' | 'merchant' | 'mystic' | 'citizen',
    analysis: PlayerUtteranceAnalysis,
    seed: number = 42
  ): NPCDialogueOutput {
    const posture = analysis.recommendedNpcPosture;
    let dialogue = '';
    let runicSubtext = '';
    let priceMod = 0;
    let threatMod = 0;

    switch (role) {
      case 'guard': {
        if (posture === 'ALERT_GUARDS' || posture === 'DEFENSIVE') {
          dialogue = `⚔️ [Wache ${speakerName}] "Halt! Deine Worte klingen nach Raub und Klinge (${analysis.dominantEventType}). Hände an den Gürtel oder Aurions Sentinels schlagen zu!"`;
          runicSubtext = `ᚡᛖᛪ-ᚲᚱᚨᚷ! ᚲᚨᛖᛚ-ᚡᚨᚾ ᛋᛏᚱᛁᚲᛖ (Vex-Krag! Kael-Vanguard Strike)`;
          threatMod = +25;
        } else if (posture === 'SUSPICIOUS') {
          dialogue = `🛡️ [Wache ${speakerName}] "Ich behalte dich im Auge, Reisender. Keine Unruhe in den Mauern von Aurion."`;
          runicSubtext = `ᚡᛖᛪ-ᚡᚢᚱ • ᚨᚢᚱ-ᛁᛟᚾ (Vex-Vur • Aur-Iôn)`;
          threatMod = +10;
        } else if (posture === 'FRIENDLY') {
          dialogue = `✨ [Wache ${speakerName}] "Seid gegrüßt im Lichte von Aurion. Die Straßen sind sicher."`;
          runicSubtext = `ᛋᛟᛚ-ᚨᚱᛖᛚ • ᚨᚢᚱ-ᛁᛟᚾ (Sol-Arel • Aur-Iôn)`;
          threatMod = -10;
        } else {
          dialogue = `[Wache ${speakerName}] "Weitergehen, Bürger. Gesetz und Ordnung wachen."`;
          runicSubtext = `ᚲᚨᛖᛚ-ᚡᚨᚾ (Kael-Vanguard)`;
        }
        break;
      }

      case 'merchant': {
        if (posture === 'ALERT_GUARDS' || posture === 'DEFENSIVE') {
          dialogue = `⚖️ [Händler ${speakerName}] "Deine Drohgebärden verheißen nichts Gutes. Die Karawanen verlangen +40% Risikozuschlag!"`;
          runicSubtext = `ᛉᚢᛚ-ᚲᚨᛖᛚ! ᚦᚨᚱ-ᚡᛖᛚ +40% (Zul-Kael! Thar-Vel +40%)`;
          priceMod = 40;
        } else if (posture === 'SUSPICIOUS') {
          dialogue = `⚖️ [Händler ${speakerName}] "Ich spüre Argwohn in deinen Worten. +15% Sicherheitsgebühr bei diesem Handel."`;
          runicSubtext = `ᚡᛖᛪ-ᚡᚢᚱ • ᚦᚨᚱ-ᚡᛖᛚ (Vex-Vur • Thar-Vel)`;
          priceMod = 15;
        } else if (posture === 'FRIENDLY') {
          dialogue = `🪙 [Händler ${speakerName}] "Ein ehrenwerter Partner! Für Worte des Friedens gewähre ich dir 10% Rabatt auf unsere Waren."`;
          runicSubtext = `ᛒᛖᛚ-ᚨᚢᚱᚨ • ᚨᚢᚱ-ᛚᛖᚲ -10% (Bel-Aura • Aur-Lek -10%)`;
          priceMod = -10;
        } else {
          dialogue = `[Händler ${speakerName}] "Schau dir meine Waren an. Reines Handwerk aus dem Aschengewölbe."`;
          runicSubtext = `ᚦᚨᚱ-ᚡᛖᛚ (Thar-Vel)`;
        }
        break;
      }

      case 'mystic': {
        if (posture === 'ALERT_GUARDS' || posture === 'DEFENSIVE') {
          dialogue = `🔮 [Mystiker ${speakerName}] "Das Resonanzfeld trübt sich um dich. Die Leylinien spiegeln dein feindseliges Verlangen wider."`;
          runicSubtext = `ᛉᚢᛚ-ᛞᚱᚨᚲ • ᚲᚨᛖᛚ-ᛗᛟᚱ (Zul-Drak • Kael-Mor)`;
        } else if (posture === 'FRIENDLY') {
          dialogue = `🌌 [Mystiker ${speakerName}] "Deine Schwingung resoniert harmonisch mit den Altären des Windhains. Empfange den Segen der Astralen."`;
          runicSubtext = `ᛋᛟᛚ-ᚨᚱᛖᛚ • ᛟᚱᛟᛋ-ᛈᛇᛚ (Sol-Arel • Oros-Pyl)`;
        } else {
          dialogue = `[Mystiker ${speakerName}] "Die Runen flüstern von vergangenen Zeitaltern..."`;
          runicSubtext = `ᚨᚢᚱ-ᛁᛟᚾ • ᛟᚱᛟᛋ (Aur-Iôn • Oros)`;
        }
        break;
      }

      default: {
        if (posture === 'ALERT_GUARDS') {
          dialogue = `🏃 [Bürger ${speakerName}] "Hilfe! Wachen! Er spricht von Plünderung und Raub!"`;
          runicSubtext = `ᛉᚢᛚ-ᚲᚨᛖᛚ! ᚲᚨᛖᛚ-ᚡᚨᚾ! (Zul-Kael! Kael-Vanguard!)`;
        } else if (posture === 'FRIENDLY') {
          dialogue = `🌾 [Bürger ${speakerName}] "Guten Tag, Wanderer! Möge die Ernte der Expanse euch reich bescheren."`;
          runicSubtext = `ᛒᛖᛚ-ᚨᚢᚱᚨ (Bel-Aura)`;
        } else {
          dialogue = `[Bürger ${speakerName}] "Ein ruhiger Tag in den Ackerlanden."`;
          runicSubtext = `ᛋᛟᛚ-ᚨᚱᛖᛚ (Sol-Arel)`;
        }
        break;
      }
    }

    return {
      speakerName,
      role,
      posture,
      dialogueText: dialogue,
      runicSubtext,
      appliedThreatModifier: threatMod,
      priceModifierPercent: priceMod,
    };
  }

  /**
   * Transliterates text into phonetic Arelorian Runes and Glossary substitutions.
   */
  public transliterateToArelorian(text: string): string {
    const words = text.toLowerCase().split(/\s+/);
    const translatedWords = words.map((w) => {
      const clean = w.replace(/[^\p{L}]/gu, '');
      if (ARELORIAN_ROOT_GLOSSARY[clean]) {
        return `${ARELORIAN_ROOT_GLOSSARY[clean].glyph} (${ARELORIAN_ROOT_GLOSSARY[clean].arelorian})`;
      }
      return clean
        .split('')
        .map((char) => ARELORIAN_RUNES[char] || char)
        .join('');
    });
    return translatedWords.join(' • ');
  }

  /**
   * Returns diagnostic dump of learned word association profiles.
   */
  public getLearnedProfiles(): SemanticWordProfile[] {
    return Array.from(this.vocabulary.values()).sort((a, b) => b.totalOccurrences - a.totalOccurrences);
  }

  public getStats() {
    let hostileCount = 0;
    let peacefulCount = 0;
    let totalSamples = 0;

    for (const p of this.vocabulary.values()) {
      totalSamples += p.totalOccurrences;
      if (p.threatScore > 20) hostileCount++;
      if (p.threatScore < -20) peacefulCount++;
    }

    return {
      totalVocabularySize: this.vocabulary.size,
      totalSamplesRecorded: totalSamples,
      hostileLearnedCount: hostileCount,
      peacefulLearnedCount: peacefulCount,
      recentUtterancesCount: this.recentUtterances.length,
    };
  }

  private pruneOldestWord(): void {
    let oldestWord: string | null = null;
    let minOccurrences = Infinity;

    for (const [w, p] of this.vocabulary.entries()) {
      if (p.totalOccurrences < minOccurrences) {
        minOccurrences = p.totalOccurrences;
        oldestWord = w;
      }
    }

    if (oldestWord) {
      this.vocabulary.delete(oldestWord);
    }
  }
}

export const arelorianLingua = DeterministicSemanticLearner.getInstance();
