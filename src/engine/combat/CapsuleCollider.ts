import * as THREE from 'three';

export interface Capsule3D {
  base: THREE.Vector3;
  top: THREE.Vector3;
  radius: number;
}

export interface Segment3D {
  p0: THREE.Vector3;
  p1: THREE.Vector3;
}

export interface HitResult {
  hit: boolean;
  distance: number;
  closestPointCapsule: THREE.Vector3;
  closestPointSegment: THREE.Vector3;
  isNearMiss: boolean;
  penetrationDepth: number;
}

/**
 * CapsuleCollider
 * Precise 3D Capsule collision math & Closest-Point-of-Approach (CPA)
 * between 3D character capsules and weapon / projectile trajectory segments.
 */
export class CapsuleCollider {
  /**
   * Computes closest points between two 3D line segments S1 and S2.
   * Based on robust geometric projection.
   */
  public static closestPointsBetweenSegments(
    s1: Segment3D,
    s2: Segment3D
  ): { p1: THREE.Vector3; p2: THREE.Vector3; distance: number } {
    const u = new THREE.Vector3().subVectors(s1.p1, s1.p0);
    const v = new THREE.Vector3().subVectors(s2.p1, s2.p0);
    const w = new THREE.Vector3().subVectors(s1.p0, s2.p0);

    const a = u.dot(u); // squared length of u
    const b = u.dot(v);
    const c = v.dot(v); // squared length of v
    const d = u.dot(w);
    const e = v.dot(w);
    const D = a * c - b * b; // determinant

    let sc: number;
    let sN: number, sD = D;
    let tc: number;
    let tN: number, tD = D;

    const EPSILON = 1e-6;

    if (D < EPSILON) {
      // Segments are parallel
      sN = 0.0;
      sD = 1.0;
      tN = e;
      tD = c;
    } else {
      sN = b * e - c * d;
      tN = a * e - b * d;

      if (sN < 0.0) {
        sN = 0.0;
        tN = e;
        tD = c;
      } else if (sN > sD) {
        sN = sD;
        tN = e + b;
        tD = c;
      }
    }

    if (tN < 0.0) {
      tc = 0.0;
      if (-d < 0.0) sc = 0.0;
      else if (-d > a) sc = 1.0;
      else sc = -d / a;
    } else if (tN > tD) {
      tc = 1.0;
      if (-d + b < 0.0) sc = 0.0;
      else if (-d + b > a) sc = 1.0;
      else sc = (-d + b) / a;
    } else {
      tc = tN / tD;
      sc = sN / sD;
    }

    const p1 = new THREE.Vector3().copy(s1.p0).addScaledVector(u, sc);
    const p2 = new THREE.Vector3().copy(s2.p0).addScaledVector(v, tc);
    const distance = p1.distanceTo(p2);

    return { p1, p2, distance };
  }

  /**
   * Tests a capsule against a 3D attack trajectory segment (e.g. arrow flight or melee sweep).
   */
  public static testCapsuleAgainstSegment(
    capsule: Capsule3D,
    segment: Segment3D,
    nearMissMargin: number = 1.35
  ): HitResult {
    const capsuleSegment: Segment3D = {
      p0: capsule.base,
      p1: capsule.top,
    };

    const { p1: pointOnCapsuleAxis, p2: pointOnAttack, distance } =
      this.closestPointsBetweenSegments(capsuleSegment, segment);

    const hit = distance <= capsule.radius;
    const isNearMiss = !hit && distance <= capsule.radius + nearMissMargin;
    const penetrationDepth = Math.max(0, capsule.radius - distance);

    return {
      hit,
      distance,
      closestPointCapsule: pointOnCapsuleAxis,
      closestPointSegment: pointOnAttack,
      isNearMiss,
      penetrationDepth,
    };
  }

  /**
   * Tests whether two 3D capsules intersect
   */
  public static testCapsuleCapsule(c1: Capsule3D, c2: Capsule3D): boolean {
    const seg1: Segment3D = { p0: c1.base, p1: c1.top };
    const seg2: Segment3D = { p0: c2.base, p1: c2.top };
    const { distance } = this.closestPointsBetweenSegments(seg1, seg2);
    return distance <= c1.radius + c2.radius;
  }
}
