/**
 * AutonomousNPCEconomy.ts
 *
 * Deterministic Simulation Engine for Autonomous NPC Ecosystem in Echoes of Aurion:
 * - Data-Driven ECS & Hierarchical State Machine (HSM)
 * - Fixed-point arithmetic & Seed-based PRNG (Mulberry32) for deterministic cross-client simulation
 * - Utility-based dynamic pricing with hyperbolic tangent damping
 * - Macro-Economic Arbitrage, Autonomous Caravans & Territorial Tariffs
 * - Darwinian Lineage, Trait Inheritance & Evolution
 */

import { NPCDataLayout } from '../data/NPCDataLayout';
import { hierarchicalPathfinding } from '../pathfinding/HierarchicalPathfinding';
import { caravanSecuritySystem } from './CaravanSecuritySystem';
import { dynamicEconomyQuestEngine } from './DynamicEconomyQuestEngine';
import { NPCShortTermMemory, NPCMemoryType } from '../ai/NPCShortTermMemory';
import { NPCLongTermMemory } from '../ai/NPCLongTermMemory';
import { EconomicsMath, MerchantTradeCandidate } from '../../core/EconomicsMath';
import { BinaryNPCSnapshotSerializer } from '../net/BinaryNPCSnapshotSerializer';

export type MacroState = 'SURVIVAL' | 'PRODUCTION' | 'COMMERCE' | 'DEFENSE';

export type SubState =
  | 'IDLE'
  | 'CONSUME_RATION'
  | 'ROUTE_TO_MARKET_FOOD'
  | 'FORAGE_OR_POACH'
  | 'HARVEST_RESOURCE'
  | 'CRAFT_GOODS'
  | 'EVALUATE_ARBITRAGE'
  | 'TRANSIT_CARAVAN'
  | 'EXECUTE_TRADE'
  | 'RALLY_MILITIA'
  | 'PATROL_TERRITORY';

export interface NPCTraits {
  tradeProwess: number;    // 0.5 - 2.0 (Arbitrage detection & discount modifier)
  harvestYield: number;    // 0.5 - 2.0 (Production quantity multiplier)
  combatGrit: number;      // 0.5 - 2.0 (Defense effectiveness & morale)
  frugality: number;       // 0.5 - 2.0 (Hunger & fatigue resistance)
}

export interface AutonomousNPC {
  id: number;
  name: string;
  generation: number;
  parentName?: string;
  alive: boolean;
  ageTicks: number;

  macroState: MacroState;
  subState: SubState;
  traits: NPCTraits;

  // Fixed-Point Needs: 0 - 10000 (0.00% to 100.00%)
  hunger: number;
  fatigue: number;
  hp: number;
  maxHp: number;

  // Wealth in Copper (1000 Copper = 1 Gold)
  wealthCopper: number;

  // Inventory: Resource ID -> Quantity
  inventory: Map<number, number>;

  // Territorial and Regional anchors
  homeHubId: string;
  currentHubId: string;
  targetHubId?: string;
  assignedGuildId: string;

  // Spatial Coordinates (Fixed-point or floats interpolated by Three.js)
  x: number;
  z: number;
  prevX: number;
  prevZ: number;
  targetX: number;
  targetZ: number;
  moveSpeed: number;

  // Caravan payload during transit
  caravanPayload?: {
    resourceId: number;
    quantity: number;
    purchasePriceCopper: number;
    destinationHubId: string;
  };

  // Short-Term Working Memory
  memory: NPCShortTermMemory;

  // Long-Term Episodic & Relational Memory (Enemies, Trade Points, Resource Spots, Zone Leader)
  longTermMemory: NPCLongTermMemory;
}

export interface MarketCommodity {
  id: number;
  name: string;
  icon: string;
  category: 'food' | 'material' | 'magic' | 'consumable';
  basePriceCopper: number;
  alpha: number; // Max price fluctuation limit (e.g. 2.0 = +/- 200%)
  beta: number;  // Price elasticity sensitivity
}

export interface RegionalMarketHub {
  id: string;
  name: string;
  regionName: string;
  coords: { x: number; z: number };
  controllingGuild: string;
  taxRateBasisPoints: number; // e.g. 500 = 5.0% tariff
  treasuryCopper: number;
  stock: Map<number, number>;
  priceHistory: Map<number, number[]>; // Last 10 price records
  productionFocus: number[];           // Resource IDs produced naturally
  consumptionFocus: number[];          // Resource IDs consumed heavily
}

export const COMMODITIES: MarketCommodity[] = [
  { id: 1, name: 'Aurion Grain', icon: '🌾', category: 'food', basePriceCopper: 20, alpha: 2.5, beta: 1.2 },
  { id: 2, name: 'Weathered Sandstone', icon: '🧱', category: 'material', basePriceCopper: 45, alpha: 1.8, beta: 0.9 },
  { id: 3, name: 'Brushed Bronze Ingot', icon: '🔩', category: 'material', basePriceCopper: 90, alpha: 2.2, beta: 1.1 },
  { id: 4, name: 'Aether-Turquoise Crystal', icon: '💎', category: 'magic', basePriceCopper: 220, alpha: 3.0, beta: 1.5 },
  { id: 5, name: 'Healing Salve', icon: '🧪', category: 'consumable', basePriceCopper: 60, alpha: 2.0, beta: 1.0 },
  { id: 6, name: 'Celestial Rune Core', icon: '🔮', category: 'magic', basePriceCopper: 450, alpha: 3.5, beta: 1.8 },
];

export class AutonomousNPCEconomy {
  private prngSeed: number;
  public npcs: AutonomousNPC[] = [];
  public hubs: Map<string, RegionalMarketHub> = new Map();
  public currentTick: number = 0;
  public get tickCount(): number {
    return this.currentTick;
  }
  public totalBirths: number = 0;
  public totalDeaths: number = 0;
  public totalTradeVolumeCopper: number = 0;
  public dataLayout: NPCDataLayout = new NPCDataLayout(256);

  constructor(seed: number = 42891) {
    this.prngSeed = seed;
    this.initializeRegionalHubs();
    this.populateInitialPopulation(60);
  }

  /**
   * Seed-based Mulberry32 Pseudo-Random Number Generator (Deterministic)
   */
  private prng(): number {
    let t = (this.prngSeed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  private initializeRegionalHubs(): void {
    this.hubs.set('sun_spire', {
      id: 'sun_spire',
      name: 'Sun-Spire Citadel',
      regionName: 'Grand Sanctum of Aethelgard',
      coords: { x: 0, z: 0 },
      controllingGuild: 'Order of Aurion',
      taxRateBasisPoints: 400, // 4.0%
      treasuryCopper: 500000,
      stock: new Map([
        [1, 150], [2, 100], [3, 80], [4, 40], [5, 60], [6, 25]
      ]),
      priceHistory: new Map(COMMODITIES.map((c) => [c.id, [c.basePriceCopper]])),
      productionFocus: [5, 6], // Healing Salves & Rune Cores
      consumptionFocus: [1, 3, 4], // Grain, Bronze, Aether
    });

    this.hubs.set('windhollow', {
      id: 'windhollow',
      name: 'Windhollow Glade',
      regionName: 'Windhollow Valley',
      coords: { x: -65, z: 45 },
      controllingGuild: 'Aethelgard Pioneers',
      taxRateBasisPoints: 250, // 2.5%
      treasuryCopper: 280000,
      stock: new Map([
        [1, 600], [2, 120], [3, 30], [4, 15], [5, 40], [6, 5]
      ]),
      priceHistory: new Map(COMMODITIES.map((c) => [c.id, [c.basePriceCopper]])),
      productionFocus: [1], // Grain Producer
      consumptionFocus: [2, 3, 5], // Sandstone, Bronze, Salves
    });

    this.hubs.set('emberfall', {
      id: 'emberfall',
      name: 'Emberfall Foundry',
      regionName: 'Emberfall Crags',
      coords: { x: 75, z: -55 },
      controllingGuild: 'Bronze Syndicate',
      taxRateBasisPoints: 550, // 5.5%
      treasuryCopper: 420000,
      stock: new Map([
        [1, 80], [2, 450], [3, 350], [4, 20], [5, 25], [6, 10]
      ]),
      priceHistory: new Map(COMMODITIES.map((c) => [c.id, [c.basePriceCopper]])),
      productionFocus: [2, 3], // Sandstone & Bronze Ingot
      consumptionFocus: [1, 4, 5], // Grain, Aether, Salves
    });

    this.hubs.set('aschengewoelbe', {
      id: 'aschengewoelbe',
      name: 'Aschengewölbe Ruins',
      regionName: 'Ancient Vaults of Aurion',
      coords: { x: -40, z: -80 },
      controllingGuild: 'Starforged Sentinels',
      taxRateBasisPoints: 600, // 6.0%
      treasuryCopper: 610000,
      stock: new Map([
        [1, 40], [2, 90], [3, 60], [4, 180], [5, 30], [6, 80]
      ]),
      priceHistory: new Map(COMMODITIES.map((c) => [c.id, [c.basePriceCopper]])),
      productionFocus: [4, 6], // Aether Crystal & Rune Core
      consumptionFocus: [1, 2, 5], // Grain, Sandstone, Salves
    });
  }

  private populateInitialPopulation(count: number): void {
    const hubKeys = Array.from(this.hubs.keys());
    const names = [
      'Valen', 'Kyra', 'Orion', 'Elowen', 'Corvus', 'Lyra', 'Darius', 'Sariel',
      'Theron', 'Vael', 'Aurelia', 'Boran', 'Cassian', 'Darith', 'Elora', 'Faustus'
    ];

    for (let i = 0; i < count; i++) {
      const assignedHubId = hubKeys[i % hubKeys.length];
      const hub = this.hubs.get(assignedHubId)!;
      const name = `${names[i % names.length]} #${i + 1}`;

      const longTermMemory = new NPCLongTermMemory(assignedHubId, {
        zoneLeaderId: assignedHubId === 'sun_spire' ? 'archon_lysandros' : assignedHubId === 'windhollow' ? 'elder_elora' : assignedHubId === 'emberfall' ? 'forge_master_torin' : 'high_sentinel_kael',
        zoneLeaderName: assignedHubId === 'sun_spire' ? 'Archon Lysandros' : assignedHubId === 'windhollow' ? 'Elder Elora' : assignedHubId === 'emberfall' ? 'Forgemaster Torin' : 'High Sentinel Kael',
        zoneLeaderTitle: assignedHubId === 'sun_spire' ? 'Wächter der Sonnen-Spitze' : assignedHubId === 'windhollow' ? 'Hüterin der Windhaine' : assignedHubId === 'emberfall' ? 'Erzschmied von Emberfall' : 'Kustos des Aschengewölbes',
        zoneLeaderFaction: hub.controllingGuild,
        socialStanding: 'RESPECTED',
        reputationScore: 20 + Math.floor(this.prng() * 30),
      });

      // Seed baseline trade point knowledge
      longTermMemory.recordTradePoint(assignedHubId, hub.name, hub.coords, 1, 40, 0);

      // Seed baseline local resource spot
      const prodId = hub.productionFocus[0] || 1;
      const prodComm = COMMODITIES.find((c) => c.id === prodId);
      longTermMemory.recordResourceSpot(
        `${assignedHubId}_primary_deposit`,
        prodId,
        prodComm?.name || 'Local Deposit',
        { x: hub.coords.x + 8, z: hub.coords.z + 8 },
        2.0 + this.prng() * 0.8,
        0
      );

      const npc: AutonomousNPC = {
        id: i + 1,
        name,
        generation: 1,
        alive: true,
        ageTicks: 0,
        macroState: i % 4 === 0 ? 'COMMERCE' : i % 4 === 1 ? 'PRODUCTION' : i % 4 === 2 ? 'SURVIVAL' : 'DEFENSE',
        subState: 'IDLE',
        traits: {
          tradeProwess: 0.8 + this.prng() * 0.5,
          harvestYield: 0.8 + this.prng() * 0.5,
          combatGrit: 0.8 + this.prng() * 0.5,
          frugality: 0.8 + this.prng() * 0.5,
        },
        hunger: Math.floor(this.prng() * 3000),
        fatigue: Math.floor(this.prng() * 2000),
        hp: 100,
        maxHp: 100,
        wealthCopper: 500 + Math.floor(this.prng() * 2500),
        inventory: new Map([[1, 2 + Math.floor(this.prng() * 3)]]),
        homeHubId: assignedHubId,
        currentHubId: assignedHubId,
        assignedGuildId: hub.controllingGuild,
        x: hub.coords.x + (this.prng() - 0.5) * 16,
        z: hub.coords.z + (this.prng() - 0.5) * 16,
        prevX: hub.coords.x,
        prevZ: hub.coords.z,
        targetX: hub.coords.x,
        targetZ: hub.coords.z,
        moveSpeed: 3.5 + this.prng() * 1.5,
        memory: new NPCShortTermMemory(8),
        longTermMemory,
      };

      this.npcs.push(npc);
    }
  }

  /**
   * Deterministic Dynamic Pricing Calculation
   * P_r,i = P_base * (1 + alpha * tanh(beta * (mu_r,i - 1)))
   */
  public getMarketPriceCopper(hubId: string, resourceId: number): number {
    const hub = this.hubs.get(hubId);
    const commodity = COMMODITIES.find((c) => c.id === resourceId);
    if (!hub || !commodity) return 100;

    const currentStock = Math.max(1, hub.stock.get(resourceId) || 0);

    // Aggregate regional need coefficient
    let needSum = 0;
    const nearbyNPCs = this.npcs.filter((n) => n.alive && n.currentHubId === hubId);
    for (const npc of nearbyNPCs) {
      if (commodity.category === 'food') {
        needSum += Math.pow(npc.hunger / 10000, 2) * Math.log2(1 + npc.wealthCopper);
      } else if (commodity.category === 'consumable') {
        needSum += Math.pow((100 - npc.hp) / 100, 2) * 2;
      } else {
        needSum += 1.0;
      }
    }

    const demandFactor = hub.consumptionFocus.includes(resourceId) ? 2.5 : 1.0;
    const supplyFactor = hub.productionFocus.includes(resourceId) ? 2.0 : 1.0;

    const mu = (Math.max(0.2, needSum * demandFactor) / (currentStock * supplyFactor));
    const priceDelta = commodity.alpha * Math.tanh(commodity.beta * (mu - 1.0));
    const rawPrice = commodity.basePriceCopper * (1.0 + priceDelta);

    return Math.max(Math.floor(commodity.basePriceCopper * 0.3), Math.round(rawPrice));
  }

  public calculateCurrentPrice(hub: RegionalMarketHub, resourceId: number): number {
    return this.getMarketPriceCopper(hub.id, resourceId);
  }

  /**
   * Main Deterministic Simulation Tick (typically called at 10 Hz)
   */
  public tick(fixedDelta: number): void {
    this.currentTick++;

    // 1. Natural Regional Resource Production & Consumption
    if (this.currentTick % 20 === 0) {
      this.simulateRegionalEconomyPulsing();
    }

    // 2. Caravan Security & Ambush Simulation
    caravanSecuritySystem.update(this);

    // 3. Dynamic Commodity Shortage Quest Evaluation
    dynamicEconomyQuestEngine.evaluateEconomy(this);

    // 4. NPC Agent Simulation
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      if (!npc.alive) continue;

      npc.ageTicks++;
      npc.prevX = npc.x;
      npc.prevZ = npc.z;

      // Deterministic short-term memory decay & long-term memory pruning (>3500 ticks)
      npc.memory.decay(this.currentTick, 3500);
      npc.longTermMemory.pruneOldMemories(this.currentTick, 3500);

      // Threat awareness: Record hazard memory if bandit raiders are in perceptual proximity
      for (const raider of caravanSecuritySystem.activeRaiders) {
        const distToRaider = Math.hypot(raider.x - npc.x, raider.z - npc.z);
        if (distToRaider < 28.0) {
          npc.memory.record(NPCMemoryType.HAZARD_THREAT, raider.x, raider.z, this.currentTick, {
            ttlTicks: 120,
            intensity: Math.min(1.0, raider.attackPower / 50),
            metadata: raider.attackPower,
          });

          // Persistent Long-Term Memory of Enemy Threat
          npc.longTermMemory.recordEnemy(
            `raider_${raider.id}`,
            `Bandit Marauder #${raider.id}`,
            Math.min(100, raider.attackPower * 2),
            { x: raider.x, z: raider.z },
            this.currentTick,
            { hostilityDelta: 15 }
          );
        }
      }

      // Needs decay adjusted for frugality trait
      const hungerRate = (12 / npc.traits.frugality) * fixedDelta * 10;
      npc.hunger = Math.min(10000, npc.hunger + hungerRate);
      npc.fatigue = Math.min(10000, npc.fatigue + (8 / npc.traits.frugality) * fixedDelta * 10);

      // Starvation damage
      if (npc.hunger >= 9900) {
        npc.hp -= 2;
        if (npc.hp <= 0) {
          this.handleNPCDeath(npc);
          continue;
        }
      }

      // HSM Macro-State Transitions
      this.evaluateMacroState(npc);

      // Execute Micro-SubState Action
      this.executeSubState(npc, fixedDelta);

      // Check Darwinian Reproduction
      if (npc.wealthCopper > 8000 && npc.hunger < 3000 && npc.ageTicks > 500) {
        this.attemptReproduction(npc);
      }

      // 5. Sync flat Struct-of-Arrays (DOD) TypedArray Buffer for zero-overhead cache lookups
      if (i < this.dataLayout.capacity) {
        this.dataLayout.setSpatial(i, npc.x, npc.z, npc.prevX, npc.prevZ, npc.targetX, npc.targetZ);
        this.dataLayout.setNeeds(i, npc.hunger, npc.fatigue, npc.hp, npc.maxHp, npc.wealthCopper, npc.moveSpeed);
        this.dataLayout.setTraits(i, npc.traits.tradeProwess, npc.traits.harvestYield, npc.traits.combatGrit, npc.traits.frugality);
        const macroNum = npc.macroState === 'SURVIVAL' ? 0 : npc.macroState === 'PRODUCTION' ? 1 : npc.macroState === 'COMMERCE' ? 2 : 3;
        this.dataLayout.setState(i, macroNum, 0, npc.alive, npc.generation);
      }
    }
  }

  private evaluateMacroState(npc: AutonomousNPC): void {
    const prevMacro = npc.macroState;

    if (npc.hunger > 7000 || npc.hp < 40) {
      npc.macroState = 'SURVIVAL';
    } else if (npc.wealthCopper > 4000 && npc.traits.tradeProwess >= 1.0) {
      npc.macroState = 'COMMERCE';
    } else if (npc.traits.combatGrit > 1.3 && this.currentTick % 100 < 30) {
      npc.macroState = 'DEFENSE';
    } else {
      npc.macroState = 'PRODUCTION';
    }

    if (prevMacro !== npc.macroState) {
      this.onEnterMacroState(npc);
    }
  }

  private onEnterMacroState(npc: AutonomousNPC): void {
    switch (npc.macroState) {
      case 'SURVIVAL':
        if ((npc.inventory.get(1 /* Grain */) || 0) > 0) {
          npc.subState = 'CONSUME_RATION';
        } else if (npc.wealthCopper >= 30) {
          npc.subState = 'ROUTE_TO_MARKET_FOOD';
        } else {
          npc.subState = 'FORAGE_OR_POACH';
        }
        break;

      case 'COMMERCE':
        npc.subState = 'EVALUATE_ARBITRAGE';
        break;

      case 'PRODUCTION':
        npc.subState = 'HARVEST_RESOURCE';
        break;

      case 'DEFENSE':
        npc.subState = 'PATROL_TERRITORY';
        break;
    }
  }

  private executeSubState(npc: AutonomousNPC, fixedDelta: number): void {
    const currentHub = this.hubs.get(npc.currentHubId)!;

    switch (npc.subState) {
      case 'CONSUME_RATION': {
        const grainCount = npc.inventory.get(1) || 0;
        if (grainCount > 0) {
          npc.inventory.set(1, grainCount - 1);
          npc.hunger = Math.max(0, npc.hunger - 5500);
          npc.hp = Math.min(npc.maxHp, npc.hp + 20);
        }
        npc.subState = 'IDLE';
        break;
      }

      case 'ROUTE_TO_MARKET_FOOD': {
        // Assemble available market hubs selling food (Grain)
        const merchantCandidates: MerchantTradeCandidate[] = Array.from(this.hubs.values()).map((h) => ({
          id: h.id,
          name: h.name,
          coords: h.coords,
          priceCopper: this.getMarketPriceCopper(h.id, 1),
          stock: h.stock.get(1) || 0,
          taxRateBasisPoints: h.taxRateBasisPoints,
          isFood: true,
          metadataHash: 1,
        }));

        // Factor in short-term memory of past successful trades to choose preferred merchant
        const preferred = EconomicsMath.evaluatePreferredTradeDestination(
          { x: npc.x, z: npc.z },
          npc.memory.getMemories(),
          merchantCandidates,
          this.currentTick,
          'SEEK_FOOD',
          npc.wealthCopper
        );

        const targetHubId = preferred?.selectedHubId || npc.currentHubId;
        const targetHub = this.hubs.get(targetHubId) || currentHub;
        const price = this.getMarketPriceCopper(targetHubId, 1);
        const distToTarget = Math.hypot(targetHub.coords.x - npc.x, targetHub.coords.z - npc.z);

        if (distToTarget <= 6.0) {
          if (npc.wealthCopper >= price && (targetHub.stock.get(1) || 0) > 0) {
            npc.wealthCopper -= price;
            targetHub.treasuryCopper += Math.round(price * (targetHub.taxRateBasisPoints / 10000));
            targetHub.stock.set(1, (targetHub.stock.get(1) || 1) - 1);
            npc.inventory.set(1, (npc.inventory.get(1) || 0) + 1);
            this.totalTradeVolumeCopper += price;
            npc.currentHubId = targetHubId;

            // Record in Short-Term Working Memory
            npc.memory.record(NPCMemoryType.TRADE_DEAL, targetHub.coords.x, targetHub.coords.z, this.currentTick, {
              ttlTicks: 180,
              intensity: 1.0,
              metadata: 1,
            });

            // Record in Persistent Long-Term Memory (Good Trade Points)
            npc.longTermMemory.recordTradePoint(
              targetHubId,
              targetHub.name,
              targetHub.coords,
              1,
              price,
              this.currentTick
            );

            npc.subState = 'CONSUME_RATION';
          } else {
            npc.subState = 'FORAGE_OR_POACH';
          }
        } else {
          // Route pathfinding destination to preferred food merchant hub
          npc.targetHubId = targetHubId;
          npc.targetX = targetHub.coords.x + (this.prng() - 0.5) * 6;
          npc.targetZ = targetHub.coords.z + (this.prng() - 0.5) * 6;
          npc.subState = 'TRANSIT_CARAVAN';
        }
        break;
      }

      case 'FORAGE_OR_POACH': {
        // Gathering from the open wild
        if (this.prng() < 0.25 * npc.traits.harvestYield) {
          npc.inventory.set(1, (npc.inventory.get(1) || 0) + 1);
          npc.subState = 'CONSUME_RATION';
        }
        break;
      }

      case 'HARVEST_RESOURCE': {
        // Natural harvesting based on regional hub production
        const prodItems = currentHub.productionFocus;
        if (prodItems.length > 0) {
          const itemToHarvest = prodItems[Math.floor(this.prng() * prodItems.length)];
          const qty = Math.max(1, Math.round(npc.traits.harvestYield * (1 + this.prng())));
          
          currentHub.stock.set(itemToHarvest, (currentHub.stock.get(itemToHarvest) || 0) + qty);
          const wage = Math.round(qty * 15 * npc.traits.harvestYield);
          npc.wealthCopper += wage;

          // Record high-yield resource spot in Long-Term Memory
          const commodity = COMMODITIES.find((c) => c.id === itemToHarvest);
          npc.longTermMemory.recordResourceSpot(
            `${npc.currentHubId}_deposit_${itemToHarvest}`,
            itemToHarvest,
            commodity?.name || 'Resource Spot',
            { x: currentHub.coords.x, z: currentHub.coords.z },
            1.5 * npc.traits.harvestYield,
            this.currentTick
          );
        }
        npc.subState = 'IDLE';
        break;
      }

      case 'EVALUATE_ARBITRAGE': {
        // Find greatest price disparity factoring in preferred merchant affinity
        let bestProfit = 0;
        let bestCommodityId = 1;
        let bestTargetHubId = '';

        for (const commodity of COMMODITIES) {
          const localPrice = this.getMarketPriceCopper(npc.currentHubId, commodity.id);
          const localStock = currentHub.stock.get(commodity.id) || 0;

          if (localStock <= 2 || localPrice > npc.wealthCopper) continue;

          for (const [targetId, targetHub] of this.hubs.entries()) {
            if (targetId === npc.currentHubId) continue;
            const remotePrice = this.getMarketPriceCopper(targetId, commodity.id);
            const tariff = remotePrice * (targetHub.taxRateBasisPoints / 10000);
            const rawProfit = (remotePrice - tariff) - localPrice;

            // Factor in Short-Term Memory Merchant Affinity
            const affinityData = EconomicsMath.calculateMerchantAffinity(
              targetId,
              targetHub.coords,
              npc.memory.getMemories(),
              this.currentTick
            );

            const netProfitWithAffinity = rawProfit * affinityData.affinityMultiplier;

            if (netProfitWithAffinity > bestProfit && rawProfit > 15) {
              bestProfit = netProfitWithAffinity;
              bestCommodityId = commodity.id;
              bestTargetHubId = targetId;
            }
          }
        }

        if (bestProfit > 20 && bestTargetHubId) {
          // Buy cargo and dispatch trade caravan
          const buyPrice = this.getMarketPriceCopper(npc.currentHubId, bestCommodityId);
          const buyQty = Math.min(5, Math.floor(npc.wealthCopper / buyPrice), currentHub.stock.get(bestCommodityId) || 0);

          if (buyQty > 0) {
            const totalCost = buyPrice * buyQty;
            npc.wealthCopper -= totalCost;
            currentHub.stock.set(bestCommodityId, (currentHub.stock.get(bestCommodityId) || buyQty) - buyQty);

            npc.caravanPayload = {
              resourceId: bestCommodityId,
              quantity: buyQty,
              purchasePriceCopper: buyPrice,
              destinationHubId: bestTargetHubId,
            };

            const destHub = this.hubs.get(bestTargetHubId)!;
            npc.targetHubId = bestTargetHubId;
            npc.targetX = destHub.coords.x + (this.prng() - 0.5) * 8;
            npc.targetZ = destHub.coords.z + (this.prng() - 0.5) * 8;
            npc.subState = 'TRANSIT_CARAVAN';
          }
        } else {
          npc.subState = 'HARVEST_RESOURCE';
        }
        break;
      }

      case 'TRANSIT_CARAVAN': {
        // Compute / follow hierarchical waypoint path
        const path = hierarchicalPathfinding.computeHierarchicalPath(npc.x, npc.z, npc.targetX, npc.targetZ);
        let nextTarget = path.length > 0 ? path[0] : { x: npc.targetX, z: npc.targetZ };

        // Check short-term memory hazard penalties for danger avoidance
        const hazardPenalty = npc.memory.getHazardPenalty(nextTarget.x, nextTarget.z, this.currentTick);
        if (hazardPenalty > 1.2 && path.length > 1) {
          // Dangerous node remembered - record deviation and divert path slightly
          npc.memory.record(NPCMemoryType.PATH_DEVIATION, npc.x, npc.z, this.currentTick, {
            ttlTicks: 80,
            intensity: 0.8,
          });
          nextTarget = path[1]; // Advance to bypass node
        }

        const dx = nextTarget.x - npc.x;
        const dz = nextTarget.z - npc.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 1.2) {
          // Road acceleration: caravans moving along highways travel 25% faster
          const speedBoost = 1.25;
          const step = npc.moveSpeed * speedBoost * fixedDelta;
          npc.x += (dx / dist) * step;
          npc.z += (dz / dist) * step;
        } else {
          // Final destination reached
          const finalDist = Math.hypot(npc.targetX - npc.x, npc.targetZ - npc.z);
          if (finalDist <= 2.5) {
            if (npc.targetHubId) {
              npc.currentHubId = npc.targetHubId;
              npc.targetHubId = undefined;
            }
            npc.subState = 'EXECUTE_TRADE';
          }
        }
        break;
      }

      case 'EXECUTE_TRADE': {
        if (npc.caravanPayload) {
          const destHub = this.hubs.get(npc.currentHubId)!;
          const sellPrice = this.getMarketPriceCopper(npc.currentHubId, npc.caravanPayload.resourceId);
          const grossRevenue = sellPrice * npc.caravanPayload.quantity;
          const tax = Math.round(grossRevenue * (destHub.taxRateBasisPoints / 10000));
          const netRevenue = grossRevenue - tax;

          npc.wealthCopper += netRevenue;
          destHub.treasuryCopper += tax;
          destHub.stock.set(
            npc.caravanPayload.resourceId,
            (destHub.stock.get(npc.caravanPayload.resourceId) || 0) + npc.caravanPayload.quantity
          );

          this.totalTradeVolumeCopper += grossRevenue;

          // Record successful trade deal in short-term memory
          npc.memory.record(NPCMemoryType.TRADE_DEAL, destHub.coords.x, destHub.coords.z, this.currentTick, {
            ttlTicks: 160,
            intensity: 1.0,
            metadata: npc.caravanPayload.resourceId,
          });

          // Record in Persistent Long-Term Memory
          npc.longTermMemory.recordTradePoint(
            destHub.id,
            destHub.name,
            destHub.coords,
            npc.caravanPayload.resourceId,
            netRevenue,
            this.currentTick
          );

          npc.caravanPayload = undefined;
        }
        npc.subState = 'IDLE';
        break;
      }

      case 'PATROL_TERRITORY': {
        // Roam around territory perimeter
        if (this.prng() < 0.05) {
          npc.targetX = currentHub.coords.x + (this.prng() - 0.5) * 24;
          npc.targetZ = currentHub.coords.z + (this.prng() - 0.5) * 24;
        }
        const dx = npc.targetX - npc.x;
        const dz = npc.targetZ - npc.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 1.0) {
          const step = npc.moveSpeed * 0.8 * fixedDelta;
          npc.x += (dx / dist) * step;
          npc.z += (dz / dist) * step;
        }
        break;
      }

      case 'IDLE':
      default: {
        // Minor local jitter
        if (this.prng() < 0.08) {
          npc.targetX = currentHub.coords.x + (this.prng() - 0.5) * 12;
          npc.targetZ = currentHub.coords.z + (this.prng() - 0.5) * 12;
        }
        const dx = npc.targetX - npc.x;
        const dz = npc.targetZ - npc.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0.5) {
          const step = npc.moveSpeed * 0.5 * fixedDelta;
          npc.x += (dx / dist) * step;
          npc.z += (dz / dist) * step;
        }
        break;
      }
    }
  }

  private attemptReproduction(parent: AutonomousNPC): void {
    if (this.npcs.filter((n) => n.alive).length >= 100) return; // Population cap

    const childCost = 3500;
    parent.wealthCopper -= childCost;

    const childTraits: NPCTraits = {
      tradeProwess: Math.max(0.4, Math.min(2.5, parent.traits.tradeProwess + (this.prng() - 0.5) * 0.2)),
      harvestYield: Math.max(0.4, Math.min(2.5, parent.traits.harvestYield + (this.prng() - 0.5) * 0.2)),
      combatGrit: Math.max(0.4, Math.min(2.5, parent.traits.combatGrit + (this.prng() - 0.5) * 0.2)),
      frugality: Math.max(0.4, Math.min(2.5, parent.traits.frugality + (this.prng() - 0.5) * 0.2)),
    };

    const child: AutonomousNPC = {
      id: this.npcs.length + 1,
      name: `${parent.name.split(' ')[0]} II (G${parent.generation + 1})`,
      generation: parent.generation + 1,
      parentName: parent.name,
      alive: true,
      ageTicks: 0,
      macroState: 'PRODUCTION',
      subState: 'IDLE',
      traits: childTraits,
      hunger: 1000,
      fatigue: 500,
      hp: 100,
      maxHp: 100,
      wealthCopper: 1000,
      inventory: new Map([[1, 3]]),
      homeHubId: parent.homeHubId,
      currentHubId: parent.currentHubId,
      assignedGuildId: parent.assignedGuildId,
      x: parent.x + (this.prng() - 0.5) * 4,
      z: parent.z + (this.prng() - 0.5) * 4,
      prevX: parent.x,
      prevZ: parent.z,
      targetX: parent.x,
      targetZ: parent.z,
      moveSpeed: parent.moveSpeed,
      memory: new NPCShortTermMemory(8),
      longTermMemory: new NPCLongTermMemory(parent.homeHubId, {
        zoneLeaderId: parent.longTermMemory.getZoneLeadership().zoneLeaderId,
        zoneLeaderName: parent.longTermMemory.getZoneLeadership().zoneLeaderName,
        zoneLeaderTitle: parent.longTermMemory.getZoneLeadership().zoneLeaderTitle,
        zoneLeaderFaction: parent.longTermMemory.getZoneLeadership().zoneLeaderFaction,
        socialStanding: parent.longTermMemory.getZoneLeadership().socialStanding,
        reputationScore: parent.longTermMemory.getZoneLeadership().reputationScore,
      }),
    };

    this.npcs.push(child);
    this.totalBirths++;
  }

  private handleNPCDeath(npc: AutonomousNPC): void {
    npc.alive = false;
    this.totalDeaths++;

    // Return inventory to local hub
    const hub = this.hubs.get(npc.currentHubId);
    if (hub) {
      for (const [resId, qty] of npc.inventory.entries()) {
        hub.stock.set(resId, (hub.stock.get(resId) || 0) + qty);
      }
    }
  }

  private simulateRegionalEconomyPulsing(): void {
    for (const hub of this.hubs.values()) {
      // Record historical prices
      for (const commodity of COMMODITIES) {
        const currentPrice = this.getMarketPriceCopper(hub.id, commodity.id);
        const hist = hub.priceHistory.get(commodity.id) || [];
        hist.push(currentPrice);
        if (hist.length > 20) hist.shift();
        hub.priceHistory.set(commodity.id, hist);
      }

      // Natural consumption
      for (const consumeId of hub.consumptionFocus) {
        const cur = hub.stock.get(consumeId) || 0;
        if (cur > 0 && this.prng() < 0.4) {
          hub.stock.set(consumeId, cur - 1);
        }
      }
    }
  }

  /**
   * Player Market Actions (Buy / Sell)
   */
  public executePlayerBuy(hubId: string, resourceId: number, quantity: number, playerGold: number): {
    success: boolean;
    costCopper: number;
    error?: string;
  } {
    const hub = this.hubs.get(hubId);
    if (!hub) return { success: false, costCopper: 0, error: 'Market hub not found' };

    const unitPrice = this.getMarketPriceCopper(hubId, resourceId);
    const totalCost = unitPrice * quantity;
    const playerGoldInCopper = playerGold * 1000;

    if (playerGoldInCopper < totalCost) {
      return { success: false, costCopper: totalCost, error: 'Insufficient gold' };
    }

    const currentStock = hub.stock.get(resourceId) || 0;
    if (currentStock < quantity) {
      return { success: false, costCopper: totalCost, error: 'Market has insufficient stock' };
    }

    hub.stock.set(resourceId, currentStock - quantity);
    hub.treasuryCopper += Math.round(totalCost * (hub.taxRateBasisPoints / 10000));
    this.totalTradeVolumeCopper += totalCost;

    return { success: true, costCopper: totalCost };
  }

  public executePlayerSell(hubId: string, resourceId: number, quantity: number): {
    success: boolean;
    payoutCopper: number;
    error?: string;
  } {
    const hub = this.hubs.get(hubId);
    if (!hub) return { success: false, payoutCopper: 0, error: 'Market hub not found' };

    const unitPrice = this.getMarketPriceCopper(hubId, resourceId);
    const grossPayout = unitPrice * quantity;
    const tax = Math.round(grossPayout * (hub.taxRateBasisPoints / 10000));
    const netPayout = grossPayout - tax;

    hub.treasuryCopper += tax;
    hub.stock.set(resourceId, (hub.stock.get(resourceId) || 0) + quantity);
    this.totalTradeVolumeCopper += grossPayout;

    return { success: true, payoutCopper: netPayout };
  }

  /**
   * Serializes current NPC simulation state to high-density binary ArrayBuffer.
   */
  public exportBinarySnapshot(): ArrayBuffer {
    return BinaryNPCSnapshotSerializer.serialize(this.npcs, this.currentTick);
  }

  /**
   * Restores NPC state from authoritative binary ArrayBuffer.
   */
  public importBinarySnapshot(buffer: ArrayBuffer): void {
    const res = BinaryNPCSnapshotSerializer.deserialize(buffer);
    this.currentTick = res.tick;

    for (let i = 0; i < res.npcs.length; i++) {
      const snap = res.npcs[i];
      const existing = this.npcs.find((n) => `npc_${n.id}` === snap.id || n.name === snap.name);
      if (existing) {
        existing.x = snap.homePosition.x;
        existing.z = snap.homePosition.z;
        existing.targetX = snap.targetPosition?.x ?? snap.homePosition.x;
        existing.targetZ = snap.targetPosition?.z ?? snap.homePosition.z;
        existing.hunger = snap.needs.hunger * 100;
        existing.wealthCopper = snap.needs.wealthGold * 1000;
        existing.fatigue = Math.max(0, (100 - snap.needs.energy) * 100);

        if (snap.recentMemories && snap.recentMemories.length > 0) {
          existing.memory.clear();
          for (const m of snap.recentMemories) {
            existing.memory.record(m.type, m.x, m.z, m.tickRecorded, {
              ttlTicks: m.ttlTicks,
              intensity: m.intensity,
              metadata: m.metadata,
            });
          }
        }
      }
    }
  }
}
