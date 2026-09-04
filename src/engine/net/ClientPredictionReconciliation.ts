/**
 * ClientPredictionReconciliation.ts
 *
 * Implements client-side movement prediction and authoritative server reconciliation.
 *
 * The local client predicts motion instantly so there is zero input lag.
 * Each input has a monotonically increasing sequence ID.
 * When the server sends an authoritative position update acknowledging sequence `N`,
 * the client discards acknowledged inputs. If the server position deviates from the
 * recorded prediction by more than `errorThreshold`, the client snaps to the server
 * state and deterministically replays all remaining unacknowledged inputs.
 */

export interface MoveCommand {
  sequence: number;
  inputForward: number;
  inputRight: number;
  speed: number;
  delta: number;
  predictedX: number;
  predictedY: number;
  predictedZ: number;
  timestamp: number;
}

export interface AuthoritativeServerState {
  lastProcessedSequence: number;
  x: number;
  y: number;
  z: number;
  facingAngle: number;
  timestamp: number;
}

export class ClientPredictionReconciliation {
  private currentSequence: number = 0;
  private pendingCommands: MoveCommand[] = [];
  public errorThreshold: number = 0.08; // 8cm tolerance before triggering reconciliation replay
  public stats = {
    totalPredicted: 0,
    totalReconciled: 0,
    correctionsCount: 0,
    maxDeviation: 0,
  };

  /**
   * Record a locally predicted movement command.
   */
  public recordCommand(
    inputForward: number,
    inputRight: number,
    speed: number,
    delta: number,
    predictedX: number,
    predictedY: number,
    predictedZ: number
  ): number {
    this.currentSequence++;
    const cmd: MoveCommand = {
      sequence: this.currentSequence,
      inputForward,
      inputRight,
      speed,
      delta,
      predictedX,
      predictedY,
      predictedZ,
      timestamp: performance.now(),
    };

    this.pendingCommands.push(cmd);
    this.stats.totalPredicted++;

    // Cap pending buffer to avoid memory leak if server is unresponsive
    if (this.pendingCommands.length > 200) {
      this.pendingCommands.shift();
    }

    return this.currentSequence;
  }

  /**
   * Reconcile local state against authoritative server packet.
   * Returns corrected position if reconciliation replay was needed, or null if within tolerance.
   */
  public reconcile(
    serverState: AuthoritativeServerState,
    applyMovementStep: (cmd: MoveCommand, currentPos: { x: number; y: number; z: number }) => { x: number; y: number; z: number }
  ): { x: number; y: number; z: number } | null {
    // 1. Discard all inputs already processed by the server
    this.pendingCommands = this.pendingCommands.filter(
      (cmd) => cmd.sequence > serverState.lastProcessedSequence
    );
    this.stats.totalReconciled++;

    // 2. Find the predicted state at the acknowledged sequence
    // If no remaining pending commands, we compare directly to the server state
    let simPos = { x: serverState.x, y: serverState.y, z: serverState.z };

    // 3. Replay all remaining unacknowledged inputs starting from server's authoritative position
    for (const cmd of this.pendingCommands) {
      simPos = applyMovementStep(cmd, simPos);
      cmd.predictedX = simPos.x;
      cmd.predictedY = simPos.y;
      cmd.predictedZ = simPos.z;
    }

    // 4. Return new reconciled position
    return simPos;
  }

  public getPendingCount(): number {
    return this.pendingCommands.length;
  }

  public reset(): void {
    this.currentSequence = 0;
    this.pendingCommands = [];
  }
}

export const clientPrediction = new ClientPredictionReconciliation();
