/**
 * NPCEconomyVisualizer.ts
 *
 * High-Performance Three.js Visualizer for Autonomous NPC Economy:
 * - Uses THREE.InstancedMesh for hundreds of simulated economy agents
 * - Computes smooth alpha interpolation between discrete 10Hz simulation ticks
 * - Applies cinematic stylized Aurion materials (Honey-stone, Brushed Bronze, Aurion-Türkis Aether)
 * - Visualizes regional trade hubs, cargo caravans, and state color accents
 */

import * as THREE from 'three';
import { AutonomousNPCEconomy, AutonomousNPC } from './AutonomousNPCEconomy';
import { caravanSecuritySystem, BanditRaider } from './CaravanSecuritySystem';

export class NPCEconomyVisualizer {
  private scene: THREE.Scene;
  private economy: AutonomousNPCEconomy;
  private instancedMesh: THREE.InstancedMesh | null = null;
  private dummyObject: THREE.Object3D = new THREE.Object3D();
  private colorBuffer: THREE.InstancedBufferAttribute | null = null;
  private hubGroup: THREE.Group = new THREE.Group();
  private caravanGroup: THREE.Group = new THREE.Group();
  private raiderGroup: THREE.Group = new THREE.Group();

  private maxCapacity: number = 200;

  // Frustum Culling utilities
  private frustum: THREE.Frustum = new THREE.Frustum();
  private projScreenMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private boundingSphere: THREE.Sphere = new THREE.Sphere(new THREE.Vector3(), 2.0);

  // Palette constants matching Art Direction
  private readonly COLOR_COMMERCE = new THREE.Color(0x00f0ff);   // Aurion-Türkis
  private readonly COLOR_PRODUCTION = new THREE.Color(0xfbbf24); // Weathered Honey-Gold
  private readonly COLOR_SURVIVAL = new THREE.Color(0xcd7f32);   // Brushed Bronze
  private readonly COLOR_DEFENSE = new THREE.Color(0x38bdf8);    // Sentinel Cyan-Steel
  private readonly COLOR_DEAD = new THREE.Color(0x292524);       // Dark Stone
  private readonly COLOR_RAIDER = new THREE.Color(0xef4444);     // Crimson Bandit

  constructor(scene: THREE.Scene, economy: AutonomousNPCEconomy) {
    this.scene = scene;
    this.economy = economy;
    this.initializeVisuals();
  }

  private initializeVisuals(): void {
    // 1. Create Articulated Composite Geometry for Instanced Citizens
    const baseGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.4, 6);
    baseGeo.translate(0, 0.7, 0);

    const headGeo = new THREE.DodecahedronGeometry(0.3, 1);
    headGeo.translate(0, 1.6, 0);

    // Merge composite geometry
    const mergedGeo = new THREE.BufferGeometry();
    const pos1 = baseGeo.attributes.position.array;
    const pos2 = headGeo.attributes.position.array;
    const combined = new Float32Array(pos1.length + pos2.length);
    combined.set(pos1, 0);
    combined.set(pos2, pos1.length);
    mergedGeo.setAttribute('position', new THREE.BufferAttribute(combined, 3));
    mergedGeo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.35,
      metalness: 0.65,
      emissive: new THREE.Color(0x051a2e),
      emissiveIntensity: 0.2,
    });

    this.instancedMesh = new THREE.InstancedMesh(mergedGeo, mat, this.maxCapacity);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.castShadow = true;
    this.instancedMesh.receiveShadow = true;

    // Instance Color buffer
    const colors = new Float32Array(this.maxCapacity * 3);
    this.colorBuffer = new THREE.InstancedBufferAttribute(colors, 3);
    this.instancedMesh.geometry.setAttribute('color', this.colorBuffer);

    this.scene.add(this.instancedMesh);
    this.scene.add(this.hubGroup);
    this.scene.add(this.caravanGroup);
    this.scene.add(this.raiderGroup);

    this.buildRegionalMarketVisuals();
  }

  private buildRegionalMarketVisuals(): void {
    // Construct Stylized Market Kiosks & Aetherial Beacons for each Regional Hub
    for (const hub of this.economy.hubs.values()) {
      const hubAnchor = new THREE.Group();
      hubAnchor.position.set(hub.coords.x, 0, hub.coords.z);

      // Stone Base Platform
      const baseMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(4.5, 5.0, 0.6, 8),
        new THREE.MeshStandardMaterial({
          color: 0xd4af37,
          roughness: 0.8,
          metalness: 0.2,
        })
      );
      baseMesh.position.y = 0.3;
      hubAnchor.add(baseMesh);

      // 4 Honey-stone Pillars
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 3.2, 0.6),
          new THREE.MeshStandardMaterial({
            color: 0xcd7f32,
            roughness: 0.5,
            metalness: 0.7,
          })
        );
        pillar.position.set(Math.cos(angle) * 3.2, 1.6, Math.sin(angle) * 3.2);
        hubAnchor.add(pillar);
      }

      // Central Floating Turquoise Trade Rune Crystal
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.2, 0),
        new THREE.MeshStandardMaterial({
          color: 0x00f0ff,
          emissive: 0x06b6d4,
          emissiveIntensity: 0.8,
          roughness: 0.1,
          metalness: 0.9,
          transparent: true,
          opacity: 0.9,
        })
      );
      crystal.position.y = 2.8;
      crystal.name = 'floating_crystal';
      hubAnchor.add(crystal);

      // Market Banner
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 2.2),
        new THREE.MeshBasicMaterial({
          color: 0x14b8a6,
          side: THREE.DoubleSide,
        })
      );
      banner.position.set(0, 3.2, 2.5);
      hubAnchor.add(banner);

      this.hubGroup.add(hubAnchor);
    }
  }

  /**
   * Render Loop Update: Interpolate positions with sub-tick alpha and CPU Frustum Culling & LOD
   */
  public update(alpha: number, elapsedTime: number, camera?: THREE.Camera): void {
    if (!this.instancedMesh) return;

    // 1. Setup Camera Frustum for Culling if camera provided
    let hasFrustum = false;
    if (camera) {
      this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
      hasFrustum = true;
    }

    // 2. Animate Floating Hub Crystals
    this.hubGroup.children.forEach((hubGroup, idx) => {
      const crystal = hubGroup.getObjectByName('floating_crystal');
      if (crystal) {
        crystal.rotation.y = elapsedTime * 0.8 + idx;
        crystal.position.y = 2.8 + Math.sin(elapsedTime * 2.0 + idx) * 0.2;
      }
    });

    // 3. Interpolate NPC Positions & Apply Frustum Culling + LOD
    let visibleInstanceCount = 0;
    const cameraPos = camera ? camera.position : null;

    for (let i = 0; i < this.economy.npcs.length && i < this.maxCapacity; i++) {
      const npc = this.economy.npcs[i];
      if (!npc.alive) continue;

      // Lerp position between previous tick and current tick
      const renderX = THREE.MathUtils.lerp(npc.prevX, npc.x, alpha);
      const renderZ = THREE.MathUtils.lerp(npc.prevZ, npc.z, alpha);

      // CPU Frustum Culling check
      if (hasFrustum) {
        this.boundingSphere.center.set(renderX, 1.0, renderZ);
        if (!this.frustum.intersectsSphere(this.boundingSphere)) {
          continue; // Culled by Frustum
        }
      }

      // Compute distance to camera for Level-of-Detail (LOD)
      const distToCam = cameraPos ? Math.hypot(cameraPos.x - renderX, cameraPos.z - renderZ) : 20.0;
      const isLODHigh = distToCam < 50.0;

      this.dummyObject.position.set(renderX, 0, renderZ);

      // Orientations & Locomotion Animation
      const dx = npc.x - npc.prevX;
      const dz = npc.z - npc.prevZ;
      if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
        this.dummyObject.rotation.y = Math.atan2(dx, dz);
      }

      if (isLODHigh) {
        const isMoving = Math.sqrt(dx * dx + dz * dz) > 0.01;
        const bob = isMoving ? Math.sin(elapsedTime * 12 + npc.id) * 0.08 : 0;
        this.dummyObject.position.y = bob;
      } else {
        this.dummyObject.position.y = 0;
      }

      // Scale modifier based on combat grit / generation
      const scale = 0.9 + Math.min(0.4, (npc.generation - 1) * 0.1);
      this.dummyObject.scale.set(scale, scale, scale);

      this.dummyObject.updateMatrix();
      this.instancedMesh.setMatrixAt(visibleInstanceCount, this.dummyObject.matrix);

      // Set State Color
      let color = this.COLOR_PRODUCTION;
      if (npc.macroState === 'COMMERCE') color = this.COLOR_COMMERCE;
      else if (npc.macroState === 'SURVIVAL') color = this.COLOR_SURVIVAL;
      else if (npc.macroState === 'DEFENSE') color = this.COLOR_DEFENSE;

      this.instancedMesh.setColorAt(visibleInstanceCount, color);
      visibleInstanceCount++;
    }

    this.instancedMesh.count = visibleInstanceCount;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }

    // 4. Render Active Bandit Raiders
    this.updateRaiderVisuals(elapsedTime);
  }

  private updateRaiderVisuals(elapsedTime: number): void {
    const raiders = caravanSecuritySystem.activeRaiders;

    // Sync child meshes with raider list
    while (this.raiderGroup.children.length < raiders.length) {
      const raiderMesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 1.5, 5),
        new THREE.MeshStandardMaterial({
          color: 0xef4444,
          roughness: 0.4,
          metalness: 0.8,
          emissive: 0x7f1d1d,
          emissiveIntensity: 0.5,
        })
      );
      raiderMesh.castShadow = true;
      this.raiderGroup.add(raiderMesh);
    }

    while (this.raiderGroup.children.length > raiders.length) {
      const child = this.raiderGroup.children.pop();
      if (child) {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      }
    }

    for (let i = 0; i < raiders.length; i++) {
      const raider = raiders[i];
      const mesh = this.raiderGroup.children[i];
      if (mesh) {
        mesh.position.set(raider.x, 0.75 + Math.sin(elapsedTime * 8 + i) * 0.1, raider.z);
        mesh.rotation.y = elapsedTime * 4.0;
      }
    }
  }

  public destroy(): void {
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
      this.instancedMesh = null;
    }

    this.scene.remove(this.hubGroup);
    this.scene.remove(this.caravanGroup);
    this.scene.remove(this.raiderGroup);
  }
}
