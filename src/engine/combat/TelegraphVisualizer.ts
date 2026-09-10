import * as THREE from 'three';
import { BossTelegraph } from '../../types';

export class TelegraphVisualizer {
  private scene: THREE.Scene;
  private activeTelegraphs: Map<string, { telegraph: BossTelegraph; outerMesh: THREE.Mesh; innerMesh: THREE.Mesh }> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public addTelegraph(telegraph: BossTelegraph): void {
    if (this.activeTelegraphs.has(telegraph.id)) return;

    let outerGeo: THREE.BufferGeometry;
    let innerGeo: THREE.BufferGeometry;

    const baseColor = new THREE.Color(telegraph.color || '#ef4444');

    if (telegraph.type === 'circle') {
      outerGeo = new THREE.RingGeometry(telegraph.radius * 0.95, telegraph.radius, 32);
      outerGeo.rotateX(-Math.PI / 2);

      innerGeo = new THREE.CircleGeometry(0.01, 32);
      innerGeo.rotateX(-Math.PI / 2);
    } else if (telegraph.type === 'cone') {
      const arc = telegraph.arcAngle || Math.PI * 0.5;
      outerGeo = new THREE.RingGeometry(telegraph.radius * 0.92, telegraph.radius, 24, 1, -arc / 2, arc);
      outerGeo.rotateX(-Math.PI / 2);

      innerGeo = new THREE.CircleGeometry(0.01, 24, -arc / 2, arc);
      innerGeo.rotateX(-Math.PI / 2);
    } else {
      // Rectangle / Linear Strip
      const w = telegraph.width || 3.0;
      const l = telegraph.length || 10.0;
      outerGeo = new THREE.PlaneGeometry(w, l);
      outerGeo.rotateX(-Math.PI / 2);

      innerGeo = new THREE.PlaneGeometry(w * 0.96, 0.01);
      innerGeo.rotateX(-Math.PI / 2);
    }

    const outerMat = new THREE.MeshBasicMaterial({
      color: baseColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    const innerMat = new THREE.MeshBasicMaterial({
      color: baseColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });

    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);

    outerMesh.position.set(telegraph.x, telegraph.y + 0.04, telegraph.z);
    innerMesh.position.set(telegraph.x, telegraph.y + 0.03, telegraph.z);

    if (telegraph.angle !== undefined) {
      outerMesh.rotation.y = telegraph.angle;
      innerMesh.rotation.y = telegraph.angle;
    }

    this.scene.add(outerMesh);
    this.scene.add(innerMesh);

    this.activeTelegraphs.set(telegraph.id, {
      telegraph,
      outerMesh,
      innerMesh,
    });
  }

  public update(delta: number, onExplode?: (telegraph: BossTelegraph) => void): void {
    const expired: string[] = [];

    this.activeTelegraphs.forEach((entry, id) => {
      const t = entry.telegraph;
      t.castTime += delta;
      const progress = Math.min(1.0, t.castTime / t.totalCastTime);

      // Scale inner filling mesh to reflect cast windup progress
      if (t.type === 'circle' || t.type === 'cone') {
        const currentRadius = Math.max(0.05, t.radius * progress);
        entry.innerMesh.scale.set(currentRadius, 1, currentRadius);
      } else {
        const currentLength = Math.max(0.05, (t.length || 10) * progress);
        entry.innerMesh.scale.set(1, 1, currentLength);
      }

      // Pulsate opacity as attack nears completion
      const pulse = 0.35 + Math.sin(t.castTime * 14) * 0.2;
      (entry.innerMesh.material as THREE.MeshBasicMaterial).opacity = pulse;

      if (t.castTime >= t.totalCastTime) {
        expired.push(id);
        onExplode?.(t);
      }
    });

    for (const id of expired) {
      this.removeTelegraph(id);
    }
  }

  public removeTelegraph(id: string): void {
    const entry = this.activeTelegraphs.get(id);
    if (!entry) return;

    this.scene.remove(entry.outerMesh);
    this.scene.remove(entry.innerMesh);
    entry.outerMesh.geometry.dispose();
    entry.innerMesh.geometry.dispose();
    (entry.outerMesh.material as THREE.Material).dispose();
    (entry.innerMesh.material as THREE.Material).dispose();

    this.activeTelegraphs.delete(id);
  }

  public clear(): void {
    this.activeTelegraphs.forEach((_, id) => {
      this.removeTelegraph(id);
    });
    this.activeTelegraphs.clear();
  }
}
