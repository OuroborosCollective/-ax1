import { CombatLogEntry, DPSMeterStats } from '../../types';

export class CombatMetricsTracker {
  private damageSamples: { time: number; damage: number }[] = [];
  private damageTakenSamples: { time: number; damage: number }[] = [];
  private totalDamageDone = 0;
  private totalDamageTaken = 0;
  private totalHits = 0;
  private totalCrits = 0;
  private totalSynergies = 0;
  private combatDurationSec = 0;
  private inCombat = false;
  private outOfCombatTimer = 0;
  private peakDps = 0;
  private logs: CombatLogEntry[] = [];
  private maxLogs = 50;

  public recordDamageDealt(damage: number, isCrit: boolean, targetName: string, skillName?: string): void {
    const now = performance.now() / 1000;
    this.damageSamples.push({ time: now, damage });
    this.totalDamageDone += damage;
    this.totalHits += 1;
    if (isCrit) this.totalCrits += 1;
    this.inCombat = true;
    this.outOfCombatTimer = 0;

    const entry: CombatLogEntry = {
      id: `log_${Date.now()}_${Math.random()}`,
      timestamp: new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
      type: 'damage_dealt',
      text: `${skillName ? `[${skillName}] ` : ''}Dealt ${damage} damage to ${targetName}${isCrit ? ' (CRIT!)' : ''}`,
      color: isCrit ? '#fbbf24' : '#f3f4f6',
      value: damage,
      isCrit,
    };
    this.addLog(entry);
  }

  public recordDamageTaken(damage: number, attackerName: string, isDodged = false, isIFrame = false): void {
    const now = performance.now() / 1000;
    if (!isDodged) {
      this.damageTakenSamples.push({ time: now, damage });
      this.totalDamageTaken += damage;
      this.inCombat = true;
      this.outOfCombatTimer = 0;
    }

    const entry: CombatLogEntry = {
      id: `log_${Date.now()}_${Math.random()}`,
      timestamp: new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
      type: isDodged ? 'dodge' : 'damage_taken',
      text: isDodged
        ? `💨 Dodged attack from ${attackerName}${isIFrame ? ' with I-Frame roll!' : ''}`
        : `⚔️ Took ${damage} damage from ${attackerName}`,
      color: isDodged ? '#38bdf8' : '#ef4444',
      value: damage,
    };
    this.addLog(entry);
  }

  public recordSynergy(synergyName: string, damage: number, targetCount: number): void {
    this.totalSynergies += 1;
    const entry: CombatLogEntry = {
      id: `log_${Date.now()}_${Math.random()}`,
      timestamp: new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
      type: 'synergy',
      text: `✨ SYNERGY [${synergyName}]: Exploded for ${damage} bonus damage across ${targetCount} targets!`,
      color: '#00f0ff',
      value: damage,
    };
    this.addLog(entry);
  }

  public recordHeal(amount: number, source: string): void {
    const entry: CombatLogEntry = {
      id: `log_${Date.now()}_${Math.random()}`,
      timestamp: new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
      type: 'heal',
      text: `💖 Healed ${amount} HP via [${source}]`,
      color: '#10b981',
      value: amount,
    };
    this.addLog(entry);
  }

  private addLog(entry: CombatLogEntry): void {
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
  }

  public update(delta: number): void {
    const now = performance.now() / 1000;
    // Prune samples older than 5 seconds for rolling DPS window
    this.damageSamples = this.damageSamples.filter((s) => now - s.time <= 5.0);
    this.damageTakenSamples = this.damageTakenSamples.filter((s) => now - s.time <= 5.0);

    if (this.inCombat) {
      this.combatDurationSec += delta;
      this.outOfCombatTimer += delta;

      if (this.outOfCombatTimer > 6.0) {
        this.inCombat = false;
      }
    }

    const currentDps = this.getCurrentDps();
    if (currentDps > this.peakDps) {
      this.peakDps = currentDps;
    }
  }

  public getCurrentDps(): number {
    if (this.damageSamples.length === 0) return 0;
    const sum = this.damageSamples.reduce((acc, s) => acc + s.damage, 0);
    return Math.round(sum / 5.0);
  }

  public getCurrentDtps(): number {
    if (this.damageTakenSamples.length === 0) return 0;
    const sum = this.damageTakenSamples.reduce((acc, s) => acc + s.damage, 0);
    return Math.round(sum / 5.0);
  }

  public getStats(): DPSMeterStats {
    const critRate = this.totalHits > 0 ? Math.round((this.totalCrits / this.totalHits) * 100) : 0;
    return {
      currentDps: this.getCurrentDps(),
      peakDps: this.peakDps,
      currentDtps: this.getCurrentDtps(),
      totalDamageDone: this.totalDamageDone,
      totalDamageTaken: this.totalDamageTaken,
      combatDurationSec: Math.round(this.combatDurationSec),
      inCombat: this.inCombat,
      critRate,
      synergyTriggers: this.totalSynergies,
      recentLogs: [...this.logs],
    };
  }

  public reset(): void {
    this.damageSamples = [];
    this.damageTakenSamples = [];
    this.totalDamageDone = 0;
    this.totalDamageTaken = 0;
    this.totalHits = 0;
    this.totalCrits = 0;
    this.totalSynergies = 0;
    this.combatDurationSec = 0;
    this.peakDps = 0;
    this.inCombat = false;
    this.outOfCombatTimer = 0;
    this.logs = [];
  }
}

export const combatMetricsTracker = new CombatMetricsTracker();
