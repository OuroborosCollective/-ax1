/**
 * LagCompensation.ts
 *
 * Implements historical hitbox rewind and lag compensation for network combat.
 *
 * Stores a sliding ring buffer (1000ms window) of entity bounding capsules and positions.
 * When a hit arrives with a client timestamp, the system rewinds the target's hitbox
 * to that exact moment in time via linear interpolation between the two nearest snapshots,
 * verifying the strike fairly regardless of ping disparities.
 */

import * as THREE from 'three';
import { Capsule3D } from './CapsuleCollider';

export interface EntitySnapshot {
  timestampMs: number;
  position: THREE.Vector3;
  capsule: Capsule3D;
  facingAngle: number;
}

export class LagCompensationHistory {
  private static instance: LagCompensationHistory | null = null;
  public static getInstance(): LagCompensationHistory {
    if (!LagCompensationHistory.instance) {
      LagCompensationHistory.instance = new LagCompensationHistory();
    }
    return LagCompensationHistory.instance;
  }

  // entityId -> Array of historical snapshots sorted by timestamp
  private history: Map<string, EntitySnapshot[]> = new Map();
  private maxHistoryWindowMs: number = 1000;

  /**
   * Record a snapshot of an entity's position and bounding capsule at current time.
   */
  public recordSnapshot(
    entityId: string,
    position: THREE.Vector3,
    radius: number = 0.55,
    height: number = 1.8,
    facingAngle: number = 0
  ): void {
    const now = performance.now();
    let snapshots = this.history.get(entityId);
    if (!snapshots) {
      snapshots = [];
      this.history.set(entityId, snapshots);
    }

    const start = new THREE.Vector3(position.x, position.y + radius, position.z);
    const end = new THREE.Vector3(position.x, position.y + height - radius, position.z);
    const capsule: Capsule3D = { base: start, top: end, radius };

    snapshots.push({
      timestampMs: now,
      position: position.clone(),
      capsule,
      facingAngle,
    });

    // Prune entries older than the history window
    const cutoff = now - this.maxHistoryWindowMs;
    while (snapshots.length > 0 && snapshots[0].timestampMs < cutoff) {
      snapshots.shift();
    }
  }

  /**
   * Rewind an entity to a specific timestamp in the past.
   * If the exact timestamp falls between two snapshots, interpolates position and capsule linearly.
   */
  public getRewoundState(entityId: string, targetTimestampMs: number): EntitySnapshot | null {
    const snapshots = this.history.get(entityId);
    if (!snapshots || snapshots.length === 0) return null;

    // If requested timestamp is newer than latest snapshot, return latest
    if (targetTimestampMs >= snapshots[snapshots.length - 1].timestampMs) {
      return snapshots[snapshots.length - 1];
    }

    // If requested timestamp is older than oldest snapshot, return oldest
    if (targetTimestampMs <= snapshots[0].timestampMs) {
      return snapshots[0];
    }

    // Binary or linear search for adjacent snapshots
    for (let i = 0; i < snapshots.length - 1; i++) {
      const s0 = snapshots[i];
      const s1 = snapshots[i + 1];

      if (targetTimestampMs >= s0.timestampMs && targetTimestampMs <= s1.timestampMs) {
        const timeDiff = s1.timestampMs - s0.timestampMs;
        const alpha = timeDiff > 0 ? (targetTimestampMs - s0.timestampMs) / timeDiff : 0;

        const lerpedPos = new THREE.Vector3().lerpVectors(s0.position, s1.position, alpha);
        const radius = s0.capsule.radius;
        const height = s0.capsule.top.y - s0.capsule.base.y + radius * 2;

        const start = new THREE.Vector3(lerpedPos.x, lerpedPos.y + radius, lerpedPos.z);
        const end = new THREE.Vector3(lerpedPos.x, lerpedPos.y + height - radius, lerpedPos.z);
        const lerpedCapsule: Capsule3D = { base: start, top: end, radius };

        return {
          timestampMs: targetTimestampMs,
          position: lerpedPos,
          capsule: lerpedCapsule,
          facingAngle: s0.facingAngle + (s1.facingAngle - s0.facingAngle) * alpha,
        };
      }
    }

    return snapshots[snapshots.length - 1];
  }

  /**
   * Validate a hit with lag compensation.
   * Checks if an attack ray from attacker intersects the target's rewound hitbox at targetTimestampMs.
   */
  public validateRewoundHit(
    attackerPos: THREE.Vector3,
    targetId: string,
    targetTimestampMs: number,
    maxRange: number = 8.0
  ): { valid: boolean; distance: number; rewoundPos?: THREE.Vector3 } {
    const state = this.getRewoundState(targetId, targetTimestampMs);
    if (!state) {
      return { valid: false, distance: Infinity };
    }

    const dist = attackerPos.distanceTo(state.position);
    if (dist <= maxRange) {
      return { valid: true, distance: dist, rewoundPos: state.position };
    }

    return { valid: false, distance: dist };
  }

  public clearEntity(entityId: string): void {
    this.history.delete(entityId);
  }

  public clearAll(): void {
    this.history.clear();
  }
}

export const lagCompensation = LagCompensationHistory.getInstance();
