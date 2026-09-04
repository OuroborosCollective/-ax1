/**
 * DynamicEconomyQuestEngine.ts
 *
 * Real-Time Event-Driven Quest Engine for Echoes of Aurion:
 * - Continuously monitors regional market hub stock deficits and pricing spikes
 * - Synthesizes dynamic commodity procurement and supply-chain delivery quests
 * - Directly modifies market hub inventories upon player delivery, stabilizing regional inflation
 * - Awards real gold, ascension XP, and faction reputation
 */

import { AutonomousNPCEconomy, COMMODITIES, RegionalMarketHub } from './AutonomousNPCEconomy';

export interface DynamicEconomyQuest {
  id: string;
  title: string;
  description: string;
  questType: 'PROCUREMENT' | 'CARAVAN_ESCORT' | 'ARBITRAGE_DELIVERY';
  targetHubId: string;
  targetHubName: string;
  resourceId: number;
  resourceName: string;
  resourceIcon: string;
  requiredQuantity: number;
  goldReward: number;
  reputationReward: number;
  deadlineTicks: number;
  createdTick: number;
  completed: boolean;
  accepted: boolean;
}

export class DynamicEconomyQuestEngine {
  private static instance: DynamicEconomyQuestEngine | null = null;
  public activeQuests: Map<string, DynamicEconomyQuest> = new Map();
  private lastEvaluationTick: number = -1;

  public static getInstance(): DynamicEconomyQuestEngine {
    if (!DynamicEconomyQuestEngine.instance) {
      DynamicEconomyQuestEngine.instance = new DynamicEconomyQuestEngine();
    }
    return DynamicEconomyQuestEngine.instance;
  }

  /**
   * Evaluates regional market stock every 50 ticks to synthesize emergent quests
   */
  public evaluateEconomy(economy: AutonomousNPCEconomy): DynamicEconomyQuest[] {
    const tick = economy.currentTick;
    if (tick - this.lastEvaluationTick < 40 && this.activeQuests.size >= 4) {
      return Array.from(this.activeQuests.values());
    }
    this.lastEvaluationTick = tick;

    // Clear expired quests that weren't accepted
    for (const [id, quest] of this.activeQuests.entries()) {
      if (!quest.accepted && !quest.completed && tick > quest.deadlineTicks) {
        this.activeQuests.delete(id);
      }
    }

    // Inspect each market hub for critical shortages
    for (const hub of economy.hubs.values()) {
      for (const commodity of COMMODITIES) {
        const currentStock = hub.stock.get(commodity.id) || 0;
        const isConsuming = hub.consumptionFocus.includes(commodity.id);
        const criticalThreshold = isConsuming ? 20 : 10;

        if (currentStock < criticalThreshold) {
          const questId = `quest_${hub.id}_${commodity.id}_${Math.floor(tick / 100)}`;
          if (!this.activeQuests.has(questId)) {
            const neededAmount = isConsuming ? 15 : 10;
            const currentPriceCopper = economy.calculateCurrentPrice(hub, commodity.id);
            const goldReward = Math.ceil((neededAmount * (currentPriceCopper / 1000)) * 1.4); // 40% merchant bounty bonus

            const quest: DynamicEconomyQuest = {
              id: questId,
              title: `Handelsnotstand: ${commodity.name} für ${hub.name}`,
              description: `Die Vorräte an ${commodity.name} in ${hub.name} sind kritisch erschöpft (${currentStock} verbleibend). Beschaffe und liefere ${neededAmount} Einheiten, um den Markt zu stabilisieren.`,
              questType: 'PROCUREMENT',
              targetHubId: hub.id,
              targetHubName: hub.name,
              resourceId: commodity.id,
              resourceName: commodity.name,
              resourceIcon: commodity.icon,
              requiredQuantity: neededAmount,
              goldReward: Math.max(15, goldReward),
              reputationReward: 120,
              deadlineTicks: tick + 600,
              createdTick: tick,
              completed: false,
              accepted: false,
            };

            this.activeQuests.set(questId, quest);
          }
        }
      }
    }

    return Array.from(this.activeQuests.values());
  }

  public acceptQuest(questId: string): boolean {
    const quest = this.activeQuests.get(questId);
    if (!quest || quest.completed) return false;
    quest.accepted = true;
    return true;
  }

  /**
   * Turns in completed goods, removes them from player inventory, and injects them into the hub's stock!
   */
  public completeQuest(
    questId: string,
    economy: AutonomousNPCEconomy,
    playerInventoryMap: Map<number, number> | Record<string, number>
  ): { success: boolean; goldReward: number; message: string } {
    const quest = this.activeQuests.get(questId);
    if (!quest) {
      return { success: false, goldReward: 0, message: 'Quest nicht gefunden.' };
    }

    if (quest.completed) {
      return { success: false, goldReward: 0, message: 'Diese Quest wurde bereits abgeschlossen.' };
    }

    // Check player inventory
    let playerHasCount = 0;
    if (playerInventoryMap instanceof Map) {
      playerHasCount = playerInventoryMap.get(quest.resourceId) || 0;
    } else {
      playerHasCount = playerInventoryMap[quest.resourceId.toString()] || playerInventoryMap[quest.resourceName] || 0;
    }

    if (playerHasCount < quest.requiredQuantity) {
      return {
        success: false,
        goldReward: 0,
        message: `Unzureichende Güter: Du benötigst ${quest.requiredQuantity}x ${quest.resourceName} (${playerHasCount} vorhanden).`,
      };
    }

    // Deduct from player
    if (playerInventoryMap instanceof Map) {
      playerInventoryMap.set(quest.resourceId, playerHasCount - quest.requiredQuantity);
    } else {
      if (playerInventoryMap[quest.resourceId.toString()] !== undefined) {
        playerInventoryMap[quest.resourceId.toString()] -= quest.requiredQuantity;
      } else if (playerInventoryMap[quest.resourceName] !== undefined) {
        playerInventoryMap[quest.resourceName] -= quest.requiredQuantity;
      }
    }

    // Inject into Hub stock to stabilize market!
    const hub = economy.hubs.get(quest.targetHubId);
    if (hub) {
      const currentStock = hub.stock.get(quest.resourceId) || 0;
      hub.stock.set(quest.resourceId, currentStock + quest.requiredQuantity);
      hub.treasuryCopper = Math.max(0, hub.treasuryCopper - quest.goldReward * 1000);
    }

    quest.completed = true;
    this.activeQuests.delete(questId);

    return {
      success: true,
      goldReward: quest.goldReward,
      message: `Quest abgeschlossen! ${quest.requiredQuantity}x ${quest.resourceName} geliefert an ${quest.targetHubName}. +${quest.goldReward} Gold erhalten!`,
    };
  }
}

export const dynamicEconomyQuestEngine = DynamicEconomyQuestEngine.getInstance();
