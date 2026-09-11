import CryptoJS from 'crypto-js';

/**
 * DeterministicHash.ts
 *
 * Cross-platform, deterministic SHA-256 and FNV-1a hashing utility
 * with guaranteed identical output across browser and Node.js environments.
 */

export function sha256Hex(value: unknown): string {
  const serialized = typeof value === 'string' ? value : stableStringify(value);
  return CryptoJS.SHA256(serialized).toString();
}

export function seed32FromHash(value: string): number {
  const hashObj = CryptoJS.SHA256(value);
  return (hashObj.words[0] >>> 0);
}

export function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function fnv1aHex(text: string): string {
  return fnv1a32(text).toString(16).padStart(8, '0');
}

function stableRound(value: unknown): unknown {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 1000) / 1000;
  }
  return value;
}

export function canonicalize(value: unknown): unknown {
  const rounded = stableRound(value);
  if (rounded === null || typeof rounded !== 'object') return rounded;
  if (Array.isArray(rounded)) return rounded.map(canonicalize);
  const input = rounded as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(input).sort()) {
    const v = input[key];
    if (typeof v === 'undefined' || typeof v === 'function') continue;
    output[key] = canonicalize(v);
  }
  return output;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}
