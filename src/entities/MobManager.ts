import * as THREE from 'three';
import { RPGItem, WorldMobEntity } from '../types';
import { RPG_ITEMS_DATABASE } from '../data/mmorpgData';
import { LootDropManager } from './LootDropManager';
import { threatMatrix } from '../engine/combat/ThreatMatrix';
import { navGrid, Waypoint } from '../engine/pathfinding/NavGrid';
import { collisionSystem } from '../world/WorldCollisionSystem';
import { createMobStateMachine, MobFsmContext, MobVisualReference } from '../engine/fsm/MobFSM';
import { EntityStateMachine } from '../engine/fsm/EntityStateMachine';
import { ThreatTetherVisualizer, TargetPositionInfo } from '../engine/combat/ThreatTetherVisualizer';

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
  public tetherVisualizer: ThreatTetherVisualizer;
  private mobCounter: number = 0;

  // Boss telegraph state
  public bossEntity: WorldMobEntity | null = null;

  public getAllMobs(): WorldMobEntity[] {
    return this.mobs.filter((m) => m.entity.hp > 0).map((m) => m.entity);
  }

  constructor(scene: THREE.Scene, lootManager: LootDropManager) {
    this.scene = scene;
    this.lootManager = lootManager;
    this.tetherVisualizer = new ThreatTetherVisualizer(scene);

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

    // === 3D ARTICULATED PROCEDURAL MESH GENERATION FOR MOBS ===
    const mobMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      metalness: 0.82,
      roughness: 0.28,
    });
    const darkStoneMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.85,
    });
    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.2,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.2,
    });
    const redGlowMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xff0000,
      emissiveIntensity: 2.4,
    });

    let bodyMesh: THREE.Mesh;

    if (type === 'aether_wisp') {
      // Astralwisp: Floating crystalline core with counter-rotating celestial gimbal rings and orbit motes
      const coreGeo = new THREE.OctahedronGeometry(radius * 0.7, 1);
      bodyMesh = new THREE.Mesh(coreGeo, glowMat);
      bodyMesh.position.y = radius * 1.2;
      group.add(bodyMesh);

      const innerRingGeo = new THREE.TorusGeometry(radius * 0.95, 0.04, 6, 16);
      const innerRing = new THREE.Mesh(innerRingGeo, goldTrimMat);
      innerRing.rotation.x = Math.PI / 4;
      bodyMesh.add(innerRing);

      const outerRingGeo = new THREE.TorusGeometry(radius * 1.25, 0.03, 6, 16);
      const outerRing = new THREE.Mesh(outerRingGeo, mobMat);
      outerRing.rotation.y = Math.PI / 3;
      bodyMesh.add(outerRing);

      // Orbital Aether Sparks
      for (let i = 0; i < 3; i++) {
        const shardGeo = new THREE.TetrahedronGeometry(0.12, 0);
        const shard = new THREE.Mesh(shardGeo, glowMat);
        const ang = (i * Math.PI * 2) / 3;
        shard.position.set(Math.cos(ang) * radius * 1.1, Math.sin(ang) * 0.3, Math.sin(ang) * radius * 1.1);
        bodyMesh.add(shard);
      }
    } else if (type === 'clockwork_stalker') {
      // Clockwork Stalker: Quadruped brass arachnid/feline construct with optical head
      const chassisGeo = new THREE.CylinderGeometry(radius * 0.5, radius * 0.7, radius * 1.1, 6);
      chassisGeo.rotateX(Math.PI / 2);
      bodyMesh = new THREE.Mesh(chassisGeo, mobMat);
      bodyMesh.position.y = radius * 0.9;
      group.add(bodyMesh);

      // Optical Head
      const headGeo = new THREE.ConeGeometry(radius * 0.35, radius * 0.7, 5);
      headGeo.rotateX(Math.PI / 2);
      const head = new THREE.Mesh(headGeo, goldTrimMat);
      head.position.set(0, 0.1, radius * 0.7);
      bodyMesh.add(head);

      // Tri-lens Glowing Ocular Sensor
      const triLensGeo = new THREE.BoxGeometry(0.18, 0.08, 0.08);
      const triLens = new THREE.Mesh(triLensGeo, glowMat);
      triLens.position.set(0, 0.05, radius * 0.9);
      bodyMesh.add(triLens);

      // 4 Articulated Brass Taloned Legs
      const legAngles = [-0.6, 0.6, -2.4, 2.4];
      legAngles.forEach((ang) => {
        const legUpperGeo = new THREE.CylinderGeometry(0.08, 0.06, radius * 0.9, 6);
        const leg = new THREE.Mesh(legUpperGeo, mobMat);
        leg.position.set(Math.sin(ang) * radius * 0.7, -radius * 0.35, Math.cos(ang) * radius * 0.6);
        leg.rotation.z = ang > 0 ? -0.4 : 0.4;
        bodyMesh.add(leg);
      });

      // Steam Exhaust Boiler
      const exhaustGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.45, 6);
      const exhaust = new THREE.Mesh(exhaustGeo, darkStoneMat);
      exhaust.position.set(0, radius * 0.4, -radius * 0.4);
      bodyMesh.add(exhaust);
    } else if (type === 'corrupted_golem') {
      // Corrupted Stone & Iron Golem: Heavy weathered stone colossus with corrupted crystal cluster
      const torsoGeo = new THREE.CylinderGeometry(radius * 0.8, radius * 0.65, radius * 1.5, 7);
      bodyMesh = new THREE.Mesh(torsoGeo, darkStoneMat);
      bodyMesh.position.y = radius * 1.1;
      group.add(bodyMesh);

      // Corrupted Fissure Core
      const coreGeo = new THREE.BoxGeometry(0.18, radius * 1.0, 0.22);
      const core = new THREE.Mesh(coreGeo, redGlowMat);
      core.position.set(0, 0, radius * 0.65);
      bodyMesh.add(core);

      // Stone Head with Glowing Eye Slits
      const headGeo = new THREE.BoxGeometry(radius * 0.65, radius * 0.45, radius * 0.65);
      const head = new THREE.Mesh(headGeo, darkStoneMat);
      head.position.set(0, radius * 0.9, 0.1);
      bodyMesh.add(head);

      const eyesGeo = new THREE.BoxGeometry(radius * 0.4, 0.08, 0.1);
      const eyes = new THREE.Mesh(eyesGeo, redGlowMat);
      eyes.position.set(0, radius * 0.9, radius * 0.4);
      bodyMesh.add(eyes);

      // Asymmetrical Corrupted Crystals on Right Shoulder
      const crystalGeo = new THREE.ConeGeometry(0.24, radius * 0.8, 4);
      const crystal = new THREE.Mesh(crystalGeo, redGlowMat);
      crystal.position.set(radius * 0.85, radius * 0.8, 0);
      crystal.rotation.z = -0.3;
      bodyMesh.add(crystal);

      // Massive Stone Fists
      const armGeo = new THREE.CylinderGeometry(0.22, 0.28, radius * 1.1, 6);
      const leftArm = new THREE.Mesh(armGeo, darkStoneMat);
      leftArm.position.set(-radius * 0.95, -radius * 0.1, 0.2);
      bodyMesh.add(leftArm);

      const rightArm = new THREE.Mesh(armGeo, darkStoneMat);
      rightArm.position.set(radius * 0.95, -radius * 0.1, 0.2);
      bodyMesh.add(rightArm);
    } else if (type === 'centurion_elite') {
      // Centurion Overlord / Runenwächter: Segmented Praetorian sentinel
      const torsoGeo = new THREE.CylinderGeometry(radius * 0.55, radius * 0.45, radius * 1.4, 8);
      bodyMesh = new THREE.Mesh(torsoGeo, mobMat);
      bodyMesh.position.y = radius * 1.2;
      group.add(bodyMesh);

      // Centurion Helm with Golden Crest
      const helmGeo = new THREE.CylinderGeometry(radius * 0.35, radius * 0.32, radius * 0.6, 8);
      const helm = new THREE.Mesh(helmGeo, mobMat);
      helm.position.set(0, radius * 0.95, 0);
      bodyMesh.add(helm);

      const crestGeo = new THREE.BoxGeometry(0.08, radius * 0.4, radius * 0.8);
      const crest = new THREE.Mesh(crestGeo, goldTrimMat);
      crest.position.set(0, radius * 1.25, 0);
      bodyMesh.add(crest);

      const visorGeo = new THREE.BoxGeometry(radius * 0.45, 0.08, 0.12);
      const visor = new THREE.Mesh(visorGeo, redGlowMat);
      visor.position.set(0, radius * 0.95, radius * 0.3);
      bodyMesh.add(visor);

      // Double Fluted Pauldrons
      const pauldronGeo = new THREE.ConeGeometry(radius * 0.35, radius * 0.5, 6);
      const leftP = new THREE.Mesh(pauldronGeo, goldTrimMat);
      leftP.position.set(-radius * 0.75, radius * 0.65, 0);
      leftP.rotation.z = Math.PI / 4;
      bodyMesh.add(leftP);

      const rightP = new THREE.Mesh(pauldronGeo, goldTrimMat);
      rightP.position.set(radius * 0.75, radius * 0.65, 0);
      rightP.rotation.z = -Math.PI / 4;
      bodyMesh.add(rightP);

      // Runic Greatblade
      const bladeGeo = new THREE.BoxGeometry(0.12, radius * 1.8, 0.04);
      const blade = new THREE.Mesh(bladeGeo, mobMat);
      blade.position.set(radius * 0.85, 0, radius * 0.4);
      bodyMesh.add(blade);

      const bladeGlowGeo = new THREE.BoxGeometry(0.04, radius * 1.4, 0.05);
      const bladeGlow = new THREE.Mesh(bladeGlowGeo, redGlowMat);
      bladeGlow.position.set(radius * 0.85, 0, radius * 0.4);
      bodyMesh.add(bladeGlow);
    } else {
      // Default / Steam Drake / Beast: Articulated construct
      const bodyGeo = new THREE.CylinderGeometry(radius * 0.55, radius * 0.75, radius * 1.5, 8);
      bodyMesh = new THREE.Mesh(bodyGeo, mobMat);
      bodyMesh.position.y = radius * 1.0;
      group.add(bodyMesh);

      const headGeo = new THREE.ConeGeometry(radius * 0.4, radius * 0.7, 6);
      headGeo.rotateX(Math.PI / 2);
      const head = new THREE.Mesh(headGeo, goldTrimMat);
      head.position.set(0, radius * 0.7, radius * 0.6);
      bodyMesh.add(head);

      const eyeGeo = new THREE.BoxGeometry(radius * 0.3, 0.08, 0.08);
      const eyes = new THREE.Mesh(eyeGeo, glowMat);
      eyes.position.set(0, radius * 0.75, radius * 0.8);
      bodyMesh.add(eyes);
    }

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

  public spawnDungeonBoss(
    bossId: string,
    name: string,
    level: number,
    x: number,
    z: number
  ): WorldMobEntity {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const maxHp = 8000 + level * 500;
    const radius = 3.5;
    const damage = 65 + level * 5;
    const expReward = 1200 + level * 100;
    const goldReward = 500 + level * 50;
    const colorHex = 0x9f1239; // Deep rose red

    // Articulated Dungeon Boss Model
    const bossMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      metalness: 0.78,
      roughness: 0.25,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.2,
    });
    const magmaMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xef4444,
      emissiveIntensity: 2.2,
    });

    // Sculpted Multi-Segmented Torso
    const bodyGeo = new THREE.CylinderGeometry(radius * 0.7, radius * 0.9, radius * 2.2, 8);
    const bodyMesh = new THREE.Mesh(bodyGeo, bossMat);
    bodyMesh.position.y = radius * 1.5;
    group.add(bodyMesh);

    // Glowing Runic Heart Chestplate
    const runePlateGeo = new THREE.BoxGeometry(radius * 0.8, radius * 0.8, radius * 0.3);
    const runePlate = new THREE.Mesh(runePlateGeo, goldMat);
    runePlate.position.set(0, radius * 1.6, radius * 0.8);
    group.add(runePlate);

    const heartGeo = new THREE.OctahedronGeometry(radius * 0.35, 1);
    const heart = new THREE.Mesh(heartGeo, magmaMat);
    heart.position.set(0, radius * 1.6, radius * 0.95);
    group.add(heart);

    // Horned Helm & Crown
    const helmGeo = new THREE.CylinderGeometry(radius * 0.45, radius * 0.4, radius * 0.9, 8);
    const helm = new THREE.Mesh(helmGeo, bossMat);
    helm.position.set(0, radius * 2.7, 0);
    group.add(helm);

    const leftHornGeo = new THREE.ConeGeometry(radius * 0.18, radius * 1.2, 6);
    const leftHorn = new THREE.Mesh(leftHornGeo, magmaMat);
    leftHorn.position.set(-radius * 0.5, radius * 3.3, 0);
    leftHorn.rotation.z = Math.PI / 4;
    group.add(leftHorn);

    const rightHorn = new THREE.Mesh(leftHornGeo, magmaMat);
    rightHorn.position.set(radius * 0.5, radius * 3.3, 0);
    rightHorn.rotation.z = -Math.PI / 4;
    group.add(rightHorn);

    // Glowing Eyes
    const eyeGeo = new THREE.BoxGeometry(radius * 0.5, 0.12, 0.15);
    const eyes = new THREE.Mesh(eyeGeo, magmaMat);
    eyes.position.set(0, radius * 2.7, radius * 0.45);
    group.add(eyes);

    // Overhead Health Bar in 3D Space
    const hpBarGeo = new THREE.PlaneGeometry(3.5, 0.4);
    const hpBarMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
    });
    const healthBarMesh = new THREE.Mesh(hpBarGeo, hpBarMat);
    healthBarMesh.position.set(0, radius * 3.6, 0);
    group.add(healthBarMesh);

    this.scene.add(group);

    const entity: WorldMobEntity = {
      id: bossId,
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
      attackRange: 6.0,
      damage,
      expReward,
      goldReward,
      isAggroed: false,
      isBoss: true,
      isElite: true,
      patrolAngle: Math.random() * Math.PI * 2,
      attackCooldown: 0,
      maxAttackCooldown: 2.5,
      dropTable: [],
      color: `#${colorHex.toString(16).padStart(6, '0')}`,
    };

    const visual: MobVisual = {
      entity,
      group,
      bodyMesh,
      healthBarMesh,
    };
    visual.fsm = createMobStateMachine(visual as any);

    threatMatrix.registerMob(bossId, x, z, 55.0);
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

    // Colossal Articulated Boss Model
    const bossMat = new THREE.MeshStandardMaterial({
      color: 0x3b0764,
      emissive: 0x1e0538,
      metalness: 0.92,
      roughness: 0.22,
    });

    const fireMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xef4444,
      emissiveIntensity: 2.6,
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.18,
    });

    // Massive Articulated Torso
    const torsoGeo = new THREE.CylinderGeometry(2.6, 2.0, 5.5, 8);
    const bodyMesh = new THREE.Mesh(torsoGeo, bossMat);
    bodyMesh.position.y = 5.5;
    group.add(bodyMesh);

    // Glowing Molten Heart Core with Sun Gear Rings
    const heartGeo = new THREE.IcosahedronGeometry(1.3, 1);
    const heart = new THREE.Mesh(heartGeo, fireMat);
    heart.position.set(0, 5.8, 1.8);
    group.add(heart);

    const gearRingGeo = new THREE.TorusGeometry(1.8, 0.12, 6, 24);
    const gearRing = new THREE.Mesh(gearRingGeo, goldMat);
    gearRing.position.set(0, 5.8, 1.7);
    gearRing.rotation.x = Math.PI / 4;
    group.add(gearRing);

    // Colossal Helm & Horns
    const headGeo = new THREE.CylinderGeometry(1.4, 1.2, 2.0, 8);
    const head = new THREE.Mesh(headGeo, bossMat);
    head.position.set(0, 9.2, 0.4);
    group.add(head);

    const visorGeo = new THREE.BoxGeometry(1.6, 0.35, 0.6);
    const visor = new THREE.Mesh(visorGeo, fireMat);
    visor.position.set(0, 9.2, 1.4);
    group.add(visor);

    // Dual Majestic Horns
    const hornGeo = new THREE.ConeGeometry(0.55, 3.2, 6);
    const leftHorn = new THREE.Mesh(hornGeo, fireMat);
    leftHorn.position.set(-1.8, 11.2, 0.2);
    leftHorn.rotation.z = Math.PI / 4;
    group.add(leftHorn);

    const rightHorn = new THREE.Mesh(hornGeo, fireMat);
    rightHorn.position.set(1.8, 11.2, 0.2);
    rightHorn.rotation.z = -Math.PI / 4;
    group.add(rightHorn);

    // Spiked Fortress Pauldrons
    const pauldronGeo = new THREE.ConeGeometry(1.4, 2.6, 6);
    const leftPauldron = new THREE.Mesh(pauldronGeo, goldMat);
    leftPauldron.position.set(-3.2, 7.8, 0);
    leftPauldron.rotation.z = Math.PI / 3;
    group.add(leftPauldron);

    const rightPauldron = new THREE.Mesh(pauldronGeo, goldMat);
    rightPauldron.position.set(3.2, 7.8, 0);
    rightPauldron.rotation.z = -Math.PI / 3;
    group.add(rightPauldron);

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
    playerHp: number = 100,
    onMobAttack?: (mob: WorldMobEntity, dmg: number, targetId?: string) => void,
    getTargetPosition?: (
      entityId: string
    ) => { x: number; y: number; z: number; isAlive: boolean; isPlayer?: boolean; name?: string } | null
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
            playerHp,
            delta,
            onMobAttack,
            scene: this.scene,
            getTargetPosition,
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
        this.tetherVisualizer.removeTether(mob.id);
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

      // 4. Synchronize Threat Data & Aggro Table
      mob.aggroTable = threatMatrix.getAggroTable(mob.id);
      const activeTargetId = threatMatrix.getTarget(mob.id);
      mob.targetId = activeTargetId;
      const topThreats = threatMatrix.getTopThreats(mob.id);
      mob.topThreat = topThreats[0]?.threat || 0;

      // 5. Update Visual Indicator Line Linking Mob to Its Current Target
      if (
        mob.hp > 0 &&
        mob.isAggroed &&
        activeTargetId &&
        visual.fsm?.getCurrentStateId() === 'combat'
      ) {
        let targetPosInfo: TargetPositionInfo | null = null;
        if (activeTargetId === 'hero_player_1') {
          targetPosInfo = {
            x: playerX,
            y: 0,
            z: playerZ,
            isPlayer: true,
            isAlive: playerHp > 0,
            name: 'Hero Player',
          };
        } else if (getTargetPosition) {
          targetPosInfo = getTargetPosition(activeTargetId) as TargetPositionInfo;
        }

        if (targetPosInfo && targetPosInfo.isAlive) {
          this.tetherVisualizer.updateTether(
            mob.id,
            { x: mob.x, y: 0, z: mob.z, height: mob.isBoss ? 5.5 : mob.isElite ? 2.5 : 1.8 },
            activeTargetId,
            targetPosInfo
          );
        } else {
          this.tetherVisualizer.hideTether(mob.id);
        }
      } else {
        this.tetherVisualizer.hideTether(mob.id);
      }

      // 6. Update Billboarded Overhead Health Bar
      const hpPct = Math.max(0, mob.hp / mob.maxHp);
      visual.healthBarMesh.scale.x = Math.max(0.01, hpPct);
      visual.healthBarMesh.rotation.y = Math.atan2(playerX - mob.x, playerZ - mob.z);

      activeMobs.push(visual);
    });

    this.mobs = activeMobs;

    // Update pulsing tether lines
    this.tetherVisualizer.update(delta);
  }

  public damageMob(
    mobId: string,
    damage: number,
    attackerId: string = 'hero_player_1',
    isTankRole: boolean = false,
    attackerName?: string
  ): {
    mob: WorldMobEntity | null;
    isKilled: boolean;
    lootDropped?: RPGItem;
    isPityGuaranteed?: boolean;
    pityCount?: number;
  } {
    const visual = this.mobs.find((m) => m.entity.id === mobId);
    if (!visual) return { mob: null, isKilled: false };

    const mob = visual.entity;

    // Record fight start point on initial engagement
    if (mob.fightStartX === undefined) {
      mob.fightStartX = mob.x;
      mob.fightStartZ = mob.z;
      threatMatrix.recordFightStart(mobId, mob.x, mob.z);
    }

    mob.hp -= damage;
    mob.isAggroed = true; // immediately retaliate

    // Authoritative Threat Matrix update
    threatMatrix.addDamageThreat(mobId, attackerId, damage, isTankRole, attackerName);
    mob.targetId = threatMatrix.getTarget(mobId);
    mob.aggroTable = threatMatrix.getAggroTable(mobId);

    // If mob was not in combat state, switch it to combat immediately
    if (visual.fsm && visual.fsm.getCurrentStateId() !== 'combat' && visual.fsm.getCurrentStateId() !== 'dead') {
      visual.fsm.setState('combat', {
        mob,
        visual: visual as any,
        playerX: mob.x,
        playerZ: mob.z,
        delta: 0,
        scene: this.scene,
      });
    }

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
      this.tetherVisualizer.removeTether(mobId);
      visual.fsm?.setState('dead', {
        mob,
        visual: visual as any,
        playerX: mob.x,
        playerZ: mob.z,
        delta: 0,
        scene: this.scene,
      });
      threatMatrix.unregisterMob(mobId);

      // Process mob death loot with pity system (guaranteed legendary after 50 failed epic attempts)
      const lootResult = this.lootManager.processMobLoot(mob);

      return {
        mob,
        isKilled: true,
        lootDropped: lootResult.droppedItem,
        isPityGuaranteed: lootResult.isPityGuaranteed,
        pityCount: lootResult.pityCount,
      };
    }

    return { mob, isKilled: false };
  }

  /**
   * Applies Taunt to a specific mob, immediately setting threat higher than the top threat holder.
   */
  public tauntMob(mobId: string, taunterId: string = 'hero_player_1', taunterName?: string): void {
    const visual = this.mobs.find((m) => m.entity.id === mobId);
    if (!visual || visual.entity.hp <= 0) return;

    const mob = visual.entity;
    if (mob.fightStartX === undefined) {
      mob.fightStartX = mob.x;
      mob.fightStartZ = mob.z;
      threatMatrix.recordFightStart(mobId, mob.x, mob.z);
    }

    mob.isAggroed = true;
    threatMatrix.applyTaunt(mobId, taunterId, taunterName);
    mob.targetId = taunterId;
    mob.targetName = taunterName || (taunterId === 'hero_player_1' ? 'Hero Player' : taunterId);
    mob.aggroTable = threatMatrix.getAggroTable(mobId);

    if (visual.fsm && visual.fsm.getCurrentStateId() !== 'combat' && visual.fsm.getCurrentStateId() !== 'dead') {
      visual.fsm.setState('combat', {
        mob,
        visual: visual as any,
        playerX: mob.x,
        playerZ: mob.z,
        delta: 0,
        scene: this.scene,
      });
    }
  }

  /**
   * Applies Taunt to all nearby mobs in range.
   */
  public tauntNearbyMobs(
    taunterId: string = 'hero_player_1',
    x: number,
    z: number,
    radius: number = 20.0,
    taunterName?: string
  ): WorldMobEntity[] {
    const affected: WorldMobEntity[] = [];
    this.mobs.forEach((visual) => {
      if (visual.entity.hp > 0 && Math.hypot(visual.entity.x - x, visual.entity.z - z) <= radius) {
        this.tauntMob(visual.entity.id, taunterId, taunterName);
        affected.push(visual.entity);
      }
    });
    return affected;
  }

  /**
   * On player death: wipes aggro from all mobs and directly returns aggroed mobs
   * back to their fight start point on the map!
   */
  public handlePlayerDeath(playerId: string = 'hero_player_1'): {
    mob: WorldMobEntity;
    fightStartPos: { x: number; z: number };
  }[] {
    const affected = threatMatrix.handleEntityDeath(playerId);
    const resetMobs: { mob: WorldMobEntity; fightStartPos: { x: number; z: number } }[] = [];

    affected.forEach((item) => {
      const visual = this.mobs.find((m) => m.entity.id === item.mobId);
      if (visual) {
        if (item.shouldReset) {
          const returnPos = item.fightStartPos;

          // Directly return mob to its fight start point coordinates on the map
          visual.entity.x = returnPos.x;
          visual.entity.z = returnPos.z;
          visual.group.position.set(returnPos.x, 0, returnPos.z);
          visual.entity.hp = visual.entity.maxHp;
          visual.entity.isAggroed = false;
          visual.entity.targetId = null;
          visual.entity.targetName = undefined;
          visual.entity.fightStartX = undefined;
          visual.entity.fightStartZ = undefined;
          visual.entity.aggroTable = {};

          this.tetherVisualizer.hideTether(visual.entity.id);

          if (visual.fsm) {
            visual.fsm.setState('idle', {
              mob: visual.entity,
              visual: visual as any,
              playerX: returnPos.x,
              playerZ: returnPos.z,
              delta: 0,
              scene: this.scene,
            });
          }

          resetMobs.push({ mob: visual.entity, fightStartPos: returnPos });
        }
      }
    });

    return resetMobs;
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
