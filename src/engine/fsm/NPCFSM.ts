/**
 * Echoes of Aurion - NPC Finite State Machine (NPCFSM)
 * Deterministic behavioral state machine managing friendly world NPCs:
 * - IDLE: Stationed at landmark, breathing sway, orienting gaze toward nearby players
 * - PATROLLING: Roaming between city markers for wandering town guards/artisan vendors
 * - INTERACTING: In active dialogue, shop, or territorial politics negotiation with player
 * - ALERT: Hostile creatures detected in city sanctuary, warning players and raising shields
 */

import * as THREE from 'three';
import { NPCCharacter, NPCFsmState } from '../../types';
import { EntityStateMachine, IState } from './EntityStateMachine';

export interface NPCVisualReference {
  npc: NPCCharacter;
  group: THREE.Group;
  markerMesh?: THREE.Mesh;
  fsm?: EntityStateMachine<NPCFsmContext>;
}

export interface NPCFsmContext {
  npc: NPCCharacter;
  visual: NPCVisualReference;
  playerX: number;
  playerZ: number;
  delta: number;
  isInteracting: boolean;
  nearbyThreat: boolean;
}

// === 1. NPC IDLE STATE ===
export class NPCIdleState implements IState<NPCFsmContext> {
  readonly id: NPCFsmState = 'idle';
  private swayTimer: number = 0;

  enter(ctx: NPCFsmContext): void {
    ctx.npc.fsmState = 'idle';
    this.swayTimer = 0;
  }

  update(ctx: NPCFsmContext, delta: number): void {
    this.swayTimer += delta;

    // Subtle gentle breathing
    if (ctx.visual.markerMesh) {
      ctx.visual.markerMesh.rotation.y += delta * 1.2;
      ctx.visual.markerMesh.position.y = 3.2 + Math.sin(this.swayTimer * 2.0) * 0.15;
    }

    // Check interaction or alert
    if (ctx.isInteracting) {
      ctx.visual.fsm?.setState('interacting', ctx);
      return;
    }
    if (ctx.nearbyThreat) {
      ctx.visual.fsm?.setState('alert', ctx);
      return;
    }

    // Face player if player is within 6m
    const distToPlayer = Math.hypot(ctx.playerX - ctx.npc.x, ctx.playerZ - ctx.npc.z);
    if (distToPlayer <= 6.5) {
      const targetAngle = Math.atan2(ctx.playerX - ctx.npc.x, ctx.playerZ - ctx.npc.z);
      // Smoothly rotate towards player
      ctx.visual.group.rotation.y = THREE.MathUtils.lerp(ctx.visual.group.rotation.y, targetAngle, delta * 3.5);
    }
  }

  exit(_ctx: NPCFsmContext): void {}
}

// === 2. NPC INTERACTING STATE ===
export class NPCInteractingState implements IState<NPCFsmContext> {
  readonly id: NPCFsmState = 'interacting';

  enter(ctx: NPCFsmContext): void {
    ctx.npc.fsmState = 'interacting';
  }

  update(ctx: NPCFsmContext, delta: number): void {
    if (!ctx.isInteracting) {
      ctx.visual.fsm?.setState('idle', ctx);
      return;
    }

    // Lock gaze directly onto player while conversing
    const targetAngle = Math.atan2(ctx.playerX - ctx.npc.x, ctx.playerZ - ctx.npc.z);
    ctx.visual.group.rotation.y = THREE.MathUtils.lerp(ctx.visual.group.rotation.y, targetAngle, delta * 6.0);

    // Pulse marker above head
    if (ctx.visual.markerMesh) {
      ctx.visual.markerMesh.rotation.y += delta * 3.0;
      ctx.visual.markerMesh.scale.setScalar(1.2 + Math.sin(performance.now() * 0.005) * 0.15);
    }
  }

  exit(ctx: NPCFsmContext): void {
    if (ctx.visual.markerMesh) {
      ctx.visual.markerMesh.scale.setScalar(1.0);
    }
  }
}

// === 3. NPC PATROLLING STATE ===
export class NPCPatrollingState implements IState<NPCFsmContext> {
  readonly id: NPCFsmState = 'patrolling';
  private patrolAngle: number = 0;

  enter(ctx: NPCFsmContext): void {
    ctx.npc.fsmState = 'patrolling';
  }

  update(ctx: NPCFsmContext, delta: number): void {
    if (ctx.isInteracting) {
      ctx.visual.fsm?.setState('interacting', ctx);
      return;
    }

    this.patrolAngle += delta * 0.3;
    const patrolRadius = 2.5;
    const targetX = ctx.npc.x + Math.cos(this.patrolAngle) * patrolRadius;
    const targetZ = ctx.npc.z + Math.sin(this.patrolAngle) * patrolRadius;

    ctx.visual.group.position.x = targetX;
    ctx.visual.group.position.z = targetZ;
    ctx.visual.group.rotation.y = this.patrolAngle + Math.PI / 2;
  }

  exit(_ctx: NPCFsmContext): void {}
}

// === 4. NPC ALERT STATE ===
export class NPCAlertState implements IState<NPCFsmContext> {
  readonly id: NPCFsmState = 'alert';
  private alertTimer: number = 0;

  enter(ctx: NPCFsmContext): void {
    ctx.npc.fsmState = 'alert';
    this.alertTimer = 0;
  }

  update(ctx: NPCFsmContext, delta: number): void {
    this.alertTimer += delta;

    if (!ctx.nearbyThreat && this.alertTimer > 3.0) {
      ctx.visual.fsm?.setState('idle', ctx);
      return;
    }

    // Rapid alert pulse
    if (ctx.visual.markerMesh) {
      ctx.visual.markerMesh.rotation.y += delta * 6.0;
    }
  }

  exit(_ctx: NPCFsmContext): void {}
}

/**
 * Creates and initializes a formal Deterministic FSM for a friendly NPC entity.
 */
export function createNPCStateMachine(visual: NPCVisualReference): EntityStateMachine<NPCFsmContext> {
  const fsm = new EntityStateMachine<NPCFsmContext>(visual.npc.id);

  fsm.registerState(new NPCIdleState())
    .registerState(new NPCInteractingState())
    .registerState(new NPCPatrollingState())
    .registerState(new NPCAlertState());

  fsm.setState('idle', {
    npc: visual.npc,
    visual,
    playerX: visual.npc.x,
    playerZ: visual.npc.z,
    delta: 0,
    isInteracting: false,
    nearbyThreat: false,
  });

  return fsm;
}
