/**
 * ax1ContractTests.ts - AX1 Strict Invariant Contract Tests
 *
 * Spezifikation:
 * 11. Tests, die absichtlich fehlende Gold-, Level-, Item-, Quest- und NPC-Daten einspeisen
 *     und sicherstellen, dass AX1 nichts erfindet.
 *
 * Regeln:
 * - Fehlende Werte müssen als '—' formatiert werden (formatProjectionValue).
 * - Keine automatische Ersetzung durch 0 Gold, Level 1 oder Default-Items.
 * - Keine Mutationen als bestätigt markieren ohne übereinstimmenden Readback.
 * - Exakter 100ms / 10Hz Tickvertrag.
 */

import {
  HostProjectionPort,
  AX1_TICK_RATE_HZ,
  AX1_TICK_INTERVAL_MS,
  formatProjectionValue,
} from './HostProjectionPort';
import { AX1_VISIBLE_COMPONENTS_MANIFEST } from './SourceManifest';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

export function runAx1ContractTests(): { allPassed: boolean; results: TestResult[] } {
  const results: TestResult[] = [];

  // Test 1: Tickvertrag (100 ms / 10 Hz)
  const tickHzValid = AX1_TICK_RATE_HZ === 10;
  const tickIntervalValid = AX1_TICK_INTERVAL_MS === 100;
  results.push({
    name: 'Tickvertrag 100ms / 10Hz Konstanten',
    passed: tickHzValid && tickIntervalValid,
    message: `AX1_TICK_RATE_HZ=${AX1_TICK_RATE_HZ}, AX1_TICK_INTERVAL_MS=${AX1_TICK_INTERVAL_MS}`,
  });

  // Test 2: Fehlendes Gold darf nicht als 0 oder Default erfunden werden
  const rawGold: number | null = null;
  const renderedGold = formatProjectionValue(rawGold, val => `${val} g`);
  results.push({
    name: 'Fehlendes Gold erzeugt "—" statt 0 oder Starterwert',
    passed: renderedGold === '—',
    message: `Eingabe null -> Ausgabe "${renderedGold}" (Erwartet: "—")`,
  });

  // Test 3: Fehlendes Level darf nicht als 1 erfunden werden
  const rawLevel: number | undefined = undefined;
  const renderedLevel = formatProjectionValue(rawLevel, val => `Lvl ${val}`);
  results.push({
    name: 'Fehlendes Level erzeugt "—" statt Level 1',
    passed: renderedLevel === '—',
    message: `Eingabe undefined -> Ausgabe "${renderedLevel}" (Erwartet: "—")`,
  });

  // Test 4: Fehlender NPC Name / Daten
  const rawNpcName: string | null = null;
  const renderedNpc = formatProjectionValue(rawNpcName);
  results.push({
    name: 'Fehlender NPC Name erzeugt "—" statt Platzhalter',
    passed: renderedNpc === '—',
    message: `Eingabe null -> Ausgabe "${renderedNpc}" (Erwartet: "—")`,
  });

  // Test 5: Leerer String wird ebenfalls als fehlend ('—') behandelt
  const rawEmptyQuestTitle = '   ';
  const renderedQuest = formatProjectionValue(rawEmptyQuestTitle);
  results.push({
    name: 'Leerer Quest-Titel wird als "—" abgebildet',
    passed: renderedQuest === '—',
    message: `Eingabe "   " -> Ausgabe "${renderedQuest}" (Erwartet: "—")`,
  });

  // Test 6: HostProjectionPort erzeugt reine Intents mit Hash und Tick
  const port = new HostProjectionPort(42);
  const intent = port.emitIntent('player-test-1', 'cast_ability', { abilityId: 'aether_bolt' }, 'chunk_0_0');
  const hasValidIntent =
    intent.actorId === 'player-test-1' &&
    intent.tick === 42 &&
    typeof intent.intentHash === 'string' &&
    intent.intentHash.length === 64;

  results.push({
    name: 'CanonicalIntent Erzeugung mit SHA-256 Hash und Tick',
    passed: hasValidIntent,
    message: `IntentHash=${intent.intentHash.slice(0, 16)}..., Tick=${intent.tick}`,
  });

  // Test 7: Mutation bleibt pending und wird erst durch Receipt + Readback verifiziert
  const mutIntent = port.initiateMutation(
    'crafting',
    'player-test-1',
    'forge_item',
    { recipeId: 'bronze_blade' },
    'chunk_0_0'
  );
  const pendingState = port.getMutationState(mutIntent.intentHash);
  const isPending = pendingState?.phase === 'pending';

  // Receipt bestätigen
  port.acknowledgeReceipt({
    receiptId: 'rcpt-1234',
    intentHash: mutIntent.intentHash,
    status: 'committed',
    serverTick: 43,
  });
  const receiptState = port.getMutationState(mutIntent.intentHash);
  const isReceiptConfirmed = receiptState?.phase === 'receipt_confirmed';

  // Readback verifizieren
  port.verifyReadback(mutIntent.intentHash, { createdItemId: 'bronze_blade_t1' });
  const finalState = port.getMutationState(mutIntent.intentHash);
  const isReadbackVerified = finalState?.phase === 'readback_verified';

  results.push({
    name: 'Asynchrone Mutation: pending -> receipt_confirmed -> readback_verified',
    passed: isPending && isReceiptConfirmed && isReadbackVerified,
    message: `Lifecycle: pending(${isPending}) -> receipt(${isReceiptConfirmed}) -> readbackVerified(${isReadbackVerified})`,
  });

  // Test 8: Readback-Fehlschlag bricht Mutation sauber ab
  const mut2 = port.initiateMutation(
    'equip',
    'player-test-1',
    'equip_slot',
    { slot: 'mainhand', itemId: 'sword_99' },
    'chunk_0_0'
  );
  port.acknowledgeReceipt({
    receiptId: 'rcpt-5678',
    intentHash: mut2.intentHash,
    status: 'committed',
    serverTick: 44,
  });
  // Readback schlägt absichtlich fehl
  const readbackResult = port.verifyReadback(mut2.intentHash, null, data => data !== null);
  const failedState = port.getMutationState(mut2.intentHash);

  results.push({
    name: 'Readback Mismatch führt zu Zustand "failed" ohne fälschliche Erfolgsanzeige',
    passed: readbackResult === false && failedState?.phase === 'failed',
    message: `ReadbackResult=${readbackResult}, Phase=${failedState?.phase}`,
  });

  // Test 9: Source-Manifest enthält sichtbare Komponenten
  const manifestCount = AX1_VISIBLE_COMPONENTS_MANIFEST.length;
  results.push({
    name: 'Source-Manifest aller sichtbaren Komponenten erfasst',
    passed: manifestCount >= 18,
    message: `Registrierte Komponenten: ${manifestCount}`,
  });

  const allPassed = results.every(r => r.passed);
  return { allPassed, results };
}
