import * as THREE from 'three';
import { ItemRarity, LootDropEntity, RPGItem } from '../types';

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

  constructor(scene: THREE.Scene) {
    this.scene = scene;
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
