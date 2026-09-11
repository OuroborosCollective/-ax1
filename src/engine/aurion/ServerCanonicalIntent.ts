import { sha256Hex, canonicalize, stableStringify } from "../math/DeterministicHash";

export type CanonicalIntentHash = string;

export interface ClientIntent<TAction extends string = string, TPayload = unknown> {
  readonly action: TAction;
  readonly payload: TPayload;
  readonly requestId?: string;
}

export interface ServerCanonicalIntent<TAction extends string = string, TPayload = unknown> {
  readonly action: TAction;
  readonly payload: TPayload;
  readonly requestId?: string;
  readonly actorId: string;
  readonly tickId: number | string;
  readonly logicalIndex: number;
  readonly receivedOrder: number;
  readonly chunkKey: string;
  readonly intentHash: CanonicalIntentHash;
}

export interface CanonicalIntentContext {
  readonly actorId: string;
  readonly tickId: number | string;
  readonly logicalIndex: number;
  readonly receivedOrder: number;
  readonly chunkKey: string;
}

export interface WorldPosition2D {
  readonly x: number;
  readonly y: number;
}

export function chunkKeyFromWorldPosition(position: WorldPosition2D, chunkSize: number = 64): string {
  const chunkX = Math.floor(position.x / chunkSize);
  const chunkY = Math.floor(position.y / chunkSize);
  return `${chunkX}:${chunkY}`;
}

export function canonicalizeClientIntent<TAction extends string = string, TPayload = unknown>(
  intent: ClientIntent<TAction, TPayload>,
  context: CanonicalIntentContext
): ServerCanonicalIntent<TAction, TPayload> {
  const normalized = {
    action: intent.action,
    payload: canonicalize(intent.payload) as TPayload,
    ...(intent.requestId ? { requestId: intent.requestId.trim() } : {}),
    actorId: context.actorId.trim(),
    tickId: context.tickId,
    logicalIndex: context.logicalIndex,
    receivedOrder: context.receivedOrder,
    chunkKey: context.chunkKey,
  };

  const intentHash = sha256Hex(stableStringify(normalized));

  return Object.freeze({
    ...normalized,
    intentHash,
  });
}
