import * as THREE from 'three';
import { ItemRarity, LootDropEntity, RPGItem, WorldMobEntity } from '../types';
import { RPG_ITEMS_DATABASE } from '../data/mmorpgData';

interface LootVisual {
  entity: LootDropEntity;
  group: THREE.Group;
  beacon: THREE.Mesh;
  orb: THREE.Mesh;
  light: THREE.PointLight;
}

export class LootDropManager {
  public scene: THREE.Scene;
  public lootDrops: LootVisual[] = [];
  private dropCounter: number = 0;
  
  // Pity counter per mob type (tracks failed 'epic' rarity drop attempts)
  private pityCounters: Map<string, number> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public getPityCount(mobType: string): number {
    return this.pityCounters.get(mobType) || 0;
  }

  public setPityCount(mobType: string, count: number): void {
    this.pityCounters.set(mobType, Math.max(0, count));
  }

  public resetPity(mobType: string): void {
    this.pityCounters.set(mobType, 0);
  }

  public getAllPityCounters(): Record<string, number> {
    const obj: Record<string, number> = {};
    for (const [key, val] of this.pityCounters.entries()) {
      obj[key] = val;
    }
    return obj;
  }

  /**
   * Evaluates mob death drops, tracks failed epic rarity attempts,
   * and triggers guaranteed legendary drop at 50 failed attempts for this mob type.
   */
  public processMobLoot(mob: WorldMobEntity): {
    droppedItem?: RPGItem;
    isPityGuaranteed: boolean;
    pityCount: number;
    goldAmount: number;
  } {
    const mobType = mob.type || 'standard_mob';
    const currentPity = this.getPityCount(mobType);

    // 1. Check if Pity Threshold (50 kills without epic/legendary) is reached
    // Note: If currentPity is 49, this 50th kill guarantees the Legendary drop.
    if (currentPity >= 49) {
      this.resetPity(mobType);

      // Find available legendary items from database
      const legendaryPool = RPG_ITEMS_DATABASE.filter((i) => i.rarity === 'legendary');
      let guaranteedItem: RPGItem;
      if (legendaryPool.length > 0) {
        guaranteedItem = { ...legendaryPool[Math.floor(Math.random() * legendaryPool.length)] };
      } else {
        guaranteedItem = {
          id: `legendary_pity_${mobType}_${Date.now()}`,
          name: `Legendäres Titanen-Relikt (${mob.name})`,
          description: 'Ein urzeitliches Meisterwerk der Schicksalsschmiede, garantiert nach 50 Triumphen.',
          icon: '👑',
          rarity: 'legendary',
          slot: 'relic',
          levelReq: Math.max(1, mob.level),
          stats: { attack: 60, armor: 45, maxHp: 250, critChance: 15 },
          valueGold: 2500,
        };
      }

      this.spawnLoot(guaranteedItem, mob.x, mob.z, mob.goldReward * 2);

      return {
        droppedItem: guaranteedItem,
        isPityGuaranteed: true,
        pityCount: 0,
        goldAmount: mob.goldReward * 2,
      };
    }

    // 2. Standard Drop Roll from Mob Drop Table
    let rolledItem: RPGItem | undefined;
    if (mob.dropTable && mob.dropTable.length > 0) {
      // High chance on elites/bosses, moderate on standard mobs
      const dropChance = mob.isBoss ? 1.0 : mob.isElite ? 0.9 : 0.75;
      if (Math.random() <= dropChance) {
        const randIndex = Math.floor(Math.random() * mob.dropTable.length);
        rolledItem = { ...mob.dropTable[randIndex] };
      }
    }

    // Check if the rolled drop is epic or higher
    const isEpicOrHigher =
      rolledItem &&
      (rolledItem.rarity === 'epic' ||
        rolledItem.rarity === 'legendary' ||
        rolledItem.rarity === 'mystic');

    if (isEpicOrHigher) {
      // Successful epic drop -> reset pity for this mob type
      this.resetPity(mobType);
    } else {
      // Failed epic attempt -> increment pity counter
      this.setPityCount(mobType, currentPity + 1);
    }

    if (rolledItem) {
      this.spawnLoot(rolledItem, mob.x, mob.z, mob.goldReward);
    }

    return {
      droppedItem: rolledItem,
      isPityGuaranteed: false,
      pityCount: this.getPityCount(mobType),
      goldAmount: mob.goldReward,
    };
  }

  public spawnLoot(item: RPGItem, x: number, z: number, goldAmount: number = 0): LootDropEntity {
    const id = `loot_${++this.dropCounter}`;
    const rarity = item.rarity;

    let colorHex = 0xffffff;
    if (rarity === 'uncommon') colorHex = 0x22c55e;
    else if (rarity === 'rare') colorHex = 0x3b82f6;
    else if (rarity === 'epic') colorHex = 0xa855f7;
    else if (rarity === 'legendary') colorHex = 0xf59e0b;

    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // 1. Glowing Core Orb / Chest
    const orbGeo = new THREE.OctahedronGeometry(0.4, 0);
    const orbMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 1.5,
      roughness: 0.1,
    });
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.position.y = 0.8;
    group.add(orb);

    // 2. Vertical Light Pillar / Beam (MMORPG Style)
    const beamGeo = new THREE.CylinderGeometry(0.12, 0.4, 12, 8, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const beacon = new THREE.Mesh(beamGeo, beamMat);
    beacon.position.y = 6;
    group.add(beacon);

    // 3. Ground Light Pool
    const poolGeo = new THREE.CircleGeometry(1.2, 16);
    poolGeo.rotateX(-Math.PI / 2);
    const poolMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.5,
    });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.position.y = 0.05;
    group.add(pool);

    // 4. Point Light
    const light = new THREE.PointLight(colorHex, 1.2, 8);
    light.position.set(0, 1.2, 0);
    group.add(light);

    this.scene.add(group);

    const entity: LootDropEntity = {
      id,
      item,
      x,
      y: 0,
      z,
      goldAmount,
      rarity,
      beamColor: `#${colorHex.toString(16).padStart(6, '0')}`,
      spawnTime: Date.now(),
    };

    const visual: LootVisual = {
      entity,
      group,
      beacon,
      orb,
      light,
    };

    this.lootDrops.push(visual);
    return entity;
  }

  public update(delta: number) {
    this.lootDrops.forEach((loot) => {
      // Bobbing & Rotating Animation
      loot.orb.rotation.y += delta * 2.5;
      loot.orb.rotation.x += delta * 1.2;
      loot.orb.position.y = 0.8 + Math.sin(Date.now() * 0.004) * 0.18;
      loot.beacon.rotation.y += delta * 0.8;
    });
  }

  public removeLoot(lootId: string) {
    const index = this.lootDrops.findIndex((l) => l.entity.id === lootId);
    if (index !== -1) {
      const loot = this.lootDrops[index];
      this.scene.remove(loot.group);
      this.lootDrops.splice(index, 1);
    }
  }

  public collectNearbyCommonLoot(
    playerX: number,
    playerZ: number,
    pickupRadius: number = 4.0
  ): LootDropEntity[] {
    const collected: LootDropEntity[] = [];
    const remaining: LootVisual[] = [];

    for (const loot of this.lootDrops) {
      const dist = Math.hypot(loot.entity.x - playerX, loot.entity.z - playerZ);
      if (dist <= pickupRadius && loot.entity.rarity === 'common') {
        collected.push(loot.entity);
        this.scene.remove(loot.group);
      } else {
        remaining.push(loot);
      }
    }

    this.lootDrops = remaining;
    return collected;
  }

  public getNearbyLoot(playerX: number, playerZ: number, pickupRadius: number = 3.5): LootDropEntity | null {
    for (const loot of this.lootDrops) {
      const dist = Math.hypot(loot.entity.x - playerX, loot.entity.z - playerZ);
      if (dist <= pickupRadius) {
        return loot.entity;
      }
    }
    return null;
  }

  public getAllDrops(): LootDropEntity[] {
    return this.lootDrops.map((l) => l.entity);
  }
}
