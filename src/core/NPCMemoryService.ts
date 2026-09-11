import {
  NPCCharacter,
  NPCDefensivePosture,
  NPCEmotionalContext,
  NPCInteractionFrequency,
  NPCRelationshipMemory,
} from '../types';
import { arelorianLingua, LinguaEventType } from '../engine/lingua/ArelorianLinguaGrammar';

export interface LearnedWordServerRecord {
  word: string;
  totalOccurrences: number;
  eventCounts: Record<string, number>;
  threatScore: number;
  commerceScore: number;
  lastObservedTick: number;
}

export interface WordEventTrainingPayload {
  eventType: LinguaEventType;
  utteranceText: string;
  combinedTokens: string[];
  threatDelta: number;
  commerceDelta: number;
  npcId?: string;
}

export class NPCMemoryService {
  private static instance: NPCMemoryService | null = null;
  private isServerSynced = false;
  private lastServerSyncTimestamp = 0;

  constructor() {
    this.initServerWordKnowledgeSync();
  }

  public static getInstance(): NPCMemoryService {
    if (!NPCMemoryService.instance) {
      NPCMemoryService.instance = new NPCMemoryService();
    }
    return NPCMemoryService.instance;
  }

  /**
   * Initializes and syncs word knowledge from the server dataset on startup.
   */
  public async initServerWordKnowledgeSync(): Promise<void> {
    try {
      const res = await fetch('/api/lingua/learned-words');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.learnedWords)) {
          for (const wordRecord of data.learnedWords as LearnedWordServerRecord[]) {
            // Seed server-learned vocabulary directly into Arelorian Lingua grammar
            const dominantEvent = (Object.entries(wordRecord.eventCounts || {}).sort(
              ([, a], [, b]) => b - a
            )[0]?.[0] || 'QUEST_LORE') as LinguaEventType;

            arelorianLingua.recordWordEvent(
              wordRecord.word,
              dominantEvent,
              wordRecord.lastObservedTick || 0,
              wordRecord.totalOccurrences || 1
            );
          }
          this.isServerSynced = true;
          this.lastServerSyncTimestamp = Date.now();
          console.log(
            `[NPCMemoryService] Successfully loaded ${data.learnedWords.length} global learned words from server training dataset.`
          );
        }
      }
    } catch (e) {
      console.warn('[NPCMemoryService] Server word knowledge sync operated in offline memory mode.');
    }
  }

  /**
   * Records an interaction event for an NPC, updates emotional context, interaction frequency,
   * recalculates affection rating, defensive posture, and discounts, and syncs word learning to server.
   */
  public processInteractionEvent(
    npc: NPCCharacter,
    eventType: 'attack' | 'trade' | 'crime' | 'chat',
    eventDetails?: {
      utteranceText?: string;
      goldAmount?: number;
      itemName?: string;
      damage?: number;
      sentimentScore?: number; // -100 (aggressive) to +100 (friendly)
    }
  ): NPCRelationshipMemory {
    const now = Date.now();

    // 1. Ensure Memory, InteractionFrequency, EmotionalContext exist
    if (!npc.memory) {
      npc.memory = {
        reputation: 0,
        timesInteracted: 0,
        tradesCompleted: 0,
        crimesWitnessed: 0,
        attacksSuffered: 0,
        totalGoldTraded: 0,
        dynamicDialogueHistory: [],
        customFlags: {},
      };
    }

    const memory = npc.memory;

    if (!memory.interactionFrequency) {
      memory.interactionFrequency = {
        totalInteractions: 0,
        lastInteractionTimestamp: now,
        interactionIntervalsAvgMs: 0,
        velocityCategory: 'first_contact',
        friendlyStreak: 0,
        aggressiveStreak: 0,
      };
    }

    if (!memory.emotionalContext) {
      memory.emotionalContext = {
        friendlyScore: 50,
        aggressiveScore: 0,
        dominantTone: 'neutral',
      };
    }

    const freq = memory.interactionFrequency;
    const emo = memory.emotionalContext;

    // 2. Update Interaction Frequency metrics
    freq.totalInteractions += 1;
    const timeSinceLast = freq.lastInteractionTimestamp ? now - freq.lastInteractionTimestamp : 0;
    freq.lastInteractionTimestamp = now;

    if (freq.totalInteractions > 1 && timeSinceLast > 0) {
      freq.interactionIntervalsAvgMs = Math.round(
        (freq.interactionIntervalsAvgMs * (freq.totalInteractions - 1) + timeSinceLast) /
          freq.totalInteractions
      );
    }

    // Velocity category
    if (freq.totalInteractions === 1) {
      freq.velocityCategory = 'first_contact';
    } else if (freq.interactionIntervalsAvgMs < 30000) {
      freq.velocityCategory = 'frequent';
    } else if (freq.interactionIntervalsAvgMs < 120000) {
      freq.velocityCategory = 'occasional';
    } else {
      freq.velocityCategory = 'rare';
    }

    // 3. Process Emotional Context & Streaks
    let emotionalDelta = 0;
    let linguaEventType: LinguaEventType = 'QUEST_LORE';

    if (eventType === 'attack') {
      linguaEventType = 'COMBAT_ATTACK';
      const dmgPenalty = eventDetails?.damage ? Math.min(40, Math.round(eventDetails.damage / 2)) : 25;
      emo.aggressiveScore = Math.min(100, emo.aggressiveScore + dmgPenalty);
      emo.friendlyScore = Math.max(0, emo.friendlyScore - dmgPenalty);
      freq.aggressiveStreak += 1;
      freq.friendlyStreak = 0;
      emotionalDelta = -dmgPenalty * 1.5;
    } else if (eventType === 'trade') {
      linguaEventType = 'TRADE_COMMERCE';
      const goldBonus = eventDetails?.goldAmount ? Math.min(25, Math.round(eventDetails.goldAmount / 10)) : 10;
      emo.friendlyScore = Math.min(100, emo.friendlyScore + goldBonus);
      emo.aggressiveScore = Math.max(0, emo.aggressiveScore - Math.round(goldBonus / 2));
      freq.friendlyStreak += 1;
      freq.aggressiveStreak = 0;
      emotionalDelta = goldBonus;
    } else if (eventType === 'crime') {
      linguaEventType = 'RAID_THEFT';
      emo.aggressiveScore = Math.min(100, emo.aggressiveScore + 20);
      emo.friendlyScore = Math.max(0, emo.friendlyScore - 15);
      freq.aggressiveStreak += 1;
      freq.friendlyStreak = 0;
      emotionalDelta = -30;
    } else if (eventType === 'chat') {
      const sentiment = eventDetails?.sentimentScore ?? 0;
      if (sentiment < -20) {
        linguaEventType = 'THREAT_TAUNT';
        emo.aggressiveScore = Math.min(100, emo.aggressiveScore + 15);
        freq.aggressiveStreak += 1;
        freq.friendlyStreak = 0;
        emotionalDelta = -15;
      } else if (sentiment > 20) {
        linguaEventType = 'PEACE_GREETING';
        emo.friendlyScore = Math.min(100, emo.friendlyScore + 15);
        freq.friendlyStreak += 1;
        freq.aggressiveStreak = 0;
        emotionalDelta = 15;
      }
    }

    // Dominant tone
    if (emo.aggressiveScore > emo.friendlyScore + 20) {
      emo.dominantTone = 'aggressive';
    } else if (emo.friendlyScore > emo.aggressiveScore + 20) {
      emo.dominantTone = 'friendly';
    } else {
      emo.dominantTone = 'neutral';
    }

    // 4. Shift Affection Rating (-100 to +100)
    const currentAffection = memory.affectionRating ?? npc.affectionRating ?? 0;
    // Streak multiplier bonus
    const streakBonus = freq.friendlyStreak > 2 ? freq.friendlyStreak * 2 : 0;
    const streakPenalty = freq.aggressiveStreak > 1 ? freq.aggressiveStreak * 5 : 0;

    const newAffection = Math.max(
      -100,
      Math.min(100, Math.round(currentAffection + emotionalDelta + streakBonus - streakPenalty))
    );

    memory.affectionRating = newAffection;
    npc.affectionRating = newAffection;

    // 5. Calculate Discount Percent & Defensive Posture
    const discount = this.calculateDiscountPercent(newAffection, memory.reputation);
    const posture = this.calculateDefensivePosture(newAffection, emo.dominantTone, memory.reputation);

    memory.activeDiscountPercent = discount;
    npc.activeDiscountPercent = discount;
    memory.defensivePosture = posture;
    npc.defensivePosture = posture;

    // Update Mood based on affection & posture
    if (posture === 'HOSTILE_STANCE' || newAffection <= -40) {
      npc.mood = 'hostile';
    } else if (posture === 'DEFENSIVE' || newAffection <= -10) {
      npc.mood = 'suspicious';
    } else if (posture === 'HEROIC_SALUTE' || newAffection >= 60) {
      npc.mood = 'ecstatic';
    } else if (posture === 'PEACEFUL' || newAffection >= 20) {
      npc.mood = 'friendly';
    } else {
      npc.mood = 'neutral';
    }

    // Direct NPC reference mirrors
    npc.memory = memory;
    npc.interactionFrequency = freq;
    npc.emotionalContext = emo;

    // Async sync NPC memory & event log to MariaDB backend
    this.syncNPCMemoryToServer('hero_player_1', npc.id, memory, {
      eventType,
      goldAmount: eventDetails?.goldAmount,
      damage: eventDetails?.damage,
      itemName: eventDetails?.itemName,
      utteranceText: eventDetails?.utteranceText,
    });

    // 6. Word Learning & Global Server Training Sync
    if (eventDetails?.utteranceText && eventDetails.utteranceText.trim().length > 0) {
      const tokens = arelorianLingua.tokenize(eventDetails.utteranceText);
      arelorianLingua.learnFromContextualUtterance(eventDetails.utteranceText, linguaEventType, Math.floor(now / 1000));

      // Asynchronously post training payload to server so knowledge persists globally across ALL NPCs
      this.syncWordTrainingPayloadToServer({
        eventType: linguaEventType,
        utteranceText: eventDetails.utteranceText,
        combinedTokens: tokens,
        threatDelta: emotionalDelta < 0 ? Math.abs(emotionalDelta) : 0,
        commerceDelta: eventType === 'trade' ? (eventDetails.goldAmount || 10) : 0,
        npcId: npc.id,
      });
    }

    return memory;
  }

  /**
   * Persists the player's NPC interaction memory and event log to the MariaDB server.
   */
  public async syncNPCMemoryToServer(
    playerId: string,
    npcId: string,
    memory: NPCRelationshipMemory,
    eventLogData?: any
  ): Promise<void> {
    try {
      await fetch('/api/npc-memory/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          npcId,
          memory,
          eventLog: eventLogData,
        }),
      });
    } catch (e) {
      console.warn('[NPCMemoryService] Async NPC memory save queued for next session.');
    }
  }

  /**
   * Restores all saved NPC memories for a player from MariaDB server across sessions.
   */
  public async loadPlayerNPCMemories(playerId: string, npcs: NPCCharacter[]): Promise<void> {
    try {
      const res = await fetch(`/api/npc-memory/player-memories?playerId=${encodeURIComponent(playerId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.memories)) {
          for (const memRecord of data.memories) {
            const targetNpc = npcs.find((n) => n.id === memRecord.npcId);
            if (targetNpc) {
              targetNpc.memory = {
                reputation: memRecord.reputation,
                affectionRating: memRecord.affectionRating,
                timesInteracted: memRecord.timesInteracted,
                tradesCompleted: memRecord.tradesCompleted,
                attacksSuffered: memRecord.attacksSuffered,
                crimesWitnessed: memRecord.crimesWitnessed,
                totalGoldTraded: memRecord.totalGoldTraded,
                interactionFrequency: memRecord.interactionFrequency,
                emotionalContext: memRecord.emotionalContext,
                defensivePosture: memRecord.defensivePosture,
                activeDiscountPercent: memRecord.activeDiscountPercent,
                dynamicDialogueHistory: memRecord.dynamicDialogueHistory,
                lastEvent: memRecord.lastEvent,
                lastEventTimestamp: memRecord.lastEventTimestamp,
              };
              targetNpc.affectionRating = memRecord.affectionRating;
              targetNpc.defensivePosture = memRecord.defensivePosture;
              targetNpc.activeDiscountPercent = memRecord.activeDiscountPercent;
              targetNpc.mood = memRecord.mood;
              targetNpc.interactionFrequency = memRecord.interactionFrequency;
              targetNpc.emotionalContext = memRecord.emotionalContext;
            }
          }
          console.log(`[NPCMemoryService] Restored ${data.memories.length} NPC memories from MariaDB server.`);
        }
      }
    } catch (e) {
      console.warn('[NPCMemoryService] Could not restore NPC memories from server; operating in local mode.');
    }
  }

  /**
   * Deterministically calculates merchant discount/markup based on Affection and Reputation.
   * Negative number represents a discount (e.g. -25% price), positive represents a markup (+30%).
   */
  public calculateDiscountPercent(affectionRating: number, reputation: number): number {
    const combinedTrust = Math.round((affectionRating * 0.6) + (reputation * 0.4));

    if (combinedTrust >= 80) return -30; // 30% Heroic Discount
    if (combinedTrust >= 50) return -20; // 20% Allied Discount
    if (combinedTrust >= 25) return -10; // 10% Friend Discount
    if (combinedTrust <= -70) return 50;  // +50% Hostile Tax / Penalty
    if (combinedTrust <= -40) return 30;  // +30% Suspicious Markup
    if (combinedTrust <= -15) return 15;  // +15% Guarded Markup
    return 0;                             // Standard Base Price
  }

  /**
   * Calculates defensive posturing for visual model animation, NPC guard stances, and dialogue.
   */
  public calculateDefensivePosture(
    affectionRating: number,
    dominantTone: 'friendly' | 'aggressive' | 'neutral',
    reputation: number
  ): NPCDefensivePosture {
    if (affectionRating <= -50 || reputation <= -40 || dominantTone === 'aggressive') {
      return 'HOSTILE_STANCE';
    }
    if (affectionRating <= -15 || reputation <= -15) {
      return 'DEFENSIVE';
    }
    if (affectionRating >= 70 || reputation >= 70) {
      return 'HEROIC_SALUTE';
    }
    if (affectionRating >= 25 || reputation >= 25) {
      return 'PEACEFUL';
    }
    return 'GUARDED';
  }

  /**
   * Transmits new word learning & event dataset training payloads to the server.
   * Guarantees that even if local NPC state is reset, global learned words stay saved for all NPCs.
   */
  public async syncWordTrainingPayloadToServer(payload: WordEventTrainingPayload): Promise<void> {
    try {
      const activeProfiles = arelorianLingua.getLearnedProfiles().map((p) => ({
        word: p.word,
        totalOccurrences: p.totalOccurrences,
        eventCounts: p.eventCounts,
        threatScore: p.threatScore,
        commerceScore: p.commerceScore,
        lastObservedTick: p.lastObservedTick,
      }));

      await fetch('/api/lingua/learn-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload,
          learnedProfiles: activeProfiles,
        }),
      });
      this.isServerSynced = true;
      this.lastServerSyncTimestamp = Date.now();
    } catch (e) {
      console.warn('[NPCMemoryService] Async server word learning sync queued for next tick.');
    }
  }

  /**
   * Bulk syncs all current learned vocabulary to the server database.
   */
  public async bulkSyncToServer(): Promise<boolean> {
    try {
      const profiles = arelorianLingua.getLearnedProfiles();
      const res = await fetch('/api/lingua/sync-learned-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnedWords: profiles }),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  public isSynced(): boolean {
    return this.isServerSynced;
  }

  public getLastSyncTime(): number {
    return this.lastServerSyncTimestamp;
  }
}

export const npcMemoryService = NPCMemoryService.getInstance();
