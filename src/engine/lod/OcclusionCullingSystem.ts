/**
 * OcclusionCullingSystem.ts
 *
 * Implements hierarchical occlusion culling using static large-scale occluders
 * (Citadel walls, monolithic fortress towers, crater rims).
 *
 * Prevents GPU vertex and fragment overhead for geometry that is within the camera's
 * view frustum but completely occluded behind massive stone architecture or terrain ridges.
 */

import * as THREE from 'three';

export interface BoxOccluder {
  id: string;
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export class OcclusionCullingSystem {
  private occluders: BoxOccluder[] = [];
  public stats = {
    totalTested: 0,
    totalOccluded: 0,
  };

  constructor() {
    this.registerDefaultWorldOccluders();
  }

  /**
   * Registers default large structures as primary occluders.
   */
  private registerDefaultWorldOccluders(): void {
    // 1. Sanctum South Monolith Wall (Center Hub rear rampart)
    this.addOccluder('sanctum_monolith_wall', new THREE.Vector3(-14, 0, -22), new THREE.Vector3(14, 12, -18));
    // 2. West Quarry Fortress Bastion
    this.addOccluder('quarry_bastion', new THREE.Vector3(-55, 0, -10), new THREE.Vector3(-45, 16, 10));
    // 3. East Clockwork Watchtower
    this.addOccluder('clockwork_tower', new THREE.Vector3(45, 0, -45), new THREE.Vector3(55, 20, -35));
  }

  public addOccluder(id: string, min: THREE.Vector3, max: THREE.Vector3): void {
    this.occluders.push({ id, min, max });
  }

  /**
   * Test whether a target bounding sphere is completely occluded by any registered occluder
   * from the camera position.
   */
  public isOccluded(
    cameraPos: THREE.Vector3,
    targetCenter: THREE.Vector3,
    targetRadius: number = 1.0
  ): boolean {
    this.stats.totalTested++;

    const camToTarget = new THREE.Vector3().subVectors(targetCenter, cameraPos);
    const targetDist = camToTarget.length();
    if (targetDist < 4.0) {
      // Too close to camera to be occluded
      return false;
    }

    const rayDir = camToTarget.clone().normalize();

    // Check each occluder
    for (const occ of this.occluders) {
      // Quick distance check: occluder must be strictly between camera and target
      const occCenter = new THREE.Vector3().addVectors(occ.min, occ.max).multiplyScalar(0.5);
      const distToOcc = cameraPos.distanceTo(occCenter);

      if (distToOcc >= targetDist) continue; // Occluder is behind the target

      // Ray-AABB intersection
      const tMin = (occ.min.x - cameraPos.x) / rayDir.x;
      const tMax = (occ.max.x - cameraPos.x) / rayDir.x;
      const t1x = Math.min(tMin, tMax);
      const t2x = Math.max(tMin, tMax);

      const tMinY = (occ.min.y - cameraPos.y) / rayDir.y;
      const tMaxY = (occ.max.y - cameraPos.y) / rayDir.y;
      const t1y = Math.min(tMinY, tMaxY);
      const t2y = Math.max(tMinY, tMaxY);

      const tMinZ = (occ.min.z - cameraPos.z) / rayDir.z;
      const tMaxZ = (occ.max.z - cameraPos.z) / rayDir.z;
      const t1z = Math.min(tMinZ, tMaxZ);
      const t2z = Math.max(tMinZ, tMaxZ);

      const tNear = Math.max(Math.max(t1x, t1y), t1z);
      const tFar = Math.min(Math.min(t2x, t2y), t2z);

      if (tNear <= tFar && tFar > 0 && tNear < targetDist - targetRadius) {
        // Ray intersects the occluder box before reaching target
        this.stats.totalOccluded++;
        return true;
      }
    }

    return false;
  }
}

export const occlusionCulling = new OcclusionCullingSystem();
