/**
 * TerrainBarycentric.ts
 *
 * Implements exact terrain elevation queries and barycentric surface normal calculations.
 *
 * Computes:
 * 1. Exact ground height Y at arbitrary world coordinates (x, z)
 * 2. Surface normal vector n = (nx, ny, nz)
 * 3. Character / mount pitch and roll orientation angles aligning to hills and cambered terrain
 */

import * as THREE from 'three';

export interface TerrainSample {
  height: number;
  normal: THREE.Vector3;
  slopeAngleDeg: number;
  pitchAngleRad: number; // Tilts forward/backward based on facing angle
  rollAngleRad: number;  // Tilts left/right based on facing angle
}

export class TerrainBarycentric {
  private static instance: TerrainBarycentric | null = null;
  public static getInstance(): TerrainBarycentric {
    if (!TerrainBarycentric.instance) {
      TerrainBarycentric.instance = new TerrainBarycentric();
    }
    return TerrainBarycentric.instance;
  }

  /**
   * Evaluates the analytical elevation function matching the procedural landscape.
   */
  public getHeight(x: number, z: number): number {
    const distFromCenter = Math.hypot(x, z);

    // 1. Sanctum Hub (Center: radius < 34m) -> Flat paved plaza at Y = 0
    if (distFromCenter < 34) {
      return 0;
    }

    // 2. Whispering Woods (North-East: x > 15, z < 20) -> Rolling hills
    if (x > 15 && z < 20) {
      return Math.sin(x * 0.08) * Math.cos(z * 0.08) * 2.2 + Math.sin(x * 0.2) * 0.8;
    }

    // 3. Scorched Quarry (West: x < -15) -> Rugged cliffs & canyons
    if (x < -15) {
      return Math.sin(x * 0.1) * 3.5 + Math.cos(z * 0.06) * 2.5;
    }

    // 4. Void Spire Arena (South: z > 25) -> Sunken crater
    if (z > 25) {
      const bossDist = Math.hypot(x, z - 65);
      if (bossDist < 32) {
        return Math.sin(bossDist * 0.2) * 1.8 - 1.0;
      }
      return Math.sin(x * 0.05) * 2.2;
    }

    // Transition zones
    return Math.sin(x * 0.06) * Math.cos(z * 0.06) * 1.2;
  }

  /**
   * Computes the 3D surface normal using finite-difference gradient:
   * df/dx and df/dz over an infinitesimal step eps.
   */
  public getNormal(x: number, z: number, eps: number = 0.2): THREE.Vector3 {
    const hL = this.getHeight(x - eps, z);
    const hR = this.getHeight(x + eps, z);
    const hD = this.getHeight(x, z - eps);
    const hU = this.getHeight(x, z + eps);

    const dfdx = (hR - hL) / (2 * eps);
    const dfdz = (hU - hD) / (2 * eps);

    // Normal = normalize(-df/dx, 1, -df/dz)
    const normal = new THREE.Vector3(-dfdx, 1.0, -dfdz).normalize();
    return normal;
  }

  /**
   * Computes comprehensive terrain sampling at (x, z) including pitch & roll relative to heading.
   */
  public sample(x: number, z: number, facingAngle: number = 0): TerrainSample {
    const height = this.getHeight(x, z);
    const normal = this.getNormal(x, z);

    // Slope angle relative to vertical up (0 deg = flat, 90 deg = vertical cliff)
    const slopeAngleDeg = Math.acos(Math.max(-1, Math.min(1, normal.y))) * (180 / Math.PI);

    // Heading forward vector
    const forwardX = Math.sin(facingAngle);
    const forwardZ = Math.cos(facingAngle);

    // Right vector
    const rightX = Math.cos(facingAngle);
    const rightZ = -Math.sin(facingAngle);

    // Directional slopes along heading and right
    const forwardSlope = normal.x * forwardX + normal.z * forwardZ;
    const sideSlope = normal.x * rightX + normal.z * rightZ;

    // Pitch tilts along the heading (positive = uphill)
    const pitchAngleRad = Math.atan2(forwardSlope, normal.y);
    // Roll tilts along the sides
    const rollAngleRad = Math.atan2(sideSlope, normal.y);

    return {
      height,
      normal,
      slopeAngleDeg,
      pitchAngleRad,
      rollAngleRad,
    };
  }

  /**
   * Barycentric interpolation across a triangle (p1, p2, p3) for arbitrary meshes.
   */
  public interpolateTriangle(
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    p3: THREE.Vector3,
    p: { x: number; z: number }
  ): number {
    const det = (p2.z - p3.z) * (p1.x - p3.x) + (p3.x - p2.x) * (p1.z - p3.z);
    if (Math.abs(det) < 1e-6) return p1.y;

    const l1 = ((p2.z - p3.z) * (p.x - p3.x) + (p3.x - p2.x) * (p.z - p3.z)) / det;
    const l2 = ((p3.z - p1.z) * (p.x - p3.x) + (p1.x - p3.x) * (p.z - p3.z)) / det;
    const l3 = 1.0 - l1 - l2;

    return l1 * p1.y + l2 * p2.y + l3 * p3.y;
  }
}

export const terrainBarycentric = TerrainBarycentric.getInstance();
