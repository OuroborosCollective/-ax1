/**
 * HostProjectionPort.ts - AX1 Neutral Host Projection Port
 *
 * Spezifikation:
 * 1. Neutraler HostProjectionPort: bestätigte Daten hinein, reine Intents hinaus.
 *    Keine direkte Aurion-Abhängigkeit in AX1.
 * 2. Einheitliche Zustände für alle Oberflächen: 'loading' | 'confirmed' | 'stale' | 'unavailable'.
 *    Fehlende Werte sichtbar als '—', niemals durch Starterwerte ersetzen.
 * 3. Asynchrone Mutation-Callbacks mit 'pending', bestätigtem Receipt und anschließendem Readback
 *    für Equip, Crafting, Guild, Economy, Housing und Skills.
 * 4. Gemeinsamer Tickvertrag: 100 ms / 10 Hz aus exportierter Konstante.
 * 5. CanonicalIntent für sämtliche Eingaben: Actor, Action, Payload, Tick, sequenceOrder, ChunkKey.
 *    AX1 erzeugt nur den Intent, niemals selbst das Ergebnis.
 * 10. Keine lokalen Erfolgsnachrichten: erst "bestätigt", wenn Receipt und Readback zusammenpassen.
 */

import { sha256Hex, stableStringify, canonicalize } from '../engine/math/DeterministicHash';

// ============================================================================
// 4. Tickvertrag (100 ms / 10 Hz)
// ============================================================================
export const AX1_TICK_RATE_HZ = 10 as const;
export const AX1_TICK_INTERVAL_MS = 100 as const;

// ============================================================================
// 2. Einheitliche Oberflächen-Zustände & Datenumschlag (Data Envelope)
// ============================================================================
export type ProjectionStatus = 'loading' | 'confirmed' | 'stale' | 'unavailable';

export interface StateEnvelope<T> {
  readonly status: ProjectionStatus;
  readonly data: T | null;
  readonly confirmedTick: number | null;
  readonly receiptId: string | null;
  readonly lastUpdatedMs: number;
}

/**
 * Formatierungsregel für AX1:
 * Fehlende Werte MÜSSEN sichtbar als '—' dargestellt werden,
 * niemals stillschweigend durch Starterwerte (z. B. 0 Gold oder Level 1) ersetzt werden.
 */
export function formatProjectionValue<T>(
  value: T | null | undefined,
  formatter?: (val: T) => string
): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'string' && value.trim() === '') {
    return '—';
  }
  if (formatter) {
    return formatter(value);
  }
  return String(value);
}

// ============================================================================
// 5. CanonicalIntent Vertrag für AX1
// ============================================================================
export interface AX1CanonicalIntent<TAction extends string = string, TPayload = unknown> {
  readonly actorId: string;
  readonly action: TAction;
  readonly payload: TPayload;
  readonly tick: number;
  readonly sequenceOrder: number;
  readonly chunkKey: string;
  readonly intentHash: string;
  readonly clientTimestampMs: number;
}

export interface AX1IntentReceipt {
  readonly receiptId: string;
  readonly intentHash: string;
  readonly status: 'acknowledged' | 'rejected' | 'committed';
  readonly serverTick: number;
  readonly reason?: string;
}

// ============================================================================
// 3. Asynchrone Mutation-Callbacks & Lifecycle
// ============================================================================
export type MutationDomain = 'equip' | 'crafting' | 'guild' | 'economy' | 'housing' | 'skills';

export type MutationLifecyclePhase = 'idle' | 'pending' | 'receipt_confirmed' | 'readback_verified' | 'failed';

export interface MutationLifecycleState<TPayload = unknown, TReadback = unknown> {
  readonly domain: MutationDomain;
  readonly phase: MutationLifecyclePhase;
  readonly intent: AX1CanonicalIntent<string, TPayload> | null;
  readonly receipt: AX1IntentReceipt | null;
  readonly readbackData: TReadback | null;
  readonly error: string | null;
}

export type IntentSubscriber = (intent: AX1CanonicalIntent) => void;
export type StateSubscriber<T> = (envelope: StateEnvelope<T>) => void;

// ============================================================================
// 1. Der Neutrale HostProjectionPort
// ============================================================================
export class HostProjectionPort {
  private currentTick: number = 0;
  private sequenceCounter: number = 0;
  private readonly intentSubscribers: Set<IntentSubscriber> = new Set();
  private readonly activeMutations: Map<string, MutationLifecycleState> = new Map();
  private readonly mutationListeners: Set<(state: MutationLifecycleState) => void> = new Set();

  constructor(initialTick: number = 0) {
    this.currentTick = initialTick;
  }

  public getTick(): number {
    return this.currentTick;
  }

  public advanceTick(newTick?: number): number {
    if (typeof newTick === 'number') {
      this.currentTick = Math.max(this.currentTick, newTick);
    } else {
      this.currentTick += 1;
    }
    return this.currentTick;
  }

  /**
   * Erzeugt einen reinen CanonicalIntent nach dem AX1-Vertrag.
   * AX1 erzeugt nur den Intent, niemals das Ergebnis selbst.
   */
  public emitIntent<TAction extends string, TPayload>(
    actorId: string,
    action: TAction,
    payload: TPayload,
    chunkKey: string
  ): AX1CanonicalIntent<TAction, TPayload> {
    const sequenceOrder = ++this.sequenceCounter;
    const normalizedPayload = canonicalize(payload) as TPayload;
    const tick = this.currentTick;
    const clientTimestampMs = Date.now();

    const rawObject = {
      actorId,
      action,
      payload: normalizedPayload,
      tick,
      sequenceOrder,
      chunkKey,
    };

    const intentHash = sha256Hex(stableStringify(rawObject));

    const canonicalIntent: AX1CanonicalIntent<TAction, TPayload> = Object.freeze({
      actorId,
      action,
      payload: normalizedPayload,
      tick,
      sequenceOrder,
      chunkKey,
      intentHash,
      clientTimestampMs,
    });

    for (const sub of this.intentSubscribers) {
      try {
        sub(canonicalIntent as AX1CanonicalIntent);
      } catch (err) {
        console.error('[HostProjectionPort] Error in intent subscriber:', err);
      }
    }

    return canonicalIntent;
  }

  /**
   * Startet eine asynchrone Mutation mit pending-Zustand.
   * Regel 10: Keine lokalen Erfolgsnachrichten!
   * Erst als 'readback_verified' bestätigt, wenn Receipt und Readback zusammenpassen.
   */
  public initiateMutation<TPayload>(
    domain: MutationDomain,
    actorId: string,
    action: string,
    payload: TPayload,
    chunkKey: string
  ): AX1CanonicalIntent<string, TPayload> {
    const intent = this.emitIntent(actorId, action, payload, chunkKey);
    const initialLifecycle: MutationLifecycleState<TPayload> = {
      domain,
      phase: 'pending',
      intent,
      receipt: null,
      readbackData: null,
      error: null,
    };

    this.activeMutations.set(intent.intentHash, initialLifecycle as MutationLifecycleState);
    this.notifyMutationState(initialLifecycle as MutationLifecycleState);
    return intent;
  }

  /**
   * Verarbeitet ein autoritatives Server-Receipt für einen Intent.
   */
  public acknowledgeReceipt(receipt: AX1IntentReceipt): boolean {
    const existing = this.activeMutations.get(receipt.intentHash);
    if (!existing) return false;

    if (receipt.status === 'rejected') {
      const failedState: MutationLifecycleState = {
        ...existing,
        phase: 'failed',
        receipt,
        error: receipt.reason || 'Mutation was rejected by authoritative host',
      };
      this.activeMutations.set(receipt.intentHash, failedState);
      this.notifyMutationState(failedState);
      return false;
    }

    const receiptState: MutationLifecycleState = {
      ...existing,
      phase: 'receipt_confirmed',
      receipt,
    };
    this.activeMutations.set(receipt.intentHash, receiptState);
    this.notifyMutationState(receiptState);
    return true;
  }

  /**
   * Validiert den autoritativen Readback.
   * Erst wenn Receipt UND Readback vorliegen und übereinstimmen, wird die Mutation verifiziert.
   */
  public verifyReadback<TReadback>(
    intentHash: string,
    readbackData: TReadback,
    validator?: (data: TReadback) => boolean
  ): boolean {
    const existing = this.activeMutations.get(intentHash);
    if (!existing) return false;

    if (existing.phase !== 'receipt_confirmed') {
      return false;
    }

    const isValid = validator ? validator(readbackData) : readbackData !== null && readbackData !== undefined;
    if (!isValid) {
      const failedState: MutationLifecycleState = {
        ...existing,
        phase: 'failed',
        error: 'Readback verification failed: authoritative state mismatch',
      };
      this.activeMutations.set(intentHash, failedState);
      this.notifyMutationState(failedState);
      return false;
    }

    const verifiedState: MutationLifecycleState = {
      ...existing,
      phase: 'readback_verified',
      readbackData,
    };
    this.activeMutations.set(intentHash, verifiedState);
    this.notifyMutationState(verifiedState);
    return true;
  }

  public getMutationState(intentHash: string): MutationLifecycleState | undefined {
    return this.activeMutations.get(intentHash);
  }

  public subscribeIntents(sub: IntentSubscriber): () => void {
    this.intentSubscribers.add(sub);
    return () => this.intentSubscribers.delete(sub);
  }

  public subscribeMutations(listener: (state: MutationLifecycleState) => void): () => void {
    this.mutationListeners.add(listener);
    return () => this.mutationListeners.delete(listener);
  }

  private notifyMutationState(state: MutationLifecycleState): void {
    for (const listener of this.mutationListeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('[HostProjectionPort] Error in mutation listener:', err);
      }
    }
  }

  /**
   * Hilfsfunktion zum Erzeugen eines standardisierten StateEnvelopes
   */
  public static createEnvelope<T>(
    status: ProjectionStatus,
    data: T | null,
    confirmedTick: number | null = null,
    receiptId: string | null = null
  ): StateEnvelope<T> {
    return Object.freeze({
      status,
      data,
      confirmedTick,
      receiptId,
      lastUpdatedMs: Date.now(),
    });
  }
}

// Globales Singleton für AX1
export const ax1HostProjectionPort = new HostProjectionPort();
