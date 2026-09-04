/**
 * LineOfSightSystem.ts
 *
 * Implements deterministic 3D raycasting and line-of-sight checks against
 * world collision geometry and registered obstacles.
 *
 * Used to:
 * 1. Validate spell casts and ranged attacks (cannot shoot through stone walls/boulders)
 * 2. Prevent mob aggro through fortress barriers and rock outcrops
 * 3. Break combat pursuit when players strategically navigate around corners
 */

import * as THREE from 'three';
import { SolidObstacle } from '../../types';
import { collisionSystem } from '../../world/WorldCollisionSystem';

export interface LoSResult {
  hasLoS: boolean;
  distance: number;
  hitPoint?: THREE.Vector3;
  blockingObstacle?: SolidObstacle;
}

export class LineOfSightSystem {
  private static instance: LineOfSightSystem | null = null;
  public static getInstance(): LineOfSightSystem {
    if (!LineOfSightSystem.instance) {
      LineOfSightSystem.instance = new LineOfSightSystem();
    }
    return LineOfSightSystem.instance;
  }

  /**
   * Performs a 3D raycast between fromPoint and toPoint against nearby world obstacles.
   *
   * @param fromPoint Start of the ray (e.g. attacker eye position)
   * @param toPoint End of the ray (e.g. target center)
   * @param rayRadius Cylinder thickness of the projectile / line of sight (e.g. 0.2m)
   */
  public checkLineOfSight(
    fromPoint: THREE.Vector3,
    toPoint: THREE.Vector3,
    rayRadius: number = 0.15
  ): LoSResult {
    const rayDir = new THREE.Vector3().subVectors(toPoint, fromPoint);
    const totalDist = rayDir.length();
    if (totalDist < 0.01) {
      return { hasLoS: true, distance: 0 };
    }

    const normDir = rayDir.clone().normalize();
    const midX = (fromPoint.x + toPoint.x) * 0.5;
    const midZ = (fromPoint.z + toPoint.z) * 0.5;
    const searchRadius = (totalDist * 0.5) + 4.0;

    // Retrieve potential obstacles from spatial grid
    const obstacles = collisionSystem.getNearbyObstacles(midX, midZ, searchRadius);

    let nearestHitDist = Infinity;
    let nearestObstacle: SolidObstacle | undefined = undefined;
    let hitPoint: THREE.Vector3 | undefined = undefined;

    // 2D cylinder ray-intersection test (obstacles are vertical cylinders with radius and height)
    for (const obs of obstacles) {
      const effRadius = obs.radius + rayRadius;

      // Vector from ray origin to cylinder center in XZ plane
      const ox = obs.x - fromPoint.x;
      const oz = obs.z - fromPoint.z;

      // Project cylinder center onto ray direction
      const t = ox * normDir.x + oz * normDir.z;

      // If cylinder is behind the ray origin or beyond target distance, skip
      if (t < 0 || t > totalDist) {
        // Also check if endpoints are inside the cylinder
        const dFrom = Math.hypot(fromPoint.x - obs.x, fromPoint.z - obs.z);
        if (dFrom < effRadius) {
          return {
            hasLoS: false,
            distance: 0,
            hitPoint: fromPoint.clone(),
            blockingObstacle: obs,
          };
        }
        continue;
      }

      // Perpendicular distance squared from cylinder center to ray
      const closestX = fromPoint.x + normDir.x * t;
      const closestZ = fromPoint.z + normDir.z * t;
      const perpDistSq = (obs.x - closestX) ** 2 + (obs.z - closestZ) ** 2;

      if (perpDistSq <= effRadius * effRadius) {
        // Ray intersects cylinder in XZ plane!
        // Calculate exact entry point distance
        const dt = Math.sqrt(Math.max(0, effRadius * effRadius - perpDistSq));
        const hitT = Math.max(0, t - dt);

        if (hitT < totalDist && hitT < nearestHitDist) {
          // Check vertical height of obstacle (if obstacle has height > 0)
          const hitY = fromPoint.y + normDir.y * hitT;
          const obsHeight = obs.height || 4.0;
          const obsMinY = -1.0;
          const obsMaxY = obsHeight;

          if (hitY >= obsMinY && hitY <= obsMaxY) {
            nearestHitDist = hitT;
            nearestObstacle = obs;
            hitPoint = new THREE.Vector3(
              fromPoint.x + normDir.x * hitT,
              hitY,
              fromPoint.z + normDir.z * hitT
            );
          }
        }
      }
    }

    if (nearestObstacle && nearestHitDist < totalDist) {
      return {
        hasLoS: false,
        distance: nearestHitDist,
        hitPoint,
        blockingObstacle: nearestObstacle,
      };
    }

    return {
      hasLoS: true,
      distance: totalDist,
    };
  }
}

export const lineOfSight = LineOfSightSystem.getInstance();
