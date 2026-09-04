/**
 * NPCStateMachine.ts
 *
 * Deterministic Hierarchical State Machine (HSM) for Autonomous NPCs in Echoes of Aurion.
 * Controls behavioral transitions based on internal Needs (Hunger, Security, Energy, Wealth)
 * and environmental factors across deterministic fixed simulation ticks.
 */

import { NPCMemoryRecord } from '../engine/ai/NPCShortTermMemory';

export enum NPCBaseState {
  IDLE = 'IDLE',
  WORKING = 'WORKING',
  TRADE = 'TRADE',
  DEFEND = 'DEFEND',
}

export enum NPCSubState {
  // Idle substates
  RESTING = 'RESTING',
  WANDERING = 'WANDERING',
  SOCIALIZING = 'SOCIALIZING',

  // Working substates
  HARVESTING = 'HARVESTING',
  CRAFTING = 'CRAFTING',
  TRANSPORTING = 'TRANSPORTING',

  // Trade substates
  EVALUATING_PRICES = 'EVALUATING_PRICES',
  TRAVELING_TO_MARKET = 'TRAVELING_TO_MARKET',
  EXECUTING_TRANSACTION = 'EXECUTING_TRANSACTION',
  FORAGING_EMERGENCY = 'FORAGING_EMERGENCY',

  // Defend substates
  ALERT_PATROL = 'ALERT_PATROL',
  COMBAT_ENGAGE = 'COMBAT_ENGAGE',
  RETREATING = 'RETREATING',
}

export interface NPCNeeds {
  hunger: number;     // 0 (satiated) to 100 (starving)
  security: number;   // 0 (in mortal peril) to 100 (completely secure)
  energy: number;     // 0 (exhausted) to 100 (fully energized)
  wealthGold: number; // Current monetary reserve
}

export interface NPCSnapshot {
  id: string;
  name: string;
  baseState: NPCBaseState;
  subState: NPCSubState;
  needs: NPCNeeds;
  inventory: Record<string, number>;
  targetPosition?: { x: number; y: number; z: number };
  homePosition: { x: number; y: number; z: number };
  ticksInCurrentState: number;
  recentMemories?: NPCMemoryRecord[];
}

export interface EnvironmentSensors {
  threatLevelNearby: number;    // 0 to 100
  nearestMarketDistance: number;
  nearestResourceDistance: number;
  isTerritoryUnderAttack: boolean;
}

export class NPCStateMachine {
  /**
   * Deterministic Evaluation and State Transition Matrix
   */
  public static evaluateTransitions(
    npc: NPCSnapshot,
    env: EnvironmentSensors
  ): { newBase: NPCBaseState; newSub: NPCSubState } {
    const { hunger, security, energy, wealthGold } = npc.needs;

    // 1. HIGHEST PRIORITY: Security Threat / Defense Response
    if (security < 30 || env.threatLevelNearby > 60 || env.isTerritoryUnderAttack) {
      if (security < 15 && energy < 25) {
        return { newBase: NPCBaseState.DEFEND, newSub: NPCSubState.RETREATING };
      }
      return {
        newBase: NPCBaseState.DEFEND,
        newSub: env.threatLevelNearby > 75 ? NPCSubState.COMBAT_ENGAGE : NPCSubState.ALERT_PATROL,
      };
    }

    // 2. CRITICAL SURVIVAL: Severe Hunger
    if (hunger >= 70) {
      const foodCount = npc.inventory['food'] || 0;
      if (foodCount > 0) {
        // Can directly consume food from inventory
        return { newBase: NPCBaseState.TRADE, newSub: NPCSubState.EXECUTING_TRANSACTION };
      }

      if (wealthGold >= 5) {
        // Has gold to purchase food at the market
        return { newBase: NPCBaseState.TRADE, newSub: NPCSubState.TRAVELING_TO_MARKET };
      }

      // Desperation forage / emergency poaching
      return { newBase: NPCBaseState.TRADE, newSub: NPCSubState.FORAGING_EMERGENCY };
    }

    // 3. FATIGUE / ENERGY RECOVERY: Idle / Rest
    if (energy <= 20) {
      return { newBase: NPCBaseState.IDLE, newSub: NPCSubState.RESTING };
    }

    // 4. COMMERCE / TRADE: Merchant behavior when holding surplus inventory or seeking arbitrage
    const totalSurplusItems = Object.values(npc.inventory).reduce((acc, count) => acc + count, 0);
    if (totalSurplusItems >= 5 && wealthGold >= 10 && hunger < 50) {
      return {
        newBase: NPCBaseState.TRADE,
        newSub: npc.subState === NPCSubState.TRAVELING_TO_MARKET
          ? NPCSubState.TRAVELING_TO_MARKET
          : NPCSubState.EVALUATING_PRICES,
      };
    }

    // 5. DEFAULT PRODUCTIVE CYCLE: Working / Gathering
    if (energy > 40 && hunger < 60) {
      const isCrafter = (npc.inventory['raw_material'] || 0) >= 3;
      return {
        newBase: NPCBaseState.WORKING,
        newSub: isCrafter ? NPCSubState.CRAFTING : NPCSubState.HARVESTING,
      };
    }

    // 6. FALLBACK: Idle Wander / Socializing
    return {
      newBase: NPCBaseState.IDLE,
      newSub: npc.ticksInCurrentState % 20 < 10 ? NPCSubState.WANDERING : NPCSubState.SOCIALIZING,
    };
  }

  /**
   * Deterministic Tick step updating Needs decay and executing state logic
   */
  public static update(
    npc: NPCSnapshot,
    env: EnvironmentSensors,
    fixedDeltaTime: number = 0.1
  ): NPCSnapshot {
    // 1. Natural Needs Decay (rate per second scaled by delta)
    npc.needs.hunger = Math.min(100, npc.needs.hunger + 0.5 * fixedDeltaTime);
    npc.needs.security = Math.max(
      0,
      Math.min(100, npc.needs.security - (env.threatLevelNearby > 20 ? 4.0 : -1.0) * fixedDeltaTime)
    );

    // Energy recovers during rest, drains during work and defense
    if (npc.subState === NPCSubState.RESTING) {
      npc.needs.energy = Math.min(100, npc.needs.energy + 3.0 * fixedDeltaTime);
    } else if (npc.baseState === NPCBaseState.DEFEND || npc.baseState === NPCBaseState.WORKING) {
      npc.needs.energy = Math.max(0, npc.needs.energy - 1.2 * fixedDeltaTime);
    }

    // 2. Evaluate State Transitions
    const { newBase, newSub } = this.evaluateTransitions(npc, env);

    if (newBase !== npc.baseState || newSub !== npc.subState) {
      npc.baseState = newBase;
      npc.subState = newSub;
      npc.ticksInCurrentState = 0;
    } else {
      npc.ticksInCurrentState += 1;
    }

    // 3. Execute Substate Effects
    this.executeSubStateLogic(npc, fixedDeltaTime);

    return npc;
  }

  /**
   * Deterministic 32-bit FNV-1a Hash generator
   */
  public static computeFNV1a32(data: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < data.length; i++) {
      hash ^= data.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  /**
   * Generates a deterministic state hash for an individual NPC
   */
  public static calculateNPCHash(npc: NPCSnapshot): string {
    // Quantize float coordinates and needs to fixed integer points to guarantee platform cross-determinism
    const fixedX = Math.round((npc.targetPosition?.x ?? npc.homePosition.x) * 100);
    const fixedZ = Math.round((npc.targetPosition?.z ?? npc.homePosition.z) * 100);
    const fixedHunger = Math.round(npc.needs.hunger * 10);
    const fixedSecurity = Math.round(npc.needs.security * 10);
    const fixedEnergy = Math.round(npc.needs.energy * 10);
    const fixedWealth = Math.round(npc.needs.wealthGold);

    const invSummary = Object.entries(npc.inventory)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join('|');

    const serialized = `${npc.id}_${npc.baseState}_${npc.subState}_${fixedHunger}_${fixedSecurity}_${fixedEnergy}_${fixedWealth}_${fixedX}_${fixedZ}_[${invSummary}]`;
    return this.computeFNV1a32(serialized);
  }

  /**
   * Generates an aggregated simulation snapshot hash across all active NPCs for a given tick
   */
  public static calculateSimulationStateHash(npcs: NPCSnapshot[], tick: number): string {
    const sorted = [...npcs].sort((a, b) => a.id.localeCompare(b.id));
    const combined = sorted.map((n) => `${n.id}:${this.calculateNPCHash(n)}`).join(';');
    return this.computeFNV1a32(`TICK_${tick}__${combined}`);
  }

  /**
   * Compares local snapshots against authoritative server snapshots to pinpoint desynchronization
   */
  public static compareSnapshots(
    localNpcs: NPCSnapshot[],
    serverNpcs: NPCSnapshot[]
  ): { matched: boolean; divergingNpcIds: string[]; details: string[] } {
    const divergingNpcIds: string[] = [];
    const details: string[] = [];

    const serverMap = new Map<string, NPCSnapshot>();
    for (const s of serverNpcs) {
      serverMap.set(s.id, s);
    }

    for (const local of localNpcs) {
      const server = serverMap.get(local.id);
      if (!server) {
        divergingNpcIds.push(local.id);
        details.push(`[${local.id}] Missing in server snapshot`);
        continue;
      }

      const localHash = this.calculateNPCHash(local);
      const serverHash = this.calculateNPCHash(server);

      if (localHash !== serverHash) {
        divergingNpcIds.push(local.id);
        const diffList: string[] = [];
        if (local.baseState !== server.baseState) diffList.push(`Base(${local.baseState} vs ${server.baseState})`);
        if (local.subState !== server.subState) diffList.push(`Sub(${local.subState} vs ${server.subState})`);
        if (Math.abs(local.needs.hunger - server.needs.hunger) > 1.0) diffList.push(`Hunger(${local.needs.hunger.toFixed(1)} vs ${server.needs.hunger.toFixed(1)})`);
        if (Math.abs(local.needs.security - server.needs.security) > 1.0) diffList.push(`Security(${local.needs.security.toFixed(1)} vs ${server.needs.security.toFixed(1)})`);
        if (local.needs.wealthGold !== server.needs.wealthGold) diffList.push(`Wealth(${local.needs.wealthGold} vs ${server.needs.wealthGold})`);

        details.push(`[${local.id} ${local.name}] Desync: ${diffList.join(', ')}`);
      }
    }

    return {
      matched: divergingNpcIds.length === 0 && localNpcs.length === serverNpcs.length,
      divergingNpcIds,
      details,
    };
  }

  private static executeSubStateLogic(npc: NPCSnapshot, _dt: number): void {
    switch (npc.subState) {
      case NPCSubState.RESTING:
        if (npc.needs.energy >= 95) {
          npc.baseState = NPCBaseState.IDLE;
          npc.subState = NPCSubState.WANDERING;
        }
        break;

      case NPCSubState.EXECUTING_TRANSACTION:
        if ((npc.inventory['food'] || 0) > 0) {
          npc.inventory['food'] -= 1;
          npc.needs.hunger = Math.max(0, npc.needs.hunger - 45);
        }
        break;

      case NPCSubState.HARVESTING:
        // Accumulate raw goods deterministically every 10 ticks
        if (npc.ticksInCurrentState % 10 === 0) {
          npc.inventory['raw_material'] = (npc.inventory['raw_material'] || 0) + 1;
        }
        break;

      case NPCSubState.CRAFTING:
        if (npc.ticksInCurrentState % 15 === 0 && (npc.inventory['raw_material'] || 0) >= 2) {
          npc.inventory['raw_material'] -= 2;
          npc.inventory['finished_goods'] = (npc.inventory['finished_goods'] || 0) + 1;
        }
        break;

      default:
        break;
    }
  }
}
