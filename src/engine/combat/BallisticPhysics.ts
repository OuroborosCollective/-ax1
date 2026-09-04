/**
 * BallisticPhysics.ts
 *
 * Implements real physical parabolic projectile ballistics with gravity,
 * aerodynamic drag, terrain altitude collision, and area-of-effect splash.
 *
 * Trajectory:
 * a = g + F_drag / mass
 * v(t + dt) = v(t) + a * dt
 * x(t + dt) = x(t) + v(t) * dt
 */

import * as THREE from 'three';
import { terrainBarycentric } from '../../world/TerrainBarycentric';
import { collisionSystem } from '../../world/WorldCollisionSystem';

export interface BallisticProjectile {
  id: string;
  casterId: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  gravity: number; // e.g. -14.0 m/s^2 for punchy game feel
  drag: number;    // air resistance coefficient
  radius: number;  // projectile hitbox radius
  damage: number;
  splashRadius: number; // 0 for single-target, > 0 for AoE explosion
  color: number;
  mesh: THREE.Mesh;
  trailParticles?: THREE.Points;
  age: number;
  maxLifeTime: number;
  onImpact?: (hitPoint: THREE.Vector3, splashRadius: number, damage: number) => void;
}

export class BallisticSimulationSystem {
  public projectiles: BallisticProjectile[] = [];
  public scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Launch a ballistic projectile with initial velocity vector.
   */
  public launch(
    casterId: string,
    origin: THREE.Vector3,
    target: THREE.Vector3,
    speed: number = 28.0,
    arcHeight: number = 3.5,
    damage: number = 85,
    splashRadius: number = 4.0,
    color: number = 0x00f0ff,
    onImpact?: (hitPoint: THREE.Vector3, splashRadius: number, damage: number) => void
  ): BallisticProjectile {
    const id = `proj_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Create 3D projectile visual mesh
    const geo = new THREE.SphereGeometry(0.28, 8, 8);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.8,
      roughness: 0.2,
      metalness: 0.8,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin);
    this.scene.add(mesh);

    // Compute ballistic launch velocity vector to reach target point
    const dx = target.x - origin.x;
    const dz = target.z - origin.z;
    const horizDist = Math.hypot(dx, dz);
    const timeToTarget = Math.max(0.2, horizDist / speed);

    const grav = -16.0;
    // v0y * t + 0.5 * g * t^2 = dy => v0y = (dy - 0.5 * g * t^2) / t
    const dy = target.y - origin.y;
    const vy = (dy - 0.5 * grav * (timeToTarget * timeToTarget)) / timeToTarget + (arcHeight / timeToTarget);
    const vx = (dx / timeToTarget);
    const vz = (dz / timeToTarget);

    const projectile: BallisticProjectile = {
      id,
      casterId,
      position: origin.clone(),
      velocity: new THREE.Vector3(vx, vy, vz),
      gravity: grav,
      drag: 0.02,
      radius: 0.35,
      damage,
      splashRadius,
      color,
      mesh,
      age: 0,
      maxLifeTime: timeToTarget + 1.5,
      onImpact,
    };

    this.projectiles.push(projectile);
    return projectile;
  }

  /**
   * Updates physical integration for all active projectiles.
   */
  public update(delta: number): void {
    const remaining: BallisticProjectile[] = [];

    for (const p of this.projectiles) {
      p.age += delta;

      // 1. Aerodynamic drag force F_drag = -drag * |v| * v
      const speed = p.velocity.length();
      const dragFactor = Math.max(0, 1.0 - p.drag * speed * delta);
      p.velocity.multiplyScalar(dragFactor);

      // 2. Gravitational acceleration
      p.velocity.y += p.gravity * delta;

      // 3. Position step
      const step = p.velocity.clone().multiplyScalar(delta);
      const nextPos = p.position.clone().add(step);

      // 4. Terrain ground collision check
      const groundY = terrainBarycentric.getHeight(nextPos.x, nextPos.z);
      const hitGround = nextPos.y <= groundY + p.radius;

      // 5. Solid obstacle collision check
      const nearbyObstacles = collisionSystem.getNearbyObstacles(nextPos.x, nextPos.z, 2.0);
      let hitObstacle = false;
      for (const obs of nearbyObstacles) {
        const d = Math.hypot(nextPos.x - obs.x, nextPos.z - obs.z);
        if (d <= obs.radius + p.radius && nextPos.y <= (obs.height || 4.0)) {
          hitObstacle = true;
          break;
        }
      }

      if (hitGround || hitObstacle || p.age >= p.maxLifeTime) {
        // Impact event
        const impactPoint = nextPos.clone();
        if (hitGround) impactPoint.y = groundY;

        p.onImpact?.(impactPoint, p.splashRadius, p.damage);

        // Spawn brief impact flash
        this.spawnImpactFlash(impactPoint, p.color);

        // Remove 3D mesh
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
      } else {
        p.position.copy(nextPos);
        p.mesh.position.copy(p.position);
        remaining.push(p);
      }
    }

    this.projectiles = remaining;
  }

  private spawnImpactFlash(pos: THREE.Vector3, color: number): void {
    const flashGeo = new THREE.RingGeometry(0.1, 1.8, 16);
    flashGeo.rotateX(-Math.PI / 2);
    const flashMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.set(pos.x, pos.y + 0.05, pos.z);
    this.scene.add(flash);

    let life = 0.3;
    const interval = setInterval(() => {
      life -= 0.05;
      flash.scale.multiplyScalar(1.2);
      flashMat.opacity = Math.max(0, life / 0.3);
      if (life <= 0) {
        clearInterval(interval);
        this.scene.remove(flash);
        flashGeo.dispose();
        flashMat.dispose();
      }
    }, 50);
  }

  public dispose(): void {
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
    }
    this.projectiles = [];
  }
}
