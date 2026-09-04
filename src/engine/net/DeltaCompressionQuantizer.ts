/**
 * DeltaCompressionQuantizer.ts
 *
 * Network Optimization & State Compression Layer for Echoes of Aurion:
 * - Fixed-Point Quantization: Converts IEEE-754 floats to 16-bit / 32-bit signed integers to save bandwidth and eliminate floating point nondeterminism.
 * - Bitmask Delta Compression: Omits unchanged state properties using bitflag field masks.
 * - Area of Interest (AoI) Spatial Hashing: Culls synchronization packets for entities outside of player perceptual radius (60m).
 */

export interface RawEntityState {
  id: string | number;
  x: number;
  y: number;
  z: number;
  rotY: number;
  hp: number;
  maxHp: number;
  stateId: number;
  inventoryCount: number;
  gold: number;
}

export const STATE_FLAGS = {
  NONE: 0,
  POS_X: 1 << 0,
  POS_Y: 1 << 1,
  POS_Z: 1 << 2,
  ROT_Y: 1 << 3,
  HP: 1 << 4,
  STATE_ID: 1 << 5,
  INVENTORY: 1 << 6,
  GOLD: 1 << 7,
};

export class DeltaCompressionQuantizer {
  // Quantization scales
  private static readonly COORD_SCALE = 100.0;   // 0.01m precision (centimeter)
  private static readonly ROT_SCALE = 1000.0;    // 0.001 rad precision
  private static readonly HP_SCALE = 10.0;       // 0.1 hp precision

  /**
   * Quantizes float coordinate to signed 32-bit fixed point integer
   */
  public static quantizeCoord(val: number): number {
    return Math.round(val * this.COORD_SCALE);
  }

  public static dequantizeCoord(val: number): number {
    return val / this.COORD_SCALE;
  }

  /**
   * Quantizes rotation angle to 16-bit integer [-3141, 3141]
   */
  public static quantizeAngle(val: number): number {
    return Math.round(val * this.ROT_SCALE);
  }

  public static dequantizeAngle(val: number): number {
    return val / this.ROT_SCALE;
  }

  /**
   * Encodes a delta-compressed packet comparing current state against last acknowledged baseline state.
   */
  public static encodeDelta(
    current: RawEntityState,
    baseline?: RawEntityState
  ): { mask: number; payload: Record<string, number> } {
    let mask = 0;
    const payload: Record<string, number> = {};

    if (!baseline) {
      // Full Keyframe
      mask = 0xFF;
      payload.x = this.quantizeCoord(current.x);
      payload.y = this.quantizeCoord(current.y);
      payload.z = this.quantizeCoord(current.z);
      payload.rotY = this.quantizeAngle(current.rotY);
      payload.hp = Math.round(current.hp * this.HP_SCALE);
      payload.stateId = current.stateId;
      payload.inventoryCount = current.inventoryCount;
      payload.gold = current.gold;
      return { mask, payload };
    }

    // Delta check
    const qCurX = this.quantizeCoord(current.x);
    const qBaseX = this.quantizeCoord(baseline.x);
    if (qCurX !== qBaseX) {
      mask |= STATE_FLAGS.POS_X;
      payload.x = qCurX;
    }

    const qCurY = this.quantizeCoord(current.y);
    const qBaseY = this.quantizeCoord(baseline.y);
    if (qCurY !== qBaseY) {
      mask |= STATE_FLAGS.POS_Y;
      payload.y = qCurY;
    }

    const qCurZ = this.quantizeCoord(current.z);
    const qBaseZ = this.quantizeCoord(baseline.z);
    if (qCurZ !== qBaseZ) {
      mask |= STATE_FLAGS.POS_Z;
      payload.z = qCurZ;
    }

    const qCurRot = this.quantizeAngle(current.rotY);
    const qBaseRot = this.quantizeAngle(baseline.rotY);
    if (qCurRot !== qBaseRot) {
      mask |= STATE_FLAGS.ROT_Y;
      payload.rotY = qCurRot;
    }

    if (Math.round(current.hp * this.HP_SCALE) !== Math.round(baseline.hp * this.HP_SCALE)) {
      mask |= STATE_FLAGS.HP;
      payload.hp = Math.round(current.hp * this.HP_SCALE);
    }

    if (current.stateId !== baseline.stateId) {
      mask |= STATE_FLAGS.STATE_ID;
      payload.stateId = current.stateId;
    }

    if (current.inventoryCount !== baseline.inventoryCount) {
      mask |= STATE_FLAGS.INVENTORY;
      payload.inventoryCount = current.inventoryCount;
    }

    if (current.gold !== baseline.gold) {
      mask |= STATE_FLAGS.GOLD;
      payload.gold = current.gold;
    }

    return { mask, payload };
  }

  /**
   * Applies delta payload onto an existing baseline state
   */
  public static decodeDelta(
    baseline: RawEntityState,
    mask: number,
    payload: Record<string, number>
  ): RawEntityState {
    const next: RawEntityState = { ...baseline };

    if (mask & STATE_FLAGS.POS_X && payload.x !== undefined) {
      next.x = this.dequantizeCoord(payload.x);
    }
    if (mask & STATE_FLAGS.POS_Y && payload.y !== undefined) {
      next.y = this.dequantizeCoord(payload.y);
    }
    if (mask & STATE_FLAGS.POS_Z && payload.z !== undefined) {
      next.z = this.dequantizeCoord(payload.z);
    }
    if (mask & STATE_FLAGS.ROT_Y && payload.rotY !== undefined) {
      next.rotY = this.dequantizeAngle(payload.rotY);
    }
    if (mask & STATE_FLAGS.HP && payload.hp !== undefined) {
      next.hp = payload.hp / this.HP_SCALE;
    }
    if (mask & STATE_FLAGS.STATE_ID && payload.stateId !== undefined) {
      next.stateId = payload.stateId;
    }
    if (mask & STATE_FLAGS.INVENTORY && payload.inventoryCount !== undefined) {
      next.inventoryCount = payload.inventoryCount;
    }
    if (mask & STATE_FLAGS.GOLD && payload.gold !== undefined) {
      next.gold = payload.gold;
    }

    return next;
  }

  /**
   * Area of Interest (AoI) Spatial Filter:
   * Returns true if entity is within perceptual awareness radius (e.g. 60m).
   */
  public static isInAreaOfInterest(
    observerX: number,
    observerZ: number,
    targetX: number,
    targetZ: number,
    maxRadius: number = 60.0
  ): boolean {
    const dx = observerX - targetX;
    const dz = observerZ - targetZ;
    return dx * dx + dz * dz <= maxRadius * maxRadius;
  }
}
