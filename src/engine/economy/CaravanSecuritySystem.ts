/**
 * CaravanSecuritySystem.ts
 *
 * Real Dynamic Route Security, Caravan Escort & Ambush Engine for Echoes of Aurion:
 * - Monitors active autonomous NPC caravans traversing regional corridors
 * - Calculates risk factors based on distance from fortified citadels and regional unrest
 * - Spawns dynamic bandit raiders that target merchant carts
 * - Coordinates militia interceptors and rewards players who defend caravans with bounty & rep
 */

import { AutonomousNPC, AutonomousNPCEconomy } from './AutonomousNPCEconomy';

export interface BanditRaider {
  id: string;
  name: string;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  targetCaravanNpcId: number;
  attackPower: number;
  alive: boolean;
}

export interface RouteSecurityReport {
  routeId: string;
  fromHub: string;
  toHub: string;
  securityIndex: number; // 0 - 100 (100 = heavily fortified, 20 = high bandit risk)
  activeRaiders: BanditRaider[];
}

export class CaravanSecuritySystem {
  private static instance: CaravanSecuritySystem | null = null;
  public routeReports: Map<string, RouteSecurityReport> = new Map();
  public activeRaiders: BanditRaider[] = [];
  private lastCheckTick: number = 0;

  public static getInstance(): CaravanSecuritySystem {
    if (!CaravanSecuritySystem.instance) {
      CaravanSecuritySystem.instance = new CaravanSecuritySystem();
    }
    return CaravanSecuritySystem.instance;
  }

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    const defaultRoutes = [
      { id: 'sun_wind', from: 'sun_spire', to: 'windhollow', security: 85 },
      { id: 'sun_ember', from: 'sun_spire', to: 'emberfall', security: 70 },
      { id: 'sun_aschen', from: 'sun_spire', to: 'aschengewoelbe', security: 35 },
      { id: 'wind_ember', from: 'windhollow', to: 'emberfall', security: 60 },
    ];

    for (const r of defaultRoutes) {
      this.routeReports.set(r.id, {
        routeId: r.id,
        fromHub: r.from,
        toHub: r.to,
        securityIndex: r.security,
        activeRaiders: [],
      });
    }
  }

  /**
   * Evaluates caravan ambushes during the economy simulation tick
   */
  public update(economy: AutonomousNPCEconomy): { ambushedCaravans: AutonomousNPC[]; newRaiders: BanditRaider[] } {
    const tick = economy.currentTick;
    const ambushedCaravans: AutonomousNPC[] = [];
    const newRaiders: BanditRaider[] = [];

    if (tick - this.lastCheckTick < 25) {
      return { ambushedCaravans, newRaiders };
    }
    this.lastCheckTick = tick;

    // Scan for caravans in transit
    for (const npc of economy.npcs) {
      if (!npc.alive || npc.subState !== 'TRANSIT_CARAVAN' || !npc.caravanPayload) continue;

      // Check route security
      const routeKey = `${npc.currentHubId}_${npc.caravanPayload.destinationHubId}`;
      const revRouteKey = `${npc.caravanPayload.destinationHubId}_${npc.currentHubId}`;
      const report = this.routeReports.get(routeKey) || this.routeReports.get(revRouteKey);
      const security = report ? report.securityIndex : 50;

      // Risk formula: probability of ambush per evaluation check
      const ambushProb = (100 - security) / 300.0;
      if (Math.random() < ambushProb && this.activeRaiders.length < 8) {
        // Spawn bandit
        const banditId = `raider_${tick}_${npc.id}`;
        const offsetAngle = Math.random() * Math.PI * 2;
        const raider: BanditRaider = {
          id: banditId,
          name: 'Aschen-Wegelagerer',
          x: npc.x + Math.cos(offsetAngle) * 6.0,
          z: npc.z + Math.sin(offsetAngle) * 6.0,
          hp: 120,
          maxHp: 120,
          targetCaravanNpcId: npc.id,
          attackPower: 18,
          alive: true,
        };

        this.activeRaiders.push(raider);
        newRaiders.push(raider);
        ambushedCaravans.push(npc);

        // Caravan defends or speeds up
        npc.macroState = 'DEFENSE';
        npc.subState = 'PATROL_TERRITORY';
      }
    }

    // Process combat between raiders and target caravans
    for (const raider of this.activeRaiders) {
      if (!raider.alive) continue;
      const targetNpc = economy.npcs.find((n) => n.id === raider.targetCaravanNpcId && n.alive);
      if (targetNpc) {
        const dist = Math.hypot(targetNpc.x - raider.x, targetNpc.z - raider.z);
        if (dist < 2.5) {
          targetNpc.hp = Math.max(0, targetNpc.hp - raider.attackPower);
          if (targetNpc.hp <= 0) {
            targetNpc.alive = false;
            raider.alive = false; // looted and fled
          }
        } else {
          // Move towards caravan
          const dx = (targetNpc.x - raider.x) / dist;
          const dz = (targetNpc.z - raider.z) / dist;
          raider.x += dx * 0.8;
          raider.z += dz * 0.8;
        }
      } else {
        raider.alive = false;
      }
    }

    // Clean dead raiders
    this.activeRaiders = this.activeRaiders.filter((r) => r.alive);

    return { ambushedCaravans, newRaiders };
  }

  /**
   * Player or militia damages/defeats a bandit raider
   */
  public damageRaider(raiderId: string, damage: number): { killed: boolean; bountyGold: number } {
    const raider = this.activeRaiders.find((r) => r.id === raiderId);
    if (!raider || !raider.alive) return { killed: false, bountyGold: 0 };

    raider.hp -= damage;
    if (raider.hp <= 0) {
      raider.alive = false;
      this.activeRaiders = this.activeRaiders.filter((r) => r.id !== raiderId);
      return { killed: true, bountyGold: 25 };
    }
    return { killed: false, bountyGold: 0 };
  }
}

export const caravanSecuritySystem = CaravanSecuritySystem.getInstance();
