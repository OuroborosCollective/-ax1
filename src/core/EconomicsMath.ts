/**
 * EconomicsMath.ts
 *
 * Deterministic Pricing Engine implementing the Law of Supply and Demand for Echoes of Aurion.
 * Formulates deterministic equilibrium pricing using:
 * - Current stock levels (Supply)
 * - Aggregated NPC Hunger & Resource Needs thresholds (Demand)
 * - Elasticity parameters, asymptotic tanh damping and deterministic tick-based modulation
 *
 * Guarantees bit-identical calculations across client and server.
 */

import { NPCMemoryRecord, NPCMemoryType } from '../engine/ai/NPCShortTermMemory';

export interface MarketCommodityConfig {
  id: string;
  name: string;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  elasticity: number;       // Sensitivity coefficient (beta)
  volatilityFactor: number; // Maximum amplitude shift (alpha)
  isEssentialFood?: boolean;
}

export interface SupplyDemandState {
  commodityId: string;
  stockLevel: number;        // Current regional reserve count
  equilibriumStock: number;  // Standard baseline reserve count
  npcCount: number;          // Total simulated consumers
  averageHunger: number;     // 0.0 (full) to 100.0 (starving)
  averageSecurity: number;   // 0.0 (under siege) to 100.0 (safe)
  tick: number;              // Deterministic engine tick counter
}

export interface MerchantTradeCandidate {
  id: string;
  name: string;
  coords: { x: number; z: number };
  priceCopper: number;
  stock: number;
  taxRateBasisPoints?: number;
  isFood?: boolean;
  metadataHash?: number;
}

export interface PreferredMerchantEvaluation {
  selectedHubId: string;
  selectedHubName: string;
  targetCoords: { x: number; z: number };
  merchantAffinityMultiplier: number;
  basePrice: number;
  effectiveUtilityScore: number;
  recentTradeDealsCount: number;
  reason: string;
}

export class EconomicsMath {
  /**
   * Deterministic Mulberry32 generator for micro-fluctuation noise
   */
  public static deterministicNoise(seed: number, tick: number): number {
    let t = ((seed ^ (tick * 0x9e3779b9)) + 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const floatVal = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return (floatVal - 0.5) * 2.0; // [-1.0, 1.0]
  }

  /**
   * Calculates the Demand Index (D) based on population needs.
   * If the commodity is essential food, hunger exponentially increases demand.
   * If security is low, defense materials / emergency goods demand increases.
   */
  public static calculateDemandIndex(
    config: MarketCommodityConfig,
    state: SupplyDemandState
  ): number {
    let baseDemand = Math.max(1, state.npcCount);

    if (config.isEssentialFood) {
      // Hunger threshold creates exponential demand pressure as hunger crosses 50%
      const hungerFactor = state.averageHunger / 100.0;
      const hungerUrgency = 1.0 + Math.pow(hungerFactor, 2) * 3.5;
      baseDemand *= hungerUrgency;
    }

    if (config.id === 'bronze_ingot' || config.id === 'rune_core') {
      // Threat & low security increases weapon and fortification demand
      const threatFactor = (100.0 - Math.min(100.0, state.averageSecurity)) / 100.0;
      baseDemand *= (1.0 + threatFactor * 2.0);
    }

    return baseDemand;
  }

  /**
   * Calculates the Supply Index (S) based on current stock levels relative to baseline.
   */
  public static calculateSupplyIndex(
    _config: MarketCommodityConfig,
    state: SupplyDemandState
  ): number {
    // Prevent division by zero with smooth epsilon offset
    return Math.max(0.1, state.stockLevel);
  }

  /**
   * Core Deterministic Pricing Formula:
   *
   * Ratio = Demand / Supply
   * Normalized Delta = (Ratio - BaselineRatio)
   * Price = BasePrice * (1 + Volatility * tanh(Elasticity * Normalized Delta)) + TickJitter
   */
  public static calculatePrice(
    config: MarketCommodityConfig,
    state: SupplyDemandState,
    seed: number = 1337
  ): number {
    const demand = this.calculateDemandIndex(config, state);
    const supply = this.calculateSupplyIndex(config, state);

    // Standard equilibrium ratio when stock equals baseline equilibrium
    const equilibriumRatio = Math.max(1, state.npcCount) / Math.max(1, state.equilibriumStock);
    const currentRatio = demand / supply;

    // Relative pressure metric (positive = shortage, negative = surplus)
    const marketPressure = (currentRatio - equilibriumRatio) / equilibriumRatio;

    // Hyperbolic tangent bounds the price response smoothly preventing infinite spikes or negative prices
    const responseMultiplier = config.volatilityFactor * Math.tanh(config.elasticity * marketPressure);

    // Minor deterministic micro-market noise (e.g. ±2% per tick based on cycle)
    const tickHarmonic = Math.sin((state.tick * Math.PI) / 60.0) * 0.015;
    const tickNoise = this.deterministicNoise(seed + config.id.length * 31, state.tick) * 0.01;

    let computedPrice = config.basePrice * (1.0 + responseMultiplier + tickHarmonic + tickNoise);

    // Strict clamping within allowed economic envelope
    computedPrice = Math.max(config.minPrice, Math.min(config.maxPrice, computedPrice));

    // Round deterministically to 4 decimal places for stable cross-platform float precision
    return Math.round(computedPrice * 10000) / 10000;
  }

  /**
   * Computes quantity that can be traded before moving price by a certain delta
   */
  public static estimateMarketSlippage(
    config: MarketCommodityConfig,
    currentStock: number,
    tradeQuantity: number,
    isBuy: boolean
  ): number {
    const stockChangeFactor = isBuy
      ? tradeQuantity / Math.max(1, currentStock)
      : tradeQuantity / Math.max(1, currentStock + tradeQuantity);

    return Math.min(0.5, stockChangeFactor * config.elasticity * 0.5);
  }

  /**
   * Calculates a dynamic Merchant Affinity multiplier based on NPC Short-Term Memory.
   * Recent successful transactions (TRADE_DEAL) at this merchant or hub boost affinity.
   * Recent hazards/ambushes or obstacles near this merchant reduce affinity.
   *
   * Multiplier ranges from 0.5 (avoided/dangerous) to 2.5 (beloved preferred merchant).
   */
  public static calculateMerchantAffinity(
    hubId: string,
    hubCoords: { x: number; z: number },
    memories: readonly NPCMemoryRecord[],
    currentTick: number,
    options?: { hubMetadataHash?: number; searchRadius?: number }
  ): { affinityMultiplier: number; tradeDealCount: number; hazardPenalty: number } {
    const searchRadius = options?.searchRadius ?? 25.0;
    const hubHash = options?.hubMetadataHash;

    let tradeDealCount = 0;
    let tradeBonus = 0;
    let hazardPenalty = 0;

    for (let i = 0; i < memories.length; i++) {
      const rec = memories[i];
      const dist = Math.hypot(rec.x - hubCoords.x, rec.z - hubCoords.z);
      const isSpatialMatch = dist <= searchRadius;
      const isHashMatch = hubHash !== undefined && rec.metadata === hubHash;

      if (rec.type === NPCMemoryType.TRADE_DEAL && (isSpatialMatch || isHashMatch)) {
        tradeDealCount++;
        const elapsed = Math.max(0, currentTick - rec.tickRecorded);
        // Exponential decay of affinity bonus over 200 ticks
        const recencyWeight = Math.max(0.2, 1.0 - elapsed / 250);
        tradeBonus += 0.35 * rec.intensity * recencyWeight;
      } else if (rec.type === NPCMemoryType.HAZARD_THREAT && isSpatialMatch) {
        hazardPenalty += 0.5 * rec.intensity * (1.0 - dist / searchRadius);
      } else if (rec.type === NPCMemoryType.OBSTACLE_STUCK && isSpatialMatch) {
        hazardPenalty += 0.25 * rec.intensity;
      }
    }

    // Baseline is 1.0; successful trades increase affinity up to 2.5; hazards lower it down to 0.5
    let affinityMultiplier = 1.0 + Math.min(1.5, tradeBonus) - Math.min(0.5, hazardPenalty);
    affinityMultiplier = Math.max(0.5, Math.min(2.5, affinityMultiplier));

    return {
      affinityMultiplier: Math.round(affinityMultiplier * 1000) / 1000,
      tradeDealCount,
      hazardPenalty: Math.round(hazardPenalty * 1000) / 1000,
    };
  }

  /**
   * Deterministically evaluates available merchants / regional hubs and selects the optimal
   * pathfinding destination for an NPC in 'SEEK_FOOD' or 'TRADE' / 'ARBITRAGE' states,
   * factoring in:
   * - Merchant price and stock availability
   * - Spatial Euclidean travel distance & navigation cost
   * - Short-term memory of previous successful trades (Preferred Merchant bias)
   * - Hazard avoidance around known hostile or blocked areas
   */
  public static evaluatePreferredTradeDestination(
    npcCoords: { x: number; z: number },
    memories: readonly NPCMemoryRecord[],
    availableMerchants: MerchantTradeCandidate[],
    currentTick: number,
    intent: 'SEEK_FOOD' | 'TRADE' | 'ARBITRAGE',
    npcWealthCopper: number = 100
  ): PreferredMerchantEvaluation | null {
    if (availableMerchants.length === 0) return null;

    let bestScore = -Infinity;
    let selectedMerchant: MerchantTradeCandidate | null = null;
    let selectedAffinity = 1.0;
    let selectedTradeDealsCount = 0;
    let evaluationReason = 'Standard economic utility';

    for (let i = 0; i < availableMerchants.length; i++) {
      const merchant = availableMerchants[i];
      if (merchant.stock <= 0) continue;

      const dist = Math.max(1.0, Math.hypot(merchant.coords.x - npcCoords.x, merchant.coords.z - npcCoords.z));
      const { affinityMultiplier, tradeDealCount, hazardPenalty } = this.calculateMerchantAffinity(
        merchant.id,
        merchant.coords,
        memories,
        currentTick,
        { hubMetadataHash: merchant.metadataHash }
      );

      // Distance impedance factor (closer merchants have higher baseline utility)
      const distanceDecay = 1.0 / (1.0 + dist * 0.025);

      let score = 0;

      if (intent === 'SEEK_FOOD') {
        // When starving or seeking food, NPCs prioritize affordability, speed of arrival, and trusted merchants
        const canAfford = npcWealthCopper >= merchant.priceCopper;
        const affordabilityMultiplier = canAfford ? 1.5 : Math.max(0.2, npcWealthCopper / (merchant.priceCopper + 1));
        const priceAttractiveness = 100.0 / Math.max(1, merchant.priceCopper);

        score = priceAttractiveness * distanceDecay * affordabilityMultiplier * Math.pow(affinityMultiplier, 1.4);

        if (hazardPenalty > 0.5) {
          score *= (1.0 - hazardPenalty * 0.5);
        }
      } else {
        // Standard Commerce or Arbitrage: evaluate profit margin modulated by merchant affinity
        const taxRate = (merchant.taxRateBasisPoints ?? 500) / 10000;
        const netValue = merchant.priceCopper * (1.0 - taxRate);

        score = (netValue * distanceDecay) * affinityMultiplier;

        if (tradeDealCount >= 2) {
          // Bonus multiplier for established regular trade partner
          score *= 1.2;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        selectedMerchant = merchant;
        selectedAffinity = affinityMultiplier;
        selectedTradeDealsCount = tradeDealCount;

        if (selectedTradeDealsCount > 0 && selectedAffinity > 1.2) {
          evaluationReason = `Preferred Merchant (${selectedAffinity.toFixed(2)}x affinity from ${selectedTradeDealsCount} past trades)`;
        } else {
          evaluationReason = `Optimal proximity & price efficiency (${dist.toFixed(1)}m)`;
        }
      }
    }

    if (!selectedMerchant) return null;

    return {
      selectedHubId: selectedMerchant.id,
      selectedHubName: selectedMerchant.name,
      targetCoords: { ...selectedMerchant.coords },
      merchantAffinityMultiplier: selectedAffinity,
      basePrice: selectedMerchant.priceCopper,
      effectiveUtilityScore: Math.round(bestScore * 100) / 100,
      recentTradeDealsCount: selectedTradeDealsCount,
      reason: evaluationReason,
    };
  }
}
