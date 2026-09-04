import * as THREE from 'three';
import { RPGItem, WorldMobEntity } from '../types';
import { RPG_ITEMS_DATABASE } from '../data/mmorpgData';
import { LootDropManager } from './LootDropManager';
import { threatMatrix } from '../engine/combat/ThreatMatrix';
import { navGrid, Waypoint } from '../engine/pathfinding/NavGrid';
import { collisionSystem } from '../world/WorldCollisionSystem';
import { createMobStateMachine, MobFsmContext, MobVisualReference } from '../engine/fsm/MobFSM';
import { EntityStateMachine } from '../engine/fsm/EntityStateMachine';

interface MobVisual {
  entity: WorldMobEntity;
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  headMesh?: THREE.Mesh;
  weapons?: THREE.Mesh[];
  healthBarMesh: THREE.Mesh;
  telegraphRing?: THREE.Mesh;
  deathAnimTimer?: number;
  currentPath?: Waypoint[];
  lastPathCalcTime?: number;
  fsm?: EntityStateMachine<MobFsmContext>;
}

export class MobManager {
  public scene: THREE.Scene;
  public lootManager: LootDropManager;
  public mobs: MobVisual[] = [];
  private mobCounter: number = 0;

  // Boss telegraph state
  public bossEntity: WorldMobEntity | null = null;

  constructor(scene: THREE.Scene, lootManager: LootDropManager) {
    this.scene = scene;
    this.lootManager = lootManager;

    // Seed Open World Mobs across zones
    this.seedOpenWorldMobs();
  }

  private seedOpenWorldMobs() {
    // 1. Whispering Woods (North-East: X: 35 to 80, Z: -25 to -80)
    for (let i = 0; i < 8; i++) {
      const x = 38 + Math.random() * 45;
      const z = -28 - Math.random() * 45;
      this.spawnMob('clockwork_stalker', x, z, 2 + Math.floor(Math.random() * 2));
    }

    for (let i = 0; i < 6; i++) {
      const x = 45 + Math.random() * 40;
      const z = -35 - Math.random() * 45;
      this.spawnMob('aether_wisp', x, z, 3 + Math.floor(Math.random() * 2));
    }

    // 2. Scorched Iron Quarry (West: X: -35 to -90, Z: -40 to 40)
    for (let i = 0; i < 8; i++) {
      const x = -40 - Math.random() * 45;
      const z = -30 + Math.random() * 60;
      this.spawnMob('corrupted_golem', x, z, 4 + Math.floor(Math.random() * 3));
    }

    for (let i = 0; i < 3; i++) {
      const x = -55 - Math.random() * 30;
      const z = -10 + Math.random() * 30;
      this.spawnMob('centurion_elite', x, z, 7 + Math.floor(Math.random() * 2));
    }

    // 3. Void Spire Perimeter
    for (let i = 0; i < 5; i++) {
      const x = (Math.random() - 0.5) * 45;
      const z = 42 + Math.random() * 20;
      this.spawnMob('steam_drake', x, z, 6 + Math.floor(Math.random() * 3));
    }

    // 4. Epic World Boss in the Center of Void Arena (X: 0, Z: 65)
    this.spawnWorldBoss(0, 65);
  }

  public spawnMob(
    type: WorldMobEntity['type'],
    x: number,
    z: number,
    level: number = 3
  ): WorldMobEntity {
    const id = `mob_${++this.mobCounter}`;
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    let name = 'Clockwork Stalker';
    let maxHp = 180 + level * 45;
    let radius = 1.2;
    let attackRange = 2.8;
    let damage = 18 + level * 5;
    let expReward = 45 + level * 15;
    let goldReward = 12 + level * 6;
    let colorHex = 0xd97706;
    let isBoss = false;
    let isElite = false;

    const drops: RPGItem[] = [
      RPG_ITEMS_DATABASE.find((i) => i.id === 'item_potion_hp')!,
    ];

    if (type === 'clockwork_stalker') {
      name = `Clockwork Stalker (Lv.${level})`;
      colorHex = 0xf59e0b;
      drops.push(RPG_ITEMS_DATABASE.find((i) => i.id === 'item_boots_rare')!);
    } else if (type === 'aether_wisp') {
      name = `Aether Wisp (Lv.${level})`;
      colorHex = 0x8b5cf6;
      maxHp = 140 + level * 35;
      attackRange = 14.0;
      drops.push(RPG_ITEMS_DATABASE.find((i) => i.id === 'item_ring_epic')!);
    } else if (type === 'corrupted_golem') {
      name = `Corrupted Iron Golem (Lv.${level})`;
      colorHex = 0xef4444;
      maxHp = 360 + level * 75;
      damage = 32 + level * 8;
      radius = 1.8;
      drops.push(RPG_ITEMS_DATABASE.find((i) => i.id === 'item_sword_rare')!);
      drops.push(RPG_ITEMS_DATABASE.find((i) => i.id === 'item_shield_epic')!);
    } else if (type === 'centurion_elite') {
      name = `Centurion Overlord (Lv.${level} Elite)`;
      colorHex = 0xec4899;
      maxHp = 780 + level * 120;
      damage = 55 + level * 10;
      radius = 2.2;
      isElite = true;
      expReward = 220;
      goldReward = 85;
      drops.push(RPG_ITEMS_DATABASE.find((i) => i.id === 'item_chest_epic')!);
      drops.push(RPG_ITEMS_DATABASE.find((i) => i.id === 'item_bow_epic')!);
    } else if (type === 'steam_drake') {
      name = `Aether Steam Drake (Lv.${level})`;
      colorHex = 0x06b6d4;
      maxHp = 420 + level * 80;
      damage = 42 + level * 7;
      attackRange = 12.0;
      drops.push(RPG_ITEMS_DATABASE.find((i) => i.id === 'item_staff_epic')!);
    }

    // 3D Geometry for Mob
    const mobMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      metalness: 0.8,
      roughness: 0.25,
    });

    let bodyGeo: THREE.BufferGeometry;
    if (type === 'corrupted_golem' || type === 'centurion_elite') {
      bodyGeo = new THREE.BoxGeometry(radius * 1.5, radius * 2.0, radius * 1.2);
    } else if (type === 'aether_wisp') {
      bodyGeo = new THREE.OctahedronGeometry(radius, 0);
    } else {
      bodyGeo = new THREE.CylinderGeometry(radius * 0.6, radius * 0.9, radius * 1.8, 6);
    }

    const bodyMesh = new THREE.Mesh(bodyGeo, mobMat);
    bodyMesh.position.y = radius * 1.0;
    group.add(bodyMesh);

    // Glowing Core/Eyes
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xff0000,
      emissiveIntensity: 2.0,
    });
    const eyeGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
    eye1.position.set(-0.3, radius * 1.2, radius * 0.6);
    const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
    eye2.position.set(0.3, radius * 1.2, radius * 0.6);
    group.add(eye1);
    group.add(eye2);

    // Overhead Health Bar in 3D Space
    const hpBarGeo = new THREE.PlaneGeometry(1.8, 0.22);
    const hpBarMat = new THREE.MeshBasicMaterial({
      color: isElite ? 0xec4899 : 0x22c55e,
      side: THREE.DoubleSide,
    });
    const healthBarMesh = new THREE.Mesh(hpBarGeo, hpBarMat);
    healthBarMesh.position.set(0, radius * 2.2 + 0.5, 0);
    group.add(healthBarMesh);

    this.scene.add(group);

    const entity: WorldMobEntity = {
      id,
      name,
      type,
      level,
      hp: maxHp,
      maxHp,
      x,
      y: 0,
      z,
      spawnX: x,
      spawnZ: z,
      radius,
      attackRange,
      damage,
      expReward,
      goldReward,
      isAggroed: false,
      isBoss,
      isElite,
      patrolAngle: Math.random() * Math.PI * 2,
      attackCooldown: 0,
      maxAttackCooldown: type === 'aether_wisp' ? 2.5 : 1.8,
      dropTable: drops,
      color: `#${colorHex.toString(16).padStart(6, '0')}`,
    };

    const visual: MobVisual = {
      entity,
      group,
      bodyMesh,
      healthBarMesh,
    };
    visual.fsm = createMobStateMachine(visual as any);

    threatMatrix.registerMob(id, x, z, isBoss ? 65.0 : isElite ? 45.0 : 35.0);
    this.mobs.push(visual);
    return entity;
  }

  public spawnWorldBoss(x: number = 0, z: number = 65): WorldMobEntity {
    const id = 'world_boss_titan_ignis';
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const level = 15;
    const name = 'Titan Ignis the Overclocked (World Boss)';
    const maxHp = 5200;
    const radius = 4.2;
    const damage = 95;
    const expReward = 1800;
    const goldReward = 950;
    const colorHex = 0x9333ea;

    // Colossal Boss Model
    const bossMat = new THREE.MeshStandardMaterial({
      color: 0x581c87,
      emissive: 0x3b0764,
      metalness: 0.9,
      roughness: 0.2,
    });

    const fireMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xef4444,
      emissiveIntensity: 2.0,
    });

    // Massive Torso
    const torsoGeo = new THREE.BoxGeometry(4.5, 6.0, 3.5);
    const bodyMesh = new THREE.Mesh(torsoGeo, bossMat);
    bodyMesh.position.y = 5.5;
    group.add(bodyMesh);

    // Glowing Molten Heart Core
    const heartGeo = new THREE.IcosahedronGeometry(1.4, 1);
    const heart = new THREE.Mesh(heartGeo, fireMat);
    heart.position.set(0, 5.5, 1.8);
    group.add(heart);

    // Giant Shoulders & Head
    const headGeo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
    const head = new THREE.Mesh(headGeo, bossMat);
    head.position.set(0, 9.5, 0.4);
    group.add(head);

    // Horns
    const hornGeo = new THREE.ConeGeometry(0.8, 3.2, 6);
    const leftHorn = new THREE.Mesh(hornGeo, fireMat);
    leftHorn.position.set(-1.8, 11.5, 0);
    leftHorn.rotation.z = Math.PI / 4;
    group.add(leftHorn);

    const rightHorn = new THREE.Mesh(hornGeo, fireMat);
    rightHorn.position.set(1.8, 11.5, 0);
    rightHorn.rotation.z = -Math.PI / 4;
    group.add(rightHorn);

    // Telegraph Ground AoE Ring
    const ringGeo = new THREE.RingGeometry(6.5, 7.5, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
    });
    const telegraphRing = new THREE.Mesh(ringGeo, ringMat);
    telegraphRing.position.y = 0.1;
    group.add(telegraphRing);

    // Health Bar
    const hpBarGeo = new THREE.PlaneGeometry(5.0, 0.5);
    const hpBarMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
    const healthBarMesh = new THREE.Mesh(hpBarGeo, hpBarMat);
    healthBarMesh.position.set(0, 13.5, 0);
    group.add(healthBarMesh);

    this.scene.add(group);

    const drops: RPGItem[] = [
      RPG_ITEMS_DATABASE.find((i) => i.id === 'item_legendary_blade')!,
      RPG_ITEMS_DATABASE.find((i) => i.id === 'item_relic_legendary')!,
      RPG_ITEMS_DATABASE.find((i) => i.id === 'item_mount_drake')!,
      RPG_ITEMS_DATABASE.find((i) => i.id === 'item_potion_elixir')!,
    ];

    const entity: WorldMobEntity = {
      id,
      name,
      type: 'titan_boss',
      level,
      hp: maxHp,
      maxHp,
      x,
      y: 0,
      z,
      spawnX: x,
      spawnZ: z,
      radius,
      attackRange: 8.0,
      damage,
      expReward,
      goldReward,
      isAggroed: false,
      isBoss: true,
      isElite: true,
      patrolAngle: 0,
      attackCooldown: 0,
      maxAttackCooldown: 2.2,
      dropTable: drops,
      color: '#9333ea',
      castProgress: 0,
      castSkillName: 'Overclocked Cataclysm Nova',
    };

    const visual: MobVisual = {
      entity,
      group,
      bodyMesh,
      healthBarMesh,
      telegraphRing,
    };
    visual.fsm = createMobStateMachine(visual as any);

    this.bossEntity = entity;
    threatMatrix.registerMob(id, x, z, 75.0);
    this.mobs.push(visual);
    return entity;
  }

  public update(
    delta: number,
    playerX: number,
    playerZ: number,
    onMobAttack?: (mob: WorldMobEntity, dmg: number) => void
  ) {
    const activeMobs: MobVisual[] = [];

    this.mobs.forEach((visual) => {
      const mob = visual.entity;

      // 1. Deterministic Behavioral Finite State Machine (FSM) Tick
      if (visual.fsm) {
        visual.fsm.update(
          {
            mob,
            visual: visual as any,
            playerX,
            playerZ,
            delta,
            onMobAttack,
            scene: this.scene,
            onMobRespawnRequested: (deadMob) => {
              setTimeout(() => {
                this.spawnMob(deadMob.type, deadMob.spawnX, deadMob.spawnZ, deadMob.level);
              }, 25000);
            },
          },
          delta
        );
      }

      // 2. Handle Death Lifecycle and Scene Removal
      if (visual.fsm?.getCurrentStateId() === 'dead') {
        if (visual.deathAnimTimer !== undefined) {
          visual.deathAnimTimer -= delta;
          if (visual.deathAnimTimer <= 0) {
            this.scene.remove(visual.group);
            return; // Finished death cycle - remove from active list
          }
        }
      }

      // 3. Update 3D Group Transform
      visual.group.position.set(mob.x, 0, mob.z);

      // 4. Update Billboarded Overhead Health Bar
      const hpPct = Math.max(0, mob.hp / mob.maxHp);
      visual.healthBarMesh.scale.x = Math.max(0.01, hpPct);
      visual.healthBarMesh.rotation.y = Math.atan2(playerX - mob.x, playerZ - mob.z);

      activeMobs.push(visual);
    });

    this.mobs = activeMobs;
  }

  public damageMob(
    mobId: string,
    damage: number,
    attackerId: string = 'hero_player_1',
    isTankRole: boolean = false
  ): { mob: WorldMobEntity | null; isKilled: boolean; lootDropped?: RPGItem } {
    const visual = this.mobs.find((m) => m.entity.id === mobId);
    if (!visual) return { mob: null, isKilled: false };

    const mob = visual.entity;
    mob.hp -= damage;
    mob.isAggroed = true; // immediately retaliate

    // Authoritative Threat Matrix update
    threatMatrix.addDamageThreat(mobId, attackerId, damage, isTankRole);

    // Flash hit reaction
    (visual.bodyMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0xffffff);
    setTimeout(() => {
      (visual.bodyMesh.material as THREE.MeshStandardMaterial).emissive.setHex(
        mob.isBoss ? 0x3b0764 : 0x000000
      );
    }, 120);

    if (mob.hp <= 0) {
      mob.hp = 0;
      visual.deathAnimTimer = 1.2; // trigger fade out
      visual.fsm?.setState('dead', {
        mob,
        visual: visual as any,
        playerX: mob.x,
        playerZ: mob.z,
        delta: 0,
        scene: this.scene,
      });
      threatMatrix.unregisterMob(mobId);

      // Drop Loot from Mob Drop Table
      let droppedItem: RPGItem | undefined;
      if (mob.dropTable.length > 0) {
        const randIndex = Math.floor(Math.random() * mob.dropTable.length);
        droppedItem = mob.dropTable[randIndex];
        this.lootManager.spawnLoot(droppedItem, mob.x, mob.z, mob.goldReward);
      }

      return { mob, isKilled: true, lootDropped: droppedItem };
    }

    return { mob, isKilled: false };
  }

  public getNearbyMobs(x: number, z: number, range: number): WorldMobEntity[] {
    return this.mobs
      .filter((m) => !m.deathAnimTimer)
      .map((m) => m.entity)
      .filter((m) => Math.hypot(m.x - x, m.z - z) <= range);
  }

  public getMobById(id: string): WorldMobEntity | undefined {
    return this.mobs.find((m) => m.entity.id === id)?.entity;
  }

  public spawnCustomMob(
    type: WorldMobEntity['type'],
    x: number,
    z: number,
    level: number = 5
  ): WorldMobEntity {
    return this.spawnMob(type, x, z, level);
  }
}
