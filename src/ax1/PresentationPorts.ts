/**
 * PresentationPorts.ts - AX1 Confirmed Presentation Interfaces
 *
 * Spezifikation:
 * 9. Klare Präsentationsschnittstellen für Combat Log, DPS, Minimap, WorldHash
 *    und TickRecorder, die ausschließlich bestätigte Events akzeptieren.
 */

export interface ConfirmedCombatEvent {
  readonly eventId: string;
  readonly serverTick: number;
  readonly sourceActorId: string;
  readonly targetActorId: string;
  readonly amount: number;
  readonly type: 'damage' | 'heal' | 'buff' | 'debuff' | 'crit';
  readonly abilityId: string;
  readonly confirmedReceiptId: string;
  readonly confirmedAtMs: number;
}

export interface ConfirmedDpsMetric {
  readonly actorId: string;
  readonly windowSeconds: number;
  readonly totalConfirmedDamage: number;
  readonly currentDps: number;
  readonly lastConfirmedTick: number;
}

export interface ConfirmedMinimapEntity {
  readonly entityId: string;
  readonly type: 'player' | 'npc' | 'mob' | 'portal' | 'loot';
  readonly x: number;
  readonly z: number;
  readonly name: string;
  readonly isHostile: boolean;
  readonly confirmedTick: number;
}

export interface ConfirmedWorldHashSnapshot {
  readonly tick: number;
  readonly worldHash: string;
  readonly chunkCount: number;
  readonly verifiedEntitiesCount: number;
  readonly confirmedReceiptId: string;
}

export interface ConfirmedTickRecord {
  readonly tick: number;
  readonly deltaMs: number;
  readonly stateHash: string;
  readonly intentCount: number;
  readonly confirmedTimestampMs: number;
}

export class ConfirmedPresentationPorts {
  private readonly combatEvents: ConfirmedCombatEvent[] = [];
  private readonly maxCombatEvents = 100;
  private readonly tickRecords: ConfirmedTickRecord[] = [];
  private readonly maxTickRecords = 100;
  private latestWorldHash: ConfirmedWorldHashSnapshot | null = null;
  private readonly minimapEntities: Map<string, ConfirmedMinimapEntity> = new Map();

  private readonly listeners: Set<() => void> = new Set();

  /**
   * Nimmt ein Kampf-Event AUSSCHLIESSLICH entgegen, wenn es ein bestätigtes Receipt besitzt.
   */
  public pushCombatEvent(event: ConfirmedCombatEvent): boolean {
    if (!event.confirmedReceiptId || event.serverTick <= 0) {
      console.warn('[PresentationPorts] Dropped unconfirmed combat event without valid receipt or tick:', event);
      return false;
    }
    this.combatEvents.unshift(event);
    if (this.combatEvents.length > this.maxCombatEvents) {
      this.combatEvents.pop();
    }
    this.notify();
    return true;
  }

  public getCombatEvents(): readonly ConfirmedCombatEvent[] {
    return this.combatEvents;
  }

  /**
   * Berechnet DPS ausschließlich anhand bestätigter Schadens-Events im Zeitfenster.
   */
  public calculateDps(actorId: string, windowSeconds: number = 5): ConfirmedDpsMetric {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const relevantEvents = this.combatEvents.filter(
      e => e.sourceActorId === actorId &&
           e.type === 'damage' &&
           (now - e.confirmedAtMs) <= windowMs
    );

    const totalDamage = relevantEvents.reduce((acc, e) => acc + e.amount, 0);
    const currentDps = windowSeconds > 0 ? Math.round(totalDamage / windowSeconds) : 0;
    const lastTick = relevantEvents[0]?.serverTick ?? 0;

    return {
      actorId,
      windowSeconds,
      totalConfirmedDamage: totalDamage,
      currentDps,
      lastConfirmedTick: lastTick,
    };
  }

  public updateMinimapEntities(entities: ConfirmedMinimapEntity[]): void {
    this.minimapEntities.clear();
    for (const ent of entities) {
      if (ent.confirmedTick > 0) {
        this.minimapEntities.set(ent.entityId, ent);
      }
    }
    this.notify();
  }

  public getMinimapEntities(): ConfirmedMinimapEntity[] {
    return Array.from(this.minimapEntities.values());
  }

  public setWorldHash(snapshot: ConfirmedWorldHashSnapshot): void {
    if (snapshot.confirmedReceiptId) {
      this.latestWorldHash = snapshot;
      this.notify();
    }
  }

  public getWorldHash(): ConfirmedWorldHashSnapshot | null {
    return this.latestWorldHash;
  }

  public recordTick(record: ConfirmedTickRecord): void {
    this.tickRecords.push(record);
    if (this.tickRecords.length > this.maxTickRecords) {
      this.tickRecords.shift();
    }
    this.notify();
  }

  public getTickRecords(): readonly ConfirmedTickRecord[] {
    return this.tickRecords;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) {
      try {
        l();
      } catch (err) {
        console.error('[PresentationPorts] Error in listener:', err);
      }
    }
  }
}

export const ax1PresentationPorts = new ConfirmedPresentationPorts();
