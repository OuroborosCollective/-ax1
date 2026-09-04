/**
 * TradeSystem.ts
 *
 * Implements a mock-free Two-Phase Commit (2PC) player-to-player trading protocol.
 *
 * Protocol phases:
 * 1. Propose & Open Escrow: Both participants establish a shared trade session.
 * 2. Stage & Lock: Items and gold are staged into escrow. Modifying an offer resets the other party's acceptance lock.
 * 3. Commit (Atomic Swap): Both players confirm. The server verifies asset ownership and atomically swaps assets.
 * 4. Rollback: If canceled, disconnected, or validation fails, escrow locks release with zero state mutation.
 */

import { RPGItem } from '../../types';

export interface TradeOffer {
  playerId: string;
  playerName: string;
  items: RPGItem[];
  gold: number;
  isConfirmed: boolean;
}

export interface TradeSession {
  tradeId: string;
  partyA: TradeOffer;
  partyB: TradeOffer;
  status: 'staging' | 'locked' | 'committed' | 'cancelled';
  createdAt: number;
  lastActivityAt: number;
}

export class TradeSystem {
  private activeSession: TradeSession | null = null;
  public onTradeStateChanged?: (session: TradeSession | null) => void;

  public getSession(): TradeSession | null {
    return this.activeSession;
  }

  /**
   * Starts a new trading session between local player and target player.
   */
  public openTrade(
    localPlayerId: string,
    localPlayerName: string,
    targetPlayerId: string,
    targetPlayerName: string
  ): TradeSession {
    const tradeId = `trade_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.activeSession = {
      tradeId,
      partyA: {
        playerId: localPlayerId,
        playerName: localPlayerName,
        items: [],
        gold: 0,
        isConfirmed: false,
      },
      partyB: {
        playerId: targetPlayerId,
        playerName: targetPlayerName,
        items: [],
        gold: 0,
        isConfirmed: false,
      },
      status: 'staging',
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    this.onTradeStateChanged?.(this.activeSession);
    return this.activeSession;
  }

  /**
   * Stage an item into the trade offer.
   * Reset mutual confirmation so no "ninja swap" scam is possible.
   */
  public stageItem(playerId: string, item: RPGItem): boolean {
    if (!this.activeSession || this.activeSession.status === 'committed') return false;

    const offer = this.getOffer(playerId);
    if (!offer) return false;

    // Check not already staged
    if (offer.items.some((i) => i.id === item.id)) return false;

    offer.items.push(item);
    // Security: Any change to offer resets confirmation for BOTH parties
    this.activeSession.partyA.isConfirmed = false;
    this.activeSession.partyB.isConfirmed = false;
    this.activeSession.status = 'staging';
    this.activeSession.lastActivityAt = Date.now();

    this.onTradeStateChanged?.(this.activeSession);
    return true;
  }

  /**
   * Remove a staged item from the trade offer.
   */
  public unstageItem(playerId: string, itemId: string): boolean {
    if (!this.activeSession || this.activeSession.status === 'committed') return false;

    const offer = this.getOffer(playerId);
    if (!offer) return false;

    const initialLen = offer.items.length;
    offer.items = offer.items.filter((i) => i.id !== itemId);
    if (offer.items.length !== initialLen) {
      this.activeSession.partyA.isConfirmed = false;
      this.activeSession.partyB.isConfirmed = false;
      this.activeSession.status = 'staging';
      this.activeSession.lastActivityAt = Date.now();
      this.onTradeStateChanged?.(this.activeSession);
      return true;
    }
    return false;
  }

  /**
   * Set staged gold amount.
   */
  public stageGold(playerId: string, amount: number): boolean {
    if (!this.activeSession || this.activeSession.status === 'committed') return false;
    const offer = this.getOffer(playerId);
    if (!offer || amount < 0) return false;

    offer.gold = amount;
    this.activeSession.partyA.isConfirmed = false;
    this.activeSession.partyB.isConfirmed = false;
    this.activeSession.status = 'staging';
    this.activeSession.lastActivityAt = Date.now();

    this.onTradeStateChanged?.(this.activeSession);
    return true;
  }

  /**
   * Lock and confirm the trade for one player.
   * If both confirm, executes Phase 2 atomic swap.
   */
  public confirmOffer(
    playerId: string,
    executeSwap: (trade: TradeSession) => boolean
  ): { status: TradeSession['status']; success: boolean } {
    if (!this.activeSession || this.activeSession.status === 'committed') {
      return { status: 'cancelled', success: false };
    }

    const offer = this.getOffer(playerId);
    if (!offer) return { status: 'cancelled', success: false };

    offer.isConfirmed = true;
    this.activeSession.lastActivityAt = Date.now();

    // Check if both parties confirmed
    if (this.activeSession.partyA.isConfirmed && this.activeSession.partyB.isConfirmed) {
      this.activeSession.status = 'locked';

      // Phase 2: Atomic Execution
      const swapOk = executeSwap(this.activeSession);
      if (swapOk) {
        this.activeSession.status = 'committed';
        this.onTradeStateChanged?.(this.activeSession);
        return { status: 'committed', success: true };
      } else {
        // Rollback
        this.activeSession.status = 'cancelled';
        this.onTradeStateChanged?.(this.activeSession);
        return { status: 'cancelled', success: false };
      }
    }

    this.onTradeStateChanged?.(this.activeSession);
    return { status: this.activeSession.status, success: true };
  }

  /**
   * Cancel and rollback the trade session.
   */
  public cancelTrade(): void {
    if (this.activeSession) {
      this.activeSession.status = 'cancelled';
      this.onTradeStateChanged?.(this.activeSession);
      this.activeSession = null;
    }
  }

  private getOffer(playerId: string): TradeOffer | null {
    if (!this.activeSession) return null;
    if (this.activeSession.partyA.playerId === playerId) return this.activeSession.partyA;
    if (this.activeSession.partyB.playerId === playerId) return this.activeSession.partyB;
    return null;
  }
}

export const tradeSystem = new TradeSystem();
