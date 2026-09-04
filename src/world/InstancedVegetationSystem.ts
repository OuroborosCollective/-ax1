/**
 * InstancedVegetationSystem.ts
 *
 * Implements GPU-accelerated InstancedMesh batching for dense open-world
 * vegetation and environmental props (whispering pines, grass clumps, rune pillars).
 *
 * Replaces hundreds of individual draw calls with unified InstancedMesh buffers,
 * maintaining high framerates across expansive zones.
 */

import * as THREE from 'three';
import { terrainBarycentric } from './TerrainBarycentric';

export interface PropInstanceData {
  x: number;
  z: number;
  scale: number;
  rotationY: number;
}

export class InstancedVegetationSystem {
  public scene: THREE.Scene;
  public group: THREE.Group;

  // Batched Instanced Meshes
  private pineTreeTrunkMesh: THREE.InstancedMesh | null = null;
  private pineTreeFoliageMesh: THREE.InstancedMesh | null = null;
  private grassTuftsMesh: THREE.InstancedMesh | null = null;
  private runeColumnMesh: THREE.InstancedMesh | null = null;

  private dummyObject = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  /**
   * Initializes and populates GPU InstancedMeshes across the world zones.
   */
  public buildInstancedBatches(): void {
    this.buildInstancedPineForest(80);
    this.buildInstancedGrassTufts(140);
    this.buildInstancedRuneColumns(24);
  }

  /**
   * Batch 1: Whispering Pine Trees (Trunks & Foliage Cones)
   */
  private buildInstancedPineForest(count: number): void {
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 3.2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x3e2723,
      roughness: 0.9,
      metalness: 0.1,
    });

    const foliageGeo = new THREE.ConeGeometry(2.4, 4.8, 6);
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x1b4332,
      roughness: 0.8,
      metalness: 0.1,
      flatShading: true,
    });

    this.pineTreeTrunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    this.pineTreeFoliageMesh = new THREE.InstancedMesh(foliageGeo, foliageMat, count);

    this.pineTreeTrunkMesh.castShadow = true;
    this.pineTreeFoliageMesh.castShadow = true;

    let index = 0;
    // Generate deterministic distribution in Whispering Woods (x: 20 to 80, z: -20 to -80)
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 * 6.5;
      const dist = 25.0 + ((i * 17) % 55);
      const x = 30.0 + Math.cos(angle) * dist;
      const z = -35.0 + Math.sin(angle) * dist;

      const groundY = terrainBarycentric.getHeight(x, z);
      const scale = 0.85 + ((i % 5) * 0.12);
      const rotY = (i * 1.37) % (Math.PI * 2);

      // Trunk Transform
      this.dummyObject.position.set(x, groundY + 1.6 * scale, z);
      this.dummyObject.scale.set(scale, scale, scale);
      this.dummyObject.rotation.set(0, rotY, 0);
      this.dummyObject.updateMatrix();
      this.pineTreeTrunkMesh.setMatrixAt(index, this.dummyObject.matrix);

      // Foliage Transform
      this.dummyObject.position.set(x, groundY + (1.6 + 2.2) * scale, z);
      this.dummyObject.updateMatrix();
      this.pineTreeFoliageMesh.setMatrixAt(index, this.dummyObject.matrix);

      index++;
    }

    this.pineTreeTrunkMesh.instanceMatrix.needsUpdate = true;
    this.pineTreeFoliageMesh.instanceMatrix.needsUpdate = true;

    this.group.add(this.pineTreeTrunkMesh);
    this.group.add(this.pineTreeFoliageMesh);
  }

  /**
   * Batch 2: Grass Tufts / Meadow Wildflowers
   */
  private buildInstancedGrassTufts(count: number): void {
    const tuftGeo = new THREE.ConeGeometry(0.5, 0.9, 4);
    const tuftMat = new THREE.MeshStandardMaterial({
      color: 0x2d6a4f,
      roughness: 0.9,
    });

    this.grassTuftsMesh = new THREE.InstancedMesh(tuftGeo, tuftMat, count);

    for (let i = 0; i < count; i++) {
      const angle = (i * 0.77) % (Math.PI * 2);
      const radius = 8.0 + ((i * 19) % 85);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      // Don't spawn on paved center plaza
      if (Math.hypot(x, z) < 18) continue;

      const groundY = terrainBarycentric.getHeight(x, z);
      const scale = 0.7 + ((i % 4) * 0.15);

      this.dummyObject.position.set(x, groundY + 0.45 * scale, z);
      this.dummyObject.scale.set(scale, scale, scale);
      this.dummyObject.rotation.set(0, (i * 0.8) % Math.PI, 0);
      this.dummyObject.updateMatrix();
      this.grassTuftsMesh.setMatrixAt(i, this.dummyObject.matrix);
    }

    this.grassTuftsMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.grassTuftsMesh);
  }

  /**
   * Batch 3: Ancient Gilded Rune Pillars
   */
  private buildInstancedRuneColumns(count: number): void {
    const colGeo = new THREE.CylinderGeometry(0.6, 0.75, 4.5, 8);
    const colMat = new THREE.MeshStandardMaterial({
      color: 0xb45309, // Bronze / weathered gold
      metalness: 0.75,
      roughness: 0.35,
    });

    this.runeColumnMesh = new THREE.InstancedMesh(colGeo, colMat, count);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = 26.0; // Perimeter ring around Sanctum
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      const groundY = terrainBarycentric.getHeight(x, z);

      this.dummyObject.position.set(x, groundY + 2.25, z);
      this.dummyObject.scale.set(1, 1, 1);
      this.dummyObject.rotation.set(0, angle, 0);
      this.dummyObject.updateMatrix();
      this.runeColumnMesh.setMatrixAt(i, this.dummyObject.matrix);
    }

    this.runeColumnMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.runeColumnMesh);
  }

  public dispose(): void {
    this.scene.remove(this.group);
  }
}
