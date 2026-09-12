import * as THREE from 'three';
import {
  ItemRarity,
  LeylineRiftEvent,
  LeylineRiftPhase,
  LeylineRiftTier,
  RPGItem,
  WorldEventAlert,
  WorldMobEntity,
} from '../../types';
import { RPG_ITEMS_DATABASE } from '../../data/mmorpgData';
import { soundSynth } from '../../audio/SoundSynthesizer';
import { MobManager } from '../../entities/MobManager';
import { ParticleSystem } from '../../core/ParticleSystem';

interface Rift3DVisual {
  riftId: string;
  group: THREE.Group;
  vortexRings: THREE.Mesh[];
  crystalMesh: THREE.Mesh;
  light: THREE.PointLight;
  beamMesh?: THREE.Mesh;
  chestMesh?: THREE.Group;
}

export class WorldEventManager {
  private scene: THREE.Scene;
  private mobManager: MobManager;
  private particleSystem: ParticleSystem;

  public activeRifts: LeylineRiftEvent[] = [];
  private riftVisuals: Map<string, Rift3DVisual> = new Map();
  public recentAlerts: WorldEventAlert[] = [];
  private eventTicker: number = 0;
  private nextRandomSpawnTime: number = 45; // Spawn first random rift after 45s

  public onAlertTriggered?: (alert: WorldEventAlert) => void;
  public onRiftStatusUpdated?: (rifts: LeylineRiftEvent[]) => void;

  constructor(scene: THREE.Scene, mobManager: MobManager, particleSystem: ParticleSystem) {
    this.scene = scene;
    this.mobManager = mobManager;
    this.particleSystem = particleSystem;

    // Seed initial world rift event
    this.spawnInitialLeylineRift();
  }

  private spawnInitialLeylineRift() {
    this.createLeylineRift({
      id: 'rift_whispering_woods_alpha',
      name: 'Leyline Rift: Whispering Woods',
      germanName: 'Instabiler Leylinien-Riss: Windhaine',
      zone: 'Whispering Forest',
      coords: { x: 55, z: -45 },
      tier: 'heroic',
      levelReq: 5,
      radius: 26.0,
      durationSec: 300,
      icon: '🌀',
      color: '#00f0ff',
      lore: 'Ein Riss im Gefüge des Äthers speit astrale Monstrositäten in die Windhaine. Versiegle ihn, bevor die Instabilität 100% erreicht!',
    });
  }

  public createLeylineRift(config: {
    id: string;
    name: string;
    germanName: string;
    zone: string;
    coords: { x: number; z: number };
    tier?: LeylineRiftTier;
    levelReq?: number;
    radius?: number;
    durationSec?: number;
    icon?: string;
    color?: string;
    lore?: string;
  }): LeylineRiftEvent {
    // Remove if already exists
    this.removeRift(config.id);

    const tier = config.tier || 'normal';
    const levelReq = config.levelReq || 4;
    const duration = config.durationSec || 240;

    const goldReward = tier === 'mythic' ? 850 : tier === 'heroic' ? 420 : 180;
    const xpReward = tier === 'mythic' ? 2400 : tier === 'heroic' ? 1200 : 600;
    const shardsReward = tier === 'mythic' ? 15 : tier === 'heroic' ? 8 : 4;
    const gearRarity: ItemRarity = tier === 'mythic' ? 'legendary' : tier === 'heroic' ? 'epic' : 'rare';

    const bonusItem =
      RPG_ITEMS_DATABASE.find(
        (i) => i.rarity === gearRarity && (i.slot === 'weapon' || i.slot === 'relic' || i.slot === 'chest')
      ) || RPG_ITEMS_DATABASE[0];

    const rift: LeylineRiftEvent = {
      id: config.id,
      name: config.name,
      germanName: config.germanName,
      zone: config.zone,
      coords: config.coords,
      radius: config.radius || 24.0,
      tier,
      levelReq,
      phase: 'opening',
      phaseName: 'Riss öffnet sich (Instabilität steigt)',
      timeRemainingSec: duration,
      maxDurationSec: duration,
      instabilityPercent: 15,
      activeWave: 1,
      totalWaves: 3,
      mobsRemaining: 0,
      rewards: {
        gold: goldReward,
        xp: xpReward,
        leylineShards: shardsReward,
        gearRarity,
        bonusItem,
      },
      chestSpawned: false,
      chestOpened: false,
      sealProgress: 0,
      color: config.color || '#00f0ff',
      icon: config.icon || '🌀',
      lore:
        config.lore ||
        'Konzentrierte Aurion-Energie reißt die Barriere auf. Besiege die dimensionalen Wächter!',
    };

    this.activeRifts.push(rift);
    this.spawn3DRiftVisuals(rift);

    // Broadcast Alert
    this.broadcastWorldAlert({
      id: `alert_${rift.id}_${Date.now()}`,
      title: `⚡ WELT-EVENT: ${rift.germanName}!`,
      message: `Ein ${rift.tier.toUpperCase()}-Leylinien-Riss ist in [${rift.zone}] aufgerissen! Schließe dich mit Helden zusammen!`,
      zone: rift.zone,
      coords: rift.coords,
      tier: rift.tier,
      timestamp: Date.now(),
      durationSec: 10,
      icon: rift.icon,
      color: rift.color,
    });

    // Spawn Wave 1
    this.spawnRiftWave(rift, 1);

    this.onRiftStatusUpdated?.([...this.activeRifts]);
    return rift;
  }

  private spawn3DRiftVisuals(rift: LeylineRiftEvent) {
    const group = new THREE.Group();
    group.position.set(rift.coords.x, 0.2, rift.coords.z);

    const vortexRings: THREE.Mesh[] = [];

    // 1. Glowing ground rune disk
    const diskGeo = new THREE.RingGeometry(1.2, rift.radius * 0.7, 32);
    const diskMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(rift.color),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const disk = new THREE.Mesh(diskGeo, diskMat);
    disk.rotation.x = -Math.PI / 2;
    group.add(disk);

    // 2. Multi-tier rotating aether gimbal rings
    const ringMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(rift.color),
      emissive: new THREE.Color(rift.color),
      emissiveIntensity: 2.5,
      metalness: 0.9,
      roughness: 0.1,
    });

    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.14, 8, 32), ringMat);
    ring1.position.y = 3.5;
    ring1.rotation.x = Math.PI / 3;
    group.add(ring1);
    vortexRings.push(ring1);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.12, 8, 32), ringMat);
    ring2.position.y = 3.5;
    ring2.rotation.y = Math.PI / 4;
    group.add(ring2);
    vortexRings.push(ring2);

    const ring3 = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.1, 8, 24), ringMat);
    ring3.position.y = 3.5;
    ring3.rotation.z = Math.PI / 6;
    group.add(ring3);
    vortexRings.push(ring3);

    // 3. Central Levitating Leyline Shard Cluster
    const crystalGeo = new THREE.OctahedronGeometry(1.5, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(rift.color),
      emissiveIntensity: 3.0,
      metalness: 0.5,
      roughness: 0.1,
    });
    const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
    crystalMesh.position.y = 3.5;
    group.add(crystalMesh);

    // 4. Vertical Sky Beam
    const beamGeo = new THREE.CylinderGeometry(0.35, 1.2, 55, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(rift.color),
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.position.y = 27.5;
    group.add(beamMesh);

    // 5. Point Light
    const light = new THREE.PointLight(new THREE.Color(rift.color), 3.5, 45);
    light.position.y = 4.0;
    group.add(light);

    this.scene.add(group);

    this.riftVisuals.set(rift.id, {
      riftId: rift.id,
      group,
      vortexRings,
      crystalMesh,
      light,
      beamMesh,
    });
  }

  private spawnRiftWave(rift: LeylineRiftEvent, waveNum: number) {
    rift.activeWave = waveNum;
    rift.phase = waveNum === 1 ? 'wave_1' : waveNum === 2 ? 'wave_2' : 'boss_phase';

    if (waveNum === 1) {
      rift.phaseName = 'Welle 1: Astrale Späher & Irrlichter';
      const count = 4;
      rift.mobsRemaining = count;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        const x = rift.coords.x + Math.cos(ang) * (rift.radius * 0.5);
        const z = rift.coords.z + Math.sin(ang) * (rift.radius * 0.5);
        this.mobManager.spawnMob('aether_wisp', x, z, rift.levelReq);
        this.particleSystem.emit('teleport_warp', { x, y: 1.0, z }, rift.color, 1.4);
      }
    } else if (waveNum === 2) {
      rift.phaseName = 'Welle 2: Korrumpierte Golems & Centurionen';
      rift.instabilityPercent = 55;
      const count = 3;
      rift.mobsRemaining = count;

      for (let i = 0; i < 2; i++) {
        const ang = i * Math.PI;
        const x = rift.coords.x + Math.cos(ang) * 8;
        const z = rift.coords.z + Math.sin(ang) * 8;
        this.mobManager.spawnMob('corrupted_golem', x, z, rift.levelReq + 1);
        this.particleSystem.emit('teleport_warp', { x, y: 1.0, z }, '#ef4444', 1.8);
      }

      this.mobManager.spawnMob('centurion_elite', rift.coords.x, rift.coords.z + 6, rift.levelReq + 2);
      this.particleSystem.emit('teleport_warp', { x: rift.coords.x, y: 1.0, z: rift.coords.z + 6 }, '#ec4899', 2.0);
    } else if (waveNum === 3) {
      // BOSS PHASE
      rift.phase = 'boss_phase';
      rift.instabilityPercent = 85;
      rift.phaseName = 'BOSS-PHASE: Astraler Riss-Archon!';
      rift.mobsRemaining = 1;

      const bossName =
        rift.tier === 'mythic'
          ? 'Ur-Titan Voidgazer (Riss-Oberherr)'
          : rift.tier === 'heroic'
          ? 'Astraler Riss-Archon Vaelis'
          : 'Leylinien-Verschlinger Gorgor';

      const bossEntity = this.mobManager.spawnDungeonBoss(
        `rift_boss_${rift.id}`,
        bossName,
        rift.levelReq + 3,
        rift.coords.x,
        rift.coords.z
      );

      rift.bossId = bossEntity.id;
      rift.bossName = bossName;
      rift.bossHp = bossEntity.hp;
      rift.bossMaxHp = bossEntity.maxHp;

      soundSynth.playCombatEngage();
      this.particleSystem.emit('beacon_activate', { x: rift.coords.x, y: 2.0, z: rift.coords.z }, '#f59e0b', 3.0);

      this.broadcastWorldAlert({
        id: `alert_boss_${rift.id}_${Date.now()}`,
        title: `👑 RISS-BOSS ERSCHIENEN!`,
        message: `[${bossName}] ist aus dem Leylinien-Riss in ${rift.zone} hervorgebrochen! Besiege ihn, um den Riss zu versiegeln!`,
        zone: rift.zone,
        coords: rift.coords,
        tier: rift.tier,
        timestamp: Date.now(),
        durationSec: 8,
        icon: '⚔️',
        color: '#f59e0b',
      });
    }

    soundSynth.playLevelUp();
  }

  public handleMobDefeatedInZone(mob: WorldMobEntity) {
    for (const rift of this.activeRifts) {
      if (rift.phase === 'sealed' || rift.phase === 'expired') continue;

      const dist = Math.hypot(mob.x - rift.coords.x, mob.z - rift.coords.z);
      if (dist <= rift.radius + 10.0 || (rift.bossId && mob.id === rift.bossId)) {
        rift.mobsRemaining = Math.max(0, rift.mobsRemaining - 1);
        rift.sealProgress = Math.min(
          100,
          rift.sealProgress + (rift.phase === 'boss_phase' ? 60 : 15)
        );

        if (rift.phase === 'boss_phase' && (mob.id === rift.bossId || rift.mobsRemaining === 0)) {
          this.sealLeylineRift(rift);
          return;
        }

        if (rift.mobsRemaining <= 0) {
          if (rift.activeWave < rift.totalWaves) {
            this.spawnRiftWave(rift, rift.activeWave + 1);
          }
        }

        this.onRiftStatusUpdated?.([...this.activeRifts]);
      }
    }
  }

  public sealLeylineRift(rift: LeylineRiftEvent) {
    rift.phase = 'sealed';
    rift.phaseName = 'Riss erfolgreich versiegelt!';
    rift.sealProgress = 100;
    rift.chestSpawned = true;

    soundSynth.playQuestComplete();

    // 3D Chest Visual at Rift Core
    const visual = this.riftVisuals.get(rift.id);
    if (visual) {
      // Hide vortex beam, shrink rings
      if (visual.beamMesh) visual.beamMesh.visible = false;
      visual.light.color.setHex(0xf59e0b);
      visual.light.intensity = 2.0;

      // Spawn 3D Reward Chest
      const chestGroup = new THREE.Group();
      chestGroup.position.set(0, 0, 0);

      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.95,
        roughness: 0.2,
      });
      const stoneMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.8,
      });

      const chestBody = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 1.3), stoneMat);
      chestBody.position.y = 0.6;
      chestGroup.add(chestBody);

      const chestTrim = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.3, 1.4), goldMat);
      chestTrim.position.y = 1.0;
      chestGroup.add(chestTrim);

      const chestLid = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.0, 12, 1, false, 0, Math.PI), goldMat);
      chestLid.rotation.z = Math.PI / 2;
      chestLid.position.set(0, 1.2, 0);
      chestGroup.add(chestLid);

      // Glowing Aura
      const aura = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 2.8, 24),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
      );
      aura.rotation.x = -Math.PI / 2;
      aura.position.y = 0.05;
      chestGroup.add(aura);

      visual.group.add(chestGroup);
      visual.chestMesh = chestGroup;
    }

    this.particleSystem.emit('explosion', { x: rift.coords.x, y: 3.0, z: rift.coords.z }, '#00f0ff', 3.5);
    this.particleSystem.emit('beacon_activate', { x: rift.coords.x, y: 1.0, z: rift.coords.z }, '#f59e0b', 3.0);

    this.broadcastWorldAlert({
      id: `alert_sealed_${rift.id}_${Date.now()}`,
      title: `🏆 RISS VERSIEGELT: ${rift.germanName}!`,
      message: `Die dimensionalen Mächte wurden bezwungen! Eine epische Schatztruhe wartet am Riss-Epizentrum!`,
      zone: rift.zone,
      coords: rift.coords,
      tier: rift.tier,
      timestamp: Date.now(),
      durationSec: 10,
      icon: '🎁',
      color: '#10b981',
    });

    this.onRiftStatusUpdated?.([...this.activeRifts]);
  }

  public collectRiftLoot(riftId: string): {
    gold: number;
    xp: number;
    shards: number;
    item?: RPGItem;
  } | null {
    const rift = this.activeRifts.find((r) => r.id === riftId);
    if (!rift || !rift.chestSpawned || rift.chestOpened) return null;

    rift.chestOpened = true;
    soundSynth.playLegendaryDrop();

    const visual = this.riftVisuals.get(riftId);
    if (visual && visual.chestMesh) {
      visual.group.remove(visual.chestMesh);
    }

    this.particleSystem.emit('beacon_activate', { x: rift.coords.x, y: 1.0, z: rift.coords.z }, '#10b981', 2.5);

    // Schedule cleanup of sealed rift after 15s
    setTimeout(() => {
      this.removeRift(riftId);
    }, 15000);

    this.onRiftStatusUpdated?.([...this.activeRifts]);

    return {
      gold: rift.rewards.gold,
      xp: rift.rewards.xp,
      shards: rift.rewards.leylineShards,
      item: rift.rewards.bonusItem,
    };
  }

  public removeRift(riftId: string) {
    const visual = this.riftVisuals.get(riftId);
    if (visual) {
      this.scene.remove(visual.group);
      this.riftVisuals.delete(riftId);
    }
    this.activeRifts = this.activeRifts.filter((r) => r.id !== riftId);
    this.onRiftStatusUpdated?.([...this.activeRifts]);
  }

  public broadcastWorldAlert(alert: WorldEventAlert) {
    this.recentAlerts.unshift(alert);
    if (this.recentAlerts.length > 8) this.recentAlerts.pop();
    this.onAlertTriggered?.(alert);
    soundSynth.playQuestComplete();
  }

  public update(delta: number, playerX: number, playerZ: number) {
    this.eventTicker += delta;

    // Random rift spawner
    if (this.eventTicker >= this.nextRandomSpawnTime) {
      this.eventTicker = 0;
      this.nextRandomSpawnTime = 120 + Math.random() * 90; // Every 2-3.5 minutes

      if (this.activeRifts.length < 3) {
        this.spawnRandomLeylineRift();
      }
    }

    // Update active rifts & 3D animations
    for (const rift of this.activeRifts) {
      if (rift.phase !== 'sealed' && rift.phase !== 'expired') {
        rift.timeRemainingSec -= delta;

        // Instability creeps up if not cleared
        rift.instabilityPercent = Math.min(
          100,
          rift.instabilityPercent + delta * 0.15
        );

        if (rift.timeRemainingSec <= 0) {
          rift.phase = 'expired';
          rift.phaseName = 'Riss kollabiert (Zeit abgelaufen)';
          this.removeRift(rift.id);
          continue;
        }
      }

      // Animate 3D meshes
      const visual = this.riftVisuals.get(rift.id);
      if (visual) {
        const t = performance.now() * 0.002;
        visual.vortexRings.forEach((ring, idx) => {
          ring.rotation.x += delta * (1.2 + idx * 0.6);
          ring.rotation.y += delta * (0.8 - idx * 0.4);
          ring.rotation.z += delta * (1.0 + idx * 0.3);
        });

        visual.crystalMesh.rotation.y += delta * 1.8;
        visual.crystalMesh.position.y = 3.5 + Math.sin(t * 3.0) * 0.4;

        if (visual.beamMesh) {
          visual.beamMesh.rotation.y -= delta * 0.5;
        }

        if (visual.chestMesh) {
          visual.chestMesh.rotation.y += delta * 0.6;
        }
      }
    }

    // Clean up old alerts
    const now = Date.now();
    this.recentAlerts = this.recentAlerts.filter(
      (a) => now - a.timestamp < a.durationSec * 1000
    );
  }

  private spawnRandomLeylineRift() {
    const locations = [
      {
        id: `rift_scorched_${Date.now()}`,
        name: 'Leyline Rift: Scorched Quarry',
        germanName: 'Instabiler Leylinien-Riss: Schlackenkamm',
        zone: 'Scorched Iron Quarry',
        coords: { x: -65 + Math.random() * 20, z: -15 + Math.random() * 20 },
        tier: 'heroic' as LeylineRiftTier,
        levelReq: 8,
        color: '#f97316',
        icon: '🔥',
        lore: 'Schmelzende Leylinien entzünden die Steinbrüche der Eisengarde.',
      },
      {
        id: `rift_void_${Date.now()}`,
        name: 'Abyssal Void Rift',
        germanName: 'Kosmischer Leerenriss des Äthers',
        zone: 'Void Crater',
        coords: { x: 15 + Math.random() * 20, z: 80 + Math.random() * 20 },
        tier: 'mythic' as LeylineRiftTier,
        levelReq: 15,
        color: '#a855f7',
        icon: '👁️',
        lore: 'Ein finsterer Riss zerreißt den Himmel über dem Leerenkrater!',
      },
      {
        id: `rift_sunwatch_${Date.now()}`,
        name: 'Solar Storm Rift',
        germanName: 'Sonnen-Aura Riss der Bastion',
        zone: 'Sanctum Capital',
        coords: { x: -10 + Math.random() * 20, z: -55 + Math.random() * 20 },
        tier: 'normal' as LeylineRiftTier,
        levelReq: 4,
        color: '#eab308',
        icon: '☀️',
        lore: 'Überladene Sonnenstrahlen öffnen ein Portal in den Hauptstadtwiesen.',
      },
    ];

    const pick = locations[Math.floor(Math.random() * locations.length)];
    this.createLeylineRift(pick);
  }
}
