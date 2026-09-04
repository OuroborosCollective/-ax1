/**
 * Echoes of Aurion - Mob Finite State Machine (MobFSM)
 * Deterministic behavioral state machine managing:
 * - IDLE: Guarding area, scanning perception cone and threat table
 * - PATROLLING: Following deterministic anchor loops with collision sliding
 * - COMBAT: A* pathfinding towards target, melee/ranged lunges, boss AoE telegraphing
 * - FLEEING: Low-HP panic retreat vector away from threat
 * - EVADING: Leash-broken state, invulnerable health regeneration, direct return to spawn
 * - DEAD: Death animation, loot distribution, respawn scheduling
 */

import * as THREE from 'three';
import { EntityFsmState, WorldMobEntity } from '../../types';
import { EntityStateMachine, IState } from './EntityStateMachine';
import { threatMatrix } from '../combat/ThreatMatrix';
import { navGrid, Waypoint } from '../pathfinding/NavGrid';
import { collisionSystem } from '../../world/WorldCollisionSystem';

export interface MobVisualReference {
  entity: WorldMobEntity;
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  headMesh?: THREE.Mesh;
  weapons?: THREE.Mesh[];
  healthBarMesh: THREE.Mesh;
  telegraphRing?: THREE.Mesh;
  deathAnimTimer?: number;
  currentPath?: Waypoint[];
  lastPathCalcTime?: number;
  fsm?: EntityStateMachine<MobFsmContext>;
}

export interface MobFsmContext {
  mob: WorldMobEntity;
  visual: MobVisualReference;
  playerX: number;
  playerZ: number;
  delta: number;
  onMobAttack?: (mob: WorldMobEntity, dmg: number) => void;
  scene: THREE.Scene;
  onMobRespawnRequested?: (mob: WorldMobEntity) => void;
}

// === 1. IDLE STATE ===
export class MobIdleState implements IState<MobFsmContext> {
  readonly id: EntityFsmState = 'idle';
  private idleTimer: number = 0;
  private maxIdleDuration: number = 3.5;

  enter(ctx: MobFsmContext): void {
    ctx.mob.fsmState = 'idle';
    ctx.mob.isAggroed = false;
    this.idleTimer = 0;
    this.maxIdleDuration = 2.0 + Math.random() * 3.0;
  }

  update(ctx: MobFsmContext, delta: number): void {
    this.idleTimer += delta;

    // Subtle breathing / idle sway
    const sway = Math.sin(this.idleTimer * 2.5) * 0.04;
    ctx.visual.bodyMesh.position.y = sway;

    // Check threat or player proximity
    const distToPlayer = Math.hypot(ctx.playerX - ctx.mob.x, ctx.playerZ - ctx.mob.z);
    const aggroThreshold = ctx.mob.isBoss ? 28.0 : ctx.mob.isElite ? 22.0 : 16.0;
    const leashStatus = threatMatrix.checkLeashAndDecay(ctx.mob.id, ctx.mob.x, ctx.mob.z);

    if (distToPlayer <= aggroThreshold || leashStatus.targetId) {
      ctx.visual.fsm?.setState('combat', ctx);
      return;
    }

    // Switch to patrol after idle duration
    if (this.idleTimer >= this.maxIdleDuration) {
      ctx.visual.fsm?.setState('patrolling', ctx);
    }
  }

  exit(ctx: MobFsmContext): void {
    ctx.visual.bodyMesh.position.y = 0;
  }
}

// === 2. PATROLLING STATE ===
export class MobPatrollingState implements IState<MobFsmContext> {
  readonly id: EntityFsmState = 'patrolling';

  enter(ctx: MobFsmContext): void {
    ctx.mob.fsmState = 'patrolling';
    ctx.mob.isAggroed = false;
  }

  update(ctx: MobFsmContext, delta: number): void {
    const mob = ctx.mob;
    const visual = ctx.visual;

    // Check threat or player proximity
    const distToPlayer = Math.hypot(ctx.playerX - mob.x, ctx.playerZ - mob.z);
    const aggroThreshold = mob.isBoss ? 28.0 : mob.isElite ? 22.0 : 16.0;
    const leashStatus = threatMatrix.checkLeashAndDecay(mob.id, mob.x, mob.z);

    if (distToPlayer <= aggroThreshold || leashStatus.targetId) {
      visual.fsm?.setState('combat', ctx);
      return;
    }

    // Deterministic circular patrol around spawn anchor
    mob.patrolAngle += delta * 0.45;
    const patrolRadius = mob.isBoss ? 3.5 : 6.5;
    const patrolTargetX = mob.spawnX + Math.cos(mob.patrolAngle) * patrolRadius;
    const patrolTargetZ = mob.spawnZ + Math.sin(mob.patrolAngle) * patrolRadius;

    const dispX = (patrolTargetX - mob.x) * delta * 0.85;
    const dispZ = (patrolTargetZ - mob.z) * delta * 0.85;
    const resolved = collisionSystem.resolveMovement({ x: mob.x, z: mob.z }, { x: dispX, z: dispZ }, mob.radius);
    mob.x = resolved.newPos.x;
    mob.z = resolved.newPos.z;

    visual.group.rotation.y = mob.patrolAngle + Math.PI / 2;
  }

  exit(_ctx: MobFsmContext): void {}
}

// === 3. COMBAT STATE ===
export class MobCombatState implements IState<MobFsmContext> {
  readonly id: EntityFsmState = 'combat';

  enter(ctx: MobFsmContext): void {
    ctx.mob.fsmState = 'combat';
    ctx.mob.isAggroed = true;
  }

  update(ctx: MobFsmContext, delta: number): void {
    const mob = ctx.mob;
    const visual = ctx.visual;

    // 1. Leash check: If mob ventured too far from spawn, trigger Evade
    const leashStatus = threatMatrix.checkLeashAndDecay(mob.id, mob.x, mob.z);
    if (leashStatus.isEvading) {
      visual.fsm?.setState('evading', ctx);
      return;
    }

    // 2. Low-health Panic Check: regular mobs with < 15% HP flee
    if (!mob.isBoss && !mob.isElite && mob.hp < mob.maxHp * 0.15 && mob.hp > 0) {
      visual.fsm?.setState('fleeing', ctx);
      return;
    }

    // 3. Distance & Aggro drop-off
    const distToPlayer = Math.hypot(ctx.playerX - mob.x, ctx.playerZ - mob.z);
    const aggroThreshold = mob.isBoss ? 28.0 : mob.isElite ? 22.0 : 16.0;
    if (distToPlayer > aggroThreshold * 1.9 && !leashStatus.targetId) {
      visual.fsm?.setState('evading', ctx);
      return;
    }

    // 4. A* Pathfinding towards Target
    const now = performance.now();
    if (!visual.currentPath || !visual.lastPathCalcTime || now - visual.lastPathCalcTime > 320) {
      visual.currentPath = navGrid.findPath(mob.x, mob.z, ctx.playerX, ctx.playerZ, 32.0);
      visual.lastPathCalcTime = now;
    }

    let targetX = ctx.playerX;
    let targetZ = ctx.playerZ;
    if (visual.currentPath && visual.currentPath.length > 0) {
      const wp = visual.currentPath[0];
      const distToWp = Math.hypot(wp.x - mob.x, wp.z - mob.z);
      if (distToWp < 1.2 && visual.currentPath.length > 1) {
        visual.currentPath.shift();
      }
      if (visual.currentPath[0]) {
        targetX = visual.currentPath[0].x;
        targetZ = visual.currentPath[0].z;
      }
    }

    const angleToTarget = Math.atan2(targetX - mob.x, targetZ - mob.z);
    visual.group.rotation.y = angleToTarget;

    // Movement or Attack Action
    if (distToPlayer > mob.attackRange) {
      const moveSpeed = (mob.isBoss ? 5.5 : 4.5) * delta;
      const dispX = Math.sin(angleToTarget) * moveSpeed;
      const dispZ = Math.cos(angleToTarget) * moveSpeed;
      const resolved = collisionSystem.resolveMovement({ x: mob.x, z: mob.z }, { x: dispX, z: dispZ }, mob.radius);
      mob.x = resolved.newPos.x;
      mob.z = resolved.newPos.z;
    } else {
      // In Attack Range: Cooldown Tick
      mob.attackCooldown -= delta;
      if (mob.attackCooldown <= 0) {
        mob.attackCooldown = mob.maxAttackCooldown;
        ctx.onMobAttack?.(mob, mob.damage);

        // Visual strike lunge
        visual.bodyMesh.position.z = 0.8;
        setTimeout(() => {
          if (visual.bodyMesh) visual.bodyMesh.position.z = 0;
        }, 180);
      }
    }

    // Boss telegraphed AoE Nova attack
    if (mob.isBoss && visual.telegraphRing) {
      mob.castProgress = ((mob.castProgress || 0) + delta * 0.4) % 1.0;
      (visual.telegraphRing.material as THREE.MeshBasicMaterial).opacity = Math.sin(mob.castProgress * Math.PI) * 0.8;
      visual.telegraphRing.rotation.z += delta * 1.5;

      if (mob.castProgress > 0.95 && distToPlayer <= 9.0) {
        ctx.onMobAttack?.(mob, 160);
      }
    }
  }

  exit(_ctx: MobFsmContext): void {}
}

// === 4. FLEEING STATE ===
export class MobFleeingState implements IState<MobFsmContext> {
  readonly id: EntityFsmState = 'fleeing';
  private fleeTimer: number = 0;
  private readonly maxFleeDuration: number = 4.5;

  enter(ctx: MobFsmContext): void {
    ctx.mob.fsmState = 'fleeing';
    this.fleeTimer = 0;
  }

  update(ctx: MobFsmContext, delta: number): void {
    this.fleeTimer += delta;
    const mob = ctx.mob;
    const visual = ctx.visual;

    // Flee away from player vector
    const angleAwayFromPlayer = Math.atan2(mob.x - ctx.playerX, mob.z - ctx.playerZ);
    visual.group.rotation.y = angleAwayFromPlayer;

    const fleeSpeed = 6.2 * delta; // Faster sprint during panic
    const dispX = Math.sin(angleAwayFromPlayer) * fleeSpeed;
    const dispZ = Math.cos(angleAwayFromPlayer) * fleeSpeed;

    const resolved = collisionSystem.resolveMovement({ x: mob.x, z: mob.z }, { x: dispX, z: dispZ }, mob.radius);
    mob.x = resolved.newPos.x;
    mob.z = resolved.newPos.z;

    // If flee time elapsed or mob hit a dead end, resume combat or evade
    if (this.fleeTimer >= this.maxFleeDuration) {
      visual.fsm?.setState('combat', ctx);
    }
  }

  exit(_ctx: MobFsmContext): void {}
}

// === 5. EVADING STATE ===
export class MobEvadingState implements IState<MobFsmContext> {
  readonly id: EntityFsmState = 'evading';

  enter(ctx: MobFsmContext): void {
    ctx.mob.fsmState = 'evading';
    ctx.mob.isAggroed = false;
  }

  update(ctx: MobFsmContext, delta: number): void {
    const mob = ctx.mob;
    const visual = ctx.visual;

    // Rapid health regeneration while evading
    mob.hp = Math.min(mob.maxHp, mob.hp + mob.maxHp * delta * 0.22);

    const distToSpawn = Math.hypot(mob.spawnX - mob.x, mob.spawnZ - mob.z);
    if (distToSpawn <= 1.2) {
      // Reached spawn anchor -> return to idle
      mob.hp = mob.maxHp;
      visual.fsm?.setState('idle', ctx);
      return;
    }

    const angleToSpawn = Math.atan2(mob.spawnX - mob.x, mob.spawnZ - mob.z);
    visual.group.rotation.y = angleToSpawn;

    const evadeSpeed = 7.5 * delta;
    const dispX = Math.sin(angleToSpawn) * evadeSpeed;
    const dispZ = Math.cos(angleToSpawn) * evadeSpeed;

    const resolved = collisionSystem.resolveMovement({ x: mob.x, z: mob.z }, { x: dispX, z: dispZ }, mob.radius);
    mob.x = resolved.newPos.x;
    mob.z = resolved.newPos.z;
  }

  exit(_ctx: MobFsmContext): void {}
}

// === 6. DEAD STATE ===
export class MobDeadState implements IState<MobFsmContext> {
  readonly id: EntityFsmState = 'dead';
  private deathTimer: number = 2.0;

  enter(ctx: MobFsmContext): void {
    ctx.mob.fsmState = 'dead';
    this.deathTimer = 2.0;
  }

  update(ctx: MobFsmContext, delta: number): void {
    this.deathTimer -= delta;
    const visual = ctx.visual;

    // Shrink and sink mesh during death transition
    visual.group.scale.multiplyScalar(0.92);
    visual.group.position.y -= delta * 1.4;

    if (this.deathTimer <= 0) {
      ctx.scene.remove(visual.group);
      if (!ctx.mob.isBoss) {
        ctx.onMobRespawnRequested?.(ctx.mob);
      }
    }
  }

  exit(_ctx: MobFsmContext): void {}
}

/**
 * Creates and initializes a formal Deterministic FSM for a mob entity.
 */
export function createMobStateMachine(visual: MobVisualReference): EntityStateMachine<MobFsmContext> {
  const fsm = new EntityStateMachine<MobFsmContext>(visual.entity.id);

  fsm.registerState(new MobIdleState())
    .registerState(new MobPatrollingState())
    .registerState(new MobCombatState())
    .registerState(new MobFleeingState())
    .registerState(new MobEvadingState())
    .registerState(new MobDeadState());

  // Global transitions: if HP <= 0, always transition to Dead
  fsm.addTransition('*', 'dead', (ctx) => ctx.mob.hp <= 0);

  // Set initial state
  fsm.setState('idle', {
    mob: visual.entity,
    visual,
    playerX: visual.entity.x,
    playerZ: visual.entity.z,
    delta: 0,
    scene: null as any,
  });

  return fsm;
}
