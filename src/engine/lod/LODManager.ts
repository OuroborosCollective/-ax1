import * as THREE from 'three';

export enum LODTier {
  HIGH = 0,   // < 24m: full details, cast shadows, 60fps
  MEDIUM = 1, // 24m - 55m: simplified details, disabled shadows, 30fps
  LOW = 2,    // > 55m: minimal rendering, culled accessories, 15fps
  CULLED = 3, // out of camera frustum or > 120m
}

export interface LODTarget {
  id: string;
  group: THREE.Object3D;
  position: THREE.Vector3;
  currentTier: LODTier;
  highDetailMeshes?: THREE.Object3D[];
  lowDetailMeshes?: THREE.Object3D[];
  lastUpdateTick: number;
}

export class LODManager {
  private targets: Map<string, LODTarget> = new Map();
  private frustum: THREE.Frustum = new THREE.Frustum();
  private projScreenMatrix: THREE.Matrix4 = new THREE.Matrix4();

  public stats = {
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    culledCount: 0,
    totalTracked: 0,
  };

  public registerTarget(
    id: string,
    group: THREE.Object3D,
    highDetailMeshes?: THREE.Object3D[],
    lowDetailMeshes?: THREE.Object3D[]
  ): void {
    this.targets.set(id, {
      id,
      group,
      position: group.position,
      currentTier: LODTier.HIGH,
      highDetailMeshes,
      lowDetailMeshes,
      lastUpdateTick: 0,
    });
  }

  public unregisterTarget(id: string): void {
    this.targets.delete(id);
  }

  public update(camera: THREE.Camera): void {
    this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

    const camPos = camera.position;
    let high = 0;
    let medium = 0;
    let low = 0;
    let culled = 0;

    this.targets.forEach((target) => {
      const dist = target.position.distanceTo(camPos);

      // Frustum culling check (bounding sphere approximation with 3m radius)
      const inFrustum = this.frustum.intersectsSphere(new THREE.Sphere(target.position, 3.0));

      if (!inFrustum && dist > 35.0) {
        target.currentTier = LODTier.CULLED;
        target.group.visible = false;
        culled++;
        return;
      }

      target.group.visible = true;

      if (dist < 25.0) {
        target.currentTier = LODTier.HIGH;
        this.applyTierSettings(target, true, true);
        high++;
      } else if (dist < 58.0) {
        target.currentTier = LODTier.MEDIUM;
        this.applyTierSettings(target, true, false);
        medium++;
      } else {
        target.currentTier = LODTier.LOW;
        this.applyTierSettings(target, false, false);
        low++;
      }
    });

    this.stats.highCount = high;
    this.stats.mediumCount = medium;
    this.stats.lowCount = low;
    this.stats.culledCount = culled;
    this.stats.totalTracked = this.targets.size;
  }

  private applyTierSettings(target: LODTarget, showHigh: boolean, castShadows: boolean): void {
    if (target.highDetailMeshes) {
      target.highDetailMeshes.forEach((m) => {
        m.visible = showHigh;
        m.castShadow = castShadows;
      });
    }
    if (target.lowDetailMeshes) {
      target.lowDetailMeshes.forEach((m) => {
        m.visible = !showHigh;
      });
    }
  }

  public shouldSkipTick(targetId: string, currentTick: number): boolean {
    const target = this.targets.get(targetId);
    if (!target) return false;

    if (target.currentTier === LODTier.LOW) {
      // Run logic only every 4th tick (15fps)
      return currentTick % 4 !== 0;
    } else if (target.currentTier === LODTier.MEDIUM) {
      // Run logic every 2nd tick (30fps)
      return currentTick % 2 !== 0;
    }
    return false;
  }

  public clear(): void {
    this.targets.clear();
  }
}

export const lodManager = new LODManager();
