import * as THREE from 'three';
import {
  DungeonActiveBoss,
  DungeonBossPhase,
  DungeonDefinition,
  DungeonInstanceProgress,
  PartyMember,
  RPGItem,
  WorldMobEntity,
} from '../../types';
import { RPG_ITEMS_DATABASE } from '../../data/mmorpgData';
import { soundSynth } from '../../audio/SoundSynthesizer';
import { MobManager } from '../../entities/MobManager';
import { ParticleSystem } from '../../core/ParticleSystem';
import confetti from 'canvas-confetti';

export class DungeonInstanceManager {
  private scene: THREE.Scene;
  private mobManager: MobManager;
  private particleSystem: ParticleSystem;

  public activeInstance: DungeonInstanceProgress | null = null;
  private dungeonMeshGroup: THREE.Group | null = null;
  private chestGroup: THREE.Group | null = null;
  private exitPortalMesh: THREE.Group | null = null;
  private phaseAnnounced: { [phase: number]: boolean } = {};
  public originCoords: { x: number; z: number } = { x: 8000, z: 8000 };

  public onInstanceUpdated?: (instance: DungeonInstanceProgress | null) => void;
  public onBossPhaseChanged?: (boss: DungeonActiveBoss, phase: DungeonBossPhase) => void;
  public onInstanceVictory?: (instance: DungeonInstanceProgress) => void;

  constructor(scene: THREE.Scene, mobManager: MobManager, particleSystem: ParticleSystem) {
    this.scene = scene;
    this.mobManager = mobManager;
    this.particleSystem = particleSystem;
  }

  public startDungeon(dungeon: DungeonDefinition, party: PartyMember[]): DungeonInstanceProgress {
    this.cleanupCurrentInstance();

    const instanceId = `inst_${dungeon.id}_${Date.now()}`;
    const originX = 8000 + Math.floor(Math.random() * 2000);
    const originZ = 8000 + Math.floor(Math.random() * 2000);
    this.originCoords = { x: originX, z: originZ };
    this.phaseAnnounced = {};

    const bossName = dungeon.bosses[0] || 'Ur-Koloss des Gewölbes';
    const bossLevel = dungeon.levelReq + 3;
    const bossMaxHp = 5000 + dungeon.levelReq * 600;

    const activeBoss: DungeonActiveBoss = {
      id: `boss_${instanceId}_0`,
      name: bossName,
      title: `Gewölbe-Herrscher von ${dungeon.germanName}`,
      phase: 1,
      phaseName: 'Phase 1: Vorstoss der Wächter',
      hp: bossMaxHp,
      maxHp: bossMaxHp,
      shieldHp: 0,
      maxShieldHp: Math.floor(bossMaxHp * 0.25),
      isShieldActive: false,
      isEnraged: false,
      enrageMultiplier: 1.0,
      mechanicDescription: 'Standardangriffe und gerichtete Hiebe. Weiche den markierten Kegelangriffen aus!',
    };

    const instance: DungeonInstanceProgress = {
      instanceId,
      dungeonId: dungeon.id,
      dungeon,
      status: 'in_progress',
      currentFloor: 1,
      trashMobsAlive: 4,
      totalTrashMobs: 4,
      currentBossIndex: 0,
      totalBosses: dungeon.bossCount || dungeon.bosses.length,
      activeBoss,
      elapsedSeconds: 0,
      parTimeSeconds: 180 + dungeon.levelReq * 10,
      deathCount: 0,
      rankRating: 'S+',
      chestSpawned: false,
      chestOpened: false,
      chestLoot: {
        gold: dungeon.rewards.gold,
        xp: dungeon.rewards.xp,
        tokens: 3 + Math.floor(dungeon.levelReq / 5),
        items: this.generateDungeonLoot(dungeon),
      },
      partyMembers: party,
    };

    this.activeInstance = instance;

    // 1. Build 3D Dungeon Environment
    this.buildDungeonArena(originX, originZ, dungeon);

    // 2. Spawn 3D Trash Mobs
    this.spawnTrashPack(originX, originZ, dungeon);

    // 3. Spawn 3D Boss Entity in Arena Center
    this.spawnBossEntity(originX, originZ, activeBoss, dungeon);

    this.onInstanceUpdated?.(instance);
    return instance;
  }

  private generateDungeonLoot(dungeon: DungeonDefinition): RPGItem[] {
    const pool = RPG_ITEMS_DATABASE.filter(
      (i) => i.rarity === dungeon.rewards.gearRarity || i.rarity === 'epic' || i.rarity === 'legendary'
    );

    const loot: RPGItem[] = [];
    if (pool.length > 0) {
      const mainItem = pool[Math.floor(Math.random() * pool.length)];
      loot.push({
        ...mainItem,
        id: `dungeon_loot_${Date.now()}_0`,
        name: `${mainItem.name} [Gewölbe-Artefakt]`,
        stats: {
          ...mainItem.stats,
          attack: (mainItem.stats?.attack || 15) + dungeon.levelReq * 4,
          armor: (mainItem.stats?.armor || 10) + dungeon.levelReq * 5,
        },
      });
    }

    // Add relic or accessory
    const relic = RPG_ITEMS_DATABASE.find((i) => i.slot === 'relic' || i.slot === 'shield');
    if (relic) {
      loot.push({
        ...relic,
        id: `dungeon_loot_${Date.now()}_1`,
        name: `Insignie von ${dungeon.germanName}`,
        valueGold: dungeon.rewards.gold,
      });
    }

    return loot;
  }

  private buildDungeonArena(x: number, z: number, dungeon: DungeonDefinition) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.85,
      metalness: 0.2,
    });
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      metalness: 0.9,
      roughness: 0.25,
    });
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xef4444,
      emissiveIntensity: 2.8,
    });
    const cyanRuneMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.2,
    });

    // 1. Arena Floor Ring
    const floorGeo = new THREE.CylinderGeometry(28, 28, 0.4, 32);
    const floorMesh = new THREE.Mesh(floorGeo, stoneMat);
    floorMesh.position.y = -0.2;
    group.add(floorMesh);

    // Arena Runic Border
    const runeBorder = new THREE.Mesh(new THREE.TorusGeometry(26, 0.4, 8, 32), cyanRuneMat);
    runeBorder.rotation.x = Math.PI / 2;
    runeBorder.position.y = 0.05;
    group.add(runeBorder);

    // 2. Perimeter Monument Pillars with Burning Braziers (8 pillars around perimeter)
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const px = Math.cos(ang) * 24;
      const pz = Math.sin(ang) * 24;

      const pillarGeo = new THREE.CylinderGeometry(1.2, 1.5, 9, 8);
      const pillar = new THREE.Mesh(pillarGeo, bronzeMat);
      pillar.position.set(px, 4.5, pz);
      group.add(pillar);

      // Brazier Fire Bowl
      const bowlGeo = new THREE.CylinderGeometry(1.4, 0.6, 1.2, 8);
      const bowl = new THREE.Mesh(bowlGeo, stoneMat);
      bowl.position.set(px, 9.2, pz);
      group.add(bowl);

      const fire = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 1), flameMat);
      fire.position.set(px, 10.0, pz);
      group.add(fire);

      const light = new THREE.PointLight(0xf97316, 2.5, 20);
      light.position.set(px, 10.5, pz);
      group.add(light);
    }

    // 3. Ancient Entrance Gate Arch
    const gateGeo = new THREE.BoxGeometry(10, 8, 2);
    const gateMesh = new THREE.Mesh(gateGeo, stoneMat);
    gateMesh.position.set(0, 4, -26);
    group.add(gateMesh);

    this.scene.add(group);
    this.dungeonMeshGroup = group;
  }

  private spawnTrashPack(x: number, z: number, dungeon: DungeonDefinition) {
    // Spawn 4 dungeon wardens
    const offsets = [
      { dx: -10, dz: -10 },
      { dx: 10, dz: -10 },
      { dx: -12, dz: 6 },
      { dx: 12, dz: 6 },
    ];

    offsets.forEach((off) => {
      this.mobManager.spawnMob('corrupted_golem', x + off.dx, z + off.dz, dungeon.levelReq);
    });
  }

  private spawnBossEntity(x: number, z: number, boss: DungeonActiveBoss, dungeon: DungeonDefinition) {
    const bossMob = this.mobManager.spawnDungeonBoss(
      boss.id,
      boss.name,
      dungeon.levelReq + 3,
      x,
      z + 10
    );

    boss.hp = bossMob.hp;
    boss.maxHp = bossMob.maxHp;
  }

  public handleMobDefeated(mob: WorldMobEntity) {
    if (!this.activeInstance || this.activeInstance.status === 'victory' || this.activeInstance.status === 'exited') {
      return;
    }

    const dist = Math.hypot(mob.x - this.originCoords.x, mob.z - this.originCoords.z);
    if (dist > 50) return;

    if (this.activeInstance.trashMobsAlive > 0 && !mob.isBoss) {
      this.activeInstance.trashMobsAlive = Math.max(0, this.activeInstance.trashMobsAlive - 1);
      soundSynth.playHitSound();

      if (this.activeInstance.trashMobsAlive === 0) {
        this.activeInstance.status = 'boss_active';
        soundSynth.playCombatEngage();
      }
    }

    // Check Boss Kill
    if (this.activeInstance.activeBoss && mob.id === this.activeInstance.activeBoss.id) {
      this.triggerBossDefeat();
    }

    this.onInstanceUpdated?.({ ...this.activeInstance });
  }

  public updateBossCombat(delta: number, heroX: number, heroZ: number) {
    if (!this.activeInstance || this.activeInstance.status === 'victory' || this.activeInstance.status === 'exited') {
      return;
    }

    this.activeInstance.elapsedSeconds += delta;

    // Calculate rating based on speed
    const par = this.activeInstance.parTimeSeconds;
    const time = this.activeInstance.elapsedSeconds;
    if (time <= par * 0.75 && this.activeInstance.deathCount === 0) {
      this.activeInstance.rankRating = 'S+';
    } else if (time <= par && this.activeInstance.deathCount <= 1) {
      this.activeInstance.rankRating = 'S';
    } else if (time <= par * 1.3) {
      this.activeInstance.rankRating = 'A';
    } else {
      this.activeInstance.rankRating = 'B';
    }

    const boss = this.activeInstance.activeBoss;
    if (!boss) return;

    // Find live mob entity
    const mob = this.mobManager.mobs.find((m) => m.entity.id === boss.id)?.entity;
    if (mob) {
      boss.hp = mob.hp;
      boss.maxHp = mob.maxHp;

      const hpPercent = (boss.hp / boss.maxHp) * 100;

      // Phase 2 Transition (at 66% HP)
      if (hpPercent <= 66 && hpPercent > 33 && boss.phase === 1) {
        this.transitionToPhase(2);
      }

      // Phase 3 Transition (at 33% HP)
      if (hpPercent <= 33 && boss.phase < 3) {
        this.transitionToPhase(3);
      }

      // Boss spell casting progression
      if (boss.castProgress !== undefined) {
        boss.castProgress += delta * 35;
        if (boss.castProgress >= 100) {
          this.executeBossCast(boss, mob);
          boss.castProgress = 0;
        }
      } else {
        boss.castProgress = 0;
        boss.castSkillName =
          boss.phase === 3 ? 'Urgewalt-Schlag' : boss.phase === 2 ? 'Aether-Überladung' : 'Spaltungs-Hieb';
      }
    }
  }

  private transitionToPhase(phase: DungeonBossPhase) {
    if (!this.activeInstance?.activeBoss) return;
    const boss = this.activeInstance.activeBoss;
    boss.phase = phase;

    soundSynth.playLevelUp();
    confetti({ particleCount: 50, spread: 60 });

    if (phase === 2) {
      boss.phaseName = 'Phase 2: Aether-Schild & Flammenschwall';
      boss.isShieldActive = true;
      boss.shieldHp = boss.maxShieldHp;
      boss.mechanicDescription =
        '⚠️ AETHER-SCHILD AKTIV! Der Boss absorbiert Schaden und beschwört Flammenwirbel. Zerstöre den Schild!';

      // Spawn Phase 2 adds
      this.mobManager.spawnMob('aether_wisp', this.originCoords.x - 8, this.originCoords.z + 8, 8);
      this.mobManager.spawnMob('aether_wisp', this.originCoords.x + 8, this.originCoords.z + 8, 8);
    } else if (phase === 3) {
      boss.phaseName = 'Phase 3: URGEWALT-RASEREI (Enrage!)';
      boss.isEnraged = true;
      boss.enrageMultiplier = 1.6;
      boss.mechanicDescription =
        '☠️ BOSS ENRAGE! +60% Angriffsgeschwindigkeit und ununterbrochener Meteor-Hagel! Tötet ihn schnell!';
    }

    this.particleSystem.emit(
      'beacon_activate',
      { x: this.originCoords.x, y: 2.0, z: this.originCoords.z + 10 },
      phase === 3 ? '#ef4444' : '#00f0ff',
      3.0
    );

    this.onBossPhaseChanged?.(boss, phase);
    this.onInstanceUpdated?.({ ...this.activeInstance });
  }

  private executeBossCast(boss: DungeonActiveBoss, mob: WorldMobEntity) {
    soundSynth.playCombatEngage();
    this.particleSystem.emit(
      'explosion',
      { x: mob.x, y: 1.5, z: mob.z },
      boss.phase === 3 ? '#ef4444' : '#f59e0b',
      2.0
    );
  }

  public triggerBossDefeat() {
    if (!this.activeInstance) return;

    this.activeInstance.status = 'victory';
    this.activeInstance.chestSpawned = true;
    this.activeInstance.completedAt = Date.now();

    soundSynth.playQuestComplete();
    confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });

    // Spawn 3D Reward Chest in Center of Dungeon
    this.spawn3DChest();

    // Spawn Exit Portal
    this.spawn3DExitPortal();

    this.onInstanceVictory?.(this.activeInstance);
    this.onInstanceUpdated?.({ ...this.activeInstance });
  }

  private spawn3DChest() {
    if (this.chestGroup) {
      this.scene.remove(this.chestGroup);
    }

    const group = new THREE.Group();
    group.position.set(this.originCoords.x, 0, this.originCoords.z);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.15,
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
    });

    const chestBody = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.5), stoneMat);
    chestBody.position.y = 0.7;
    group.add(chestBody);

    const chestTrim = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.35, 1.6), goldMat);
    chestTrim.position.y = 1.2;
    group.add(chestTrim);

    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.4, 16, 1, false, 0, Math.PI), goldMat);
    lid.rotation.z = Math.PI / 2;
    lid.position.set(0, 1.4, 0);
    group.add(lid);

    const light = new THREE.PointLight(0xf59e0b, 3.5, 25);
    light.position.y = 2.0;
    group.add(light);

    this.scene.add(group);
    this.chestGroup = group;
  }

  private spawn3DExitPortal() {
    if (this.exitPortalMesh) {
      this.scene.remove(this.exitPortalMesh);
    }

    const group = new THREE.Group();
    group.position.set(this.originCoords.x, 0, this.originCoords.z - 18);

    const portalMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.5,
    });

    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.25, 8, 32), portalMat);
    ring.position.y = 3.2;
    group.add(ring);

    const innerDisc = new THREE.Mesh(
      new THREE.CircleGeometry(2.8, 24),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
    );
    innerDisc.position.y = 3.2;
    group.add(innerDisc);

    this.scene.add(group);
    this.exitPortalMesh = group;
  }

  public openDungeonChest(): DungeonInstanceProgress['chestLoot'] | null {
    if (!this.activeInstance || !this.activeInstance.chestSpawned || this.activeInstance.chestOpened) {
      return null;
    }

    this.activeInstance.chestOpened = true;
    soundSynth.playLegendaryDrop();
    confetti({ particleCount: 100, spread: 70 });

    if (this.chestGroup) {
      this.scene.remove(this.chestGroup);
      this.chestGroup = null;
    }

    this.onInstanceUpdated?.({ ...this.activeInstance });
    return this.activeInstance.chestLoot;
  }

  public cleanupCurrentInstance() {
    if (this.dungeonMeshGroup) {
      this.scene.remove(this.dungeonMeshGroup);
      this.dungeonMeshGroup = null;
    }
    if (this.chestGroup) {
      this.scene.remove(this.chestGroup);
      this.chestGroup = null;
    }
    if (this.exitPortalMesh) {
      this.scene.remove(this.exitPortalMesh);
      this.exitPortalMesh = null;
    }
    this.activeInstance = null;
  }
}
