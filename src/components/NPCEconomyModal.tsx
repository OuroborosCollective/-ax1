import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Coins,
  Store,
  Users,
  Dna,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  X,
  RefreshCw,
  Sparkles,
  Package,
  Compass,
  Scroll,
  Sword,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  History,
} from 'lucide-react';
import { AutonomousNPCEconomy, COMMODITIES, RegionalMarketHub } from '../engine/economy/AutonomousNPCEconomy';
import { dynamicEconomyQuestEngine, DynamicEconomyQuest } from '../engine/economy/DynamicEconomyQuestEngine';
import { caravanSecuritySystem } from '../engine/economy/CaravanSecuritySystem';
import { PlayerStats, RPGItem, SoldBuybackItem } from '../types';

interface NPCEconomyModalProps {
  isOpen: boolean;
  onClose: () => void;
  economy: AutonomousNPCEconomy | null;
  playerStats: PlayerStats;
  onPlayerGoldChange: (newGold: number) => void;
  onShowMessage: (msg: string, color?: string) => void;
  playerInventory?: RPGItem[];
  onUpdatePlayerInventory?: (inventory: RPGItem[]) => void;
  buybackQueue?: SoldBuybackItem[];
  onUpdateBuybackQueue?: (queue: SoldBuybackItem[]) => void;
}

export const NPCEconomyModal: React.FC<NPCEconomyModalProps> = ({
  isOpen,
  onClose,
  economy,
  playerStats,
  onPlayerGoldChange,
  onShowMessage,
  playerInventory = [],
  onUpdatePlayerInventory,
  buybackQueue = [],
  onUpdateBuybackQueue,
}) => {
  const [activeTab, setActiveTab] = useState<'markets' | 'buyback' | 'quests' | 'security' | 'census' | 'evolution' | 'treasury'>('markets');
  const [selectedHubId, setSelectedHubId] = useState<string>('sun_spire');
  const [tradeQuantity, setTradeQuantity] = useState<number>(1);
  const [localBuybackList, setLocalBuybackList] = useState<SoldBuybackItem[]>(buybackQueue);
  const [, setTicker] = useState<number>(0);

  // Synchronize local and parent buyback queue
  useEffect(() => {
    setLocalBuybackList(buybackQueue);
  }, [buybackQueue]);

  const handleSellInventoryItem = (itemToSell: RPGItem) => {
    const saleValue = Math.max(1, Math.floor(itemToSell.valueGold || 10));
    
    // 1. Remove 1 copy from player inventory
    if (onUpdatePlayerInventory) {
      const idx = playerInventory.findIndex((i) => i.id === itemToSell.id);
      if (idx !== -1) {
        const newInv = [...playerInventory];
        newInv.splice(idx, 1);
        onUpdatePlayerInventory(newInv);
      }
    }

    // 2. Add gold to player
    onPlayerGoldChange(playerStats.gold + saleValue);

    // 3. Push to buyback queue (max 10 items)
    const newRecord: SoldBuybackItem = {
      id: `buyback_${itemToSell.id}_${Date.now()}`,
      item: itemToSell,
      soldPrice: saleValue,
      soldAtTimestamp: Date.now(),
      soldToHubId: selectedHubId,
    };

    const updatedQueue = [newRecord, ...localBuybackList].slice(0, 10);
    setLocalBuybackList(updatedQueue);
    if (onUpdateBuybackQueue) {
      onUpdateBuybackQueue(updatedQueue);
    }

    onShowMessage(`[${itemToSell.name}] für ${saleValue} Gold an den Markt verkauft (im Rückkauf gesichert)!`, '#10b981');
  };

  const handleBuybackItem = (record: SoldBuybackItem) => {
    if (playerStats.gold < record.soldPrice) {
      onShowMessage(`Nicht genug Gold! Benötigt: ${record.soldPrice} Gold.`, '#ef4444');
      return;
    }

    // 1. Deduct exact original sale price
    onPlayerGoldChange(playerStats.gold - record.soldPrice);

    // 2. Return item to player inventory
    if (onUpdatePlayerInventory) {
      onUpdatePlayerInventory([...playerInventory, record.item]);
    }

    // 3. Remove from buyback queue
    const updatedQueue = localBuybackList.filter((b) => b.id !== record.id);
    setLocalBuybackList(updatedQueue);
    if (onUpdateBuybackQueue) {
      onUpdateBuybackQueue(updatedQueue);
    }

    onShowMessage(`[${record.item.name}] für den Originalpreis von ${record.soldPrice} Gold zurückgekauft!`, '#00f0ff');
  };

  // Force re-render periodically while open to reflect live economy ticks
  useEffect(() => {
    if (!isOpen || !economy) return;
    const timer = setInterval(() => {
      setTicker((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, economy]);

  if (!isOpen || !economy) return null;

  const hubsList: RegionalMarketHub[] = Array.from(economy.hubs.values());
  const currentHub: RegionalMarketHub = economy.hubs.get(selectedHubId) || hubsList[0];

  const livingNPCs = economy.npcs.filter((n) => n.alive);
  const commerceCount = livingNPCs.filter((n) => n.macroState === 'COMMERCE').length;
  const productionCount = livingNPCs.filter((n) => n.macroState === 'PRODUCTION').length;
  const survivalCount = livingNPCs.filter((n) => n.macroState === 'SURVIVAL').length;
  const defenseCount = livingNPCs.filter((n) => n.macroState === 'DEFENSE').length;

  const avgHunger = Math.round(
    livingNPCs.reduce((acc, n) => acc + n.hunger, 0) / Math.max(1, livingNPCs.length) / 100
  );
  const avgFatigue = Math.round(
    livingNPCs.reduce((acc, n) => acc + n.fatigue, 0) / Math.max(1, livingNPCs.length) / 100
  );

  const topMerchants = [...livingNPCs].sort((a, b) => b.wealthCopper - a.wealthCopper).slice(0, 5);

  const handleBuy = (commodityId: number) => {
    const res = economy.executePlayerBuy(selectedHubId, commodityId, tradeQuantity, playerStats.gold);
    if (res.success) {
      const goldCost = Math.ceil(res.costCopper / 1000);
      onPlayerGoldChange(Math.max(0, playerStats.gold - goldCost));
      const c = COMMODITIES.find((x) => x.id === commodityId);
      onShowMessage(`Erfolgreich ${tradeQuantity}x [${c?.name}] am Markt erworben (-${goldCost} Gold)!`, '#00f0ff');
    } else {
      onShowMessage(res.error || 'Kauf fehlgeschlagen.', '#ef4444');
    }
  };

  const handleSell = (commodityId: number) => {
    const res = economy.executePlayerSell(selectedHubId, commodityId, tradeQuantity);
    if (res.success) {
      const goldEarned = Math.max(1, Math.floor(res.payoutCopper / 1000));
      onPlayerGoldChange(playerStats.gold + goldEarned);
      const c = COMMODITIES.find((x) => x.id === commodityId);
      onShowMessage(`Erfolgreich ${tradeQuantity}x [${c?.name}] verkauft (+${goldEarned} Gold)!`, '#10b981');
    } else {
      onShowMessage(res.error || 'Verkauf fehlgeschlagen.', '#ef4444');
    }
  };

  return (
    <div
      id="npc-economy-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-4xl bg-[#0a121e] border-2 border-[#b8860b]/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#061528] via-[#0b2138] to-[#061528] border-b border-[#b8860b]/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.3)]">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-amber-100 flex items-center gap-2">
                Autonome NPC-Ökonomie & Marktknoten
                <span className="px-2 py-0.5 text-xs font-mono font-normal rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  Deterministischer Tick #{economy.currentTick}
                </span>
              </h2>
              <p className="text-xs text-amber-200/70 font-sans">
                Echtzeit-Arbitrage, HSM-Bedürfniszerfall & dynamische Rohstoffmärkte
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 border border-amber-500/30 text-amber-300 font-mono text-xs">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>{playerStats.gold.toLocaleString()} Gold</span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-700 hover:border-amber-400 text-gray-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800 bg-[#060e18] px-6 gap-2 pt-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('markets')}
            className={`px-3 py-2 rounded-t-lg font-serif text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'markets'
                ? 'bg-[#0a1828] text-cyan-300 border-t-2 border-x border-cyan-400 border-b-transparent shadow'
                : 'text-gray-400 hover:text-amber-200'
            }`}
          >
            <Store className="w-3.5 h-3.5" /> Dynamische Märkte
          </button>
          <button
            onClick={() => setActiveTab('buyback')}
            className={`px-3 py-2 rounded-t-lg font-serif text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'buyback'
                ? 'bg-[#0a1828] text-amber-300 border-t-2 border-x border-amber-400 border-b-transparent shadow'
                : 'text-gray-400 hover:text-amber-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> Rückkauf / Buyback ({localBuybackList.length}/10)
          </button>
          <button
            onClick={() => setActiveTab('quests')}
            className={`px-3 py-2 rounded-t-lg font-serif text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'quests'
                ? 'bg-[#0a1828] text-cyan-300 border-t-2 border-x border-cyan-400 border-b-transparent shadow'
                : 'text-gray-400 hover:text-amber-200'
            }`}
          >
            <Scroll className="w-3.5 h-3.5 text-amber-400" /> Handelsnotstand & Quests
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-3 py-2 rounded-t-lg font-serif text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'security'
                ? 'bg-[#0a1828] text-cyan-300 border-t-2 border-x border-cyan-400 border-b-transparent shadow'
                : 'text-gray-400 hover:text-amber-200'
            }`}
          >
            <Sword className="w-3.5 h-3.5 text-rose-400" /> Routensicherheit & Karawanen
          </button>
          <button
            onClick={() => setActiveTab('census')}
            className={`px-3 py-2 rounded-t-lg font-serif text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'census'
                ? 'bg-[#0a1828] text-cyan-300 border-t-2 border-x border-cyan-400 border-b-transparent shadow'
                : 'text-gray-400 hover:text-amber-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Demografie & HSM
          </button>
          <button
            onClick={() => setActiveTab('evolution')}
            className={`px-3 py-2 rounded-t-lg font-serif text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'evolution'
                ? 'bg-[#0a1828] text-cyan-300 border-t-2 border-x border-cyan-400 border-b-transparent shadow'
                : 'text-gray-400 hover:text-amber-200'
            }`}
          >
            <Dna className="w-3.5 h-3.5" /> Dynastien & Evolution
          </button>
          <button
            onClick={() => setActiveTab('treasury')}
            className={`px-3 py-2 rounded-t-lg font-serif text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'treasury'
                ? 'bg-[#0a1828] text-cyan-300 border-t-2 border-x border-cyan-400 border-b-transparent shadow'
                : 'text-gray-400 hover:text-amber-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" /> Gilden & Zolltarife
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[#07111c]/90">
          {/* TAB 1: DYNAMIC COMMODITY MARKETS */}
          {activeTab === 'markets' && (
            <div className="space-y-6">
              {/* Regional Hub Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {hubsList.map((hub) => {
                  const isSelected = hub.id === selectedHubId;
                  return (
                    <button
                      key={hub.id}
                      onClick={() => setSelectedHubId(hub.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                          : 'bg-black/40 border-gray-800 hover:border-amber-500/40'
                      }`}
                    >
                      <div className="text-xs font-serif font-bold text-amber-200 truncate">{hub.name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{hub.regionName}</div>
                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="text-gray-400">Zoll:</span>
                        <span className="font-mono text-cyan-300">{(hub.taxRateBasisPoints / 100).toFixed(1)}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Trade Hub Details Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-black/80 via-[#0a192f] to-black/80 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-serif font-bold text-cyan-200 flex items-center gap-2">
                    <Store className="w-4 h-4 text-cyan-400" /> {currentHub.name} Warenbörse
                  </h3>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Kontrolliert von: <span className="text-amber-300 font-bold">{currentHub.controllingGuild}</span> |
                    Schatzkammer: <span className="font-mono text-cyan-300">{Math.round(currentHub.treasuryCopper / 1000).toLocaleString()} Gold</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300">Handelsmenge:</span>
                  {[1, 5, 10, 25].map((qty) => (
                    <button
                      key={qty}
                      onClick={() => setTradeQuantity(qty)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                        tradeQuantity === qty
                          ? 'bg-cyan-500 text-black shadow'
                          : 'bg-black/60 border border-gray-700 text-gray-300 hover:border-cyan-400'
                      }`}
                    >
                      {qty}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Commodity Market List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {COMMODITIES.map((c) => {
                  const currentPriceCopper = economy.getMarketPriceCopper(selectedHubId, c.id);
                  const currentStock = currentHub.stock.get(c.id) || 0;
                  const priceChangePct = Math.round(
                    ((currentPriceCopper - c.basePriceCopper) / c.basePriceCopper) * 100
                  );
                  const isHighDemand = priceChangePct > 0;

                  return (
                    <div
                      key={c.id}
                      className="p-4 rounded-xl bg-black/60 border border-gray-800 hover:border-cyan-500/50 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">{c.icon}</span>
                          <div>
                            <div className="text-sm font-serif font-bold text-amber-100">{c.name}</div>
                            <div className="text-[10px] text-gray-400">
                              Kategorie: <span className="capitalize text-gray-300">{c.category}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-mono font-bold text-amber-300 flex items-center justify-end gap-1">
                            {currentPriceCopper} Kupfer
                          </div>
                          <div
                            className={`text-[10px] font-mono font-bold flex items-center justify-end gap-0.5 ${
                              isHighDemand ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {isHighDemand ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {priceChangePct > 0 ? `+${priceChangePct}%` : `${priceChangePct}%`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-800/80">
                        <span>Lagerbestand: <strong className="text-cyan-300 font-mono">{currentStock} Stk.</strong></span>
                        <span>Basiswert: <strong className="text-gray-300 font-mono">{c.basePriceCopper} Cu</strong></span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => handleBuy(c.id)}
                          disabled={currentStock < tradeQuantity}
                          className="py-1.5 px-3 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 text-xs font-serif font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Kaufen ({Math.ceil((currentPriceCopper * tradeQuantity) / 1000)} G)
                        </button>
                        <button
                          onClick={() => handleSell(c.id)}
                          className="py-1.5 px-3 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 text-xs font-serif font-bold transition-all cursor-pointer"
                        >
                          Verkaufen ({Math.max(1, Math.floor((currentPriceCopper * tradeQuantity) / 1000))} G)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: BUYBACK (RÜCKKAUF LETZTE 10 GEGENSTÄNDE) */}
          {activeTab === 'buyback' && (
            <div className="space-y-6">
              {/* Header Info Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#0a1b2a] via-[#0c2838] to-[#0a1b2a] border border-amber-500/40 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-serif font-bold text-amber-100 flex items-center gap-2">
                      Händler-Rückkauf / NPC Buyback Ledger
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-400/30">
                        {localBuybackList.length}/10 Plätze belegt
                      </span>
                    </h3>
                    <p className="text-xs text-amber-200/70">
                      Erlaube die Rücknahme der letzten 10 an NPCs/Märkte verkauften Gegenstände zum exakten Original-Verkaufspreis während der aktuellen Sitzung.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-300 font-mono bg-black/50 px-3 py-1.5 rounded-lg border border-gray-700">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>Verfügbares Gold: <strong className="text-amber-300">{playerStats.gold.toLocaleString()} G</strong></span>
                </div>
              </div>

              {/* Main Content Layout: Buyback Queue + Quick Sell Drawer */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Cols: Sold items waiting in Buyback queue */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-serif font-bold text-amber-200 uppercase tracking-wider flex items-center gap-2">
                      <History className="w-4 h-4 text-amber-400" /> Letzte 10 verkaufte Gegenstände (Rückkaufbereit)
                    </h4>
                    <span className="text-[11px] text-gray-400">
                      Garantierter 1:1 Festpreis ohne Händleraufschlag
                    </span>
                  </div>

                  {localBuybackList.length === 0 ? (
                    <div className="p-8 rounded-xl bg-black/40 border border-gray-800 text-center space-y-2">
                      <Package className="w-10 h-10 text-gray-600 mx-auto" />
                      <div className="text-sm font-serif text-gray-300">Keine Gegenstände im Rückkauf-Speicher</div>
                      <p className="text-xs text-gray-500 max-w-md mx-auto">
                        Verkaufe Gegenstände aus deinem Inventar (rechte Leiste oder bei Händlern). Die letzten 10 verkauften Gegenstände verbleiben hier im Rückkauf.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {localBuybackList.map((record, idx) => {
                        const canAfford = playerStats.gold >= record.soldPrice;
                        const timeAgoMin = Math.max(0, Math.floor((Date.now() - record.soldAtTimestamp) / 60000));
                        return (
                          <div
                            key={record.id}
                            className="p-3.5 rounded-xl bg-black/60 border border-amber-500/20 hover:border-amber-400/50 transition-all flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gray-900 border border-gray-700 flex items-center justify-center text-xl shrink-0 shadow">
                                {record.item.icon || '📦'}
                              </div>
                              <div>
                                <div className="text-sm font-serif font-bold text-amber-100 flex items-center gap-2">
                                  #{idx + 1} {record.item.name}
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-mono font-bold ${
                                      record.item.rarity === 'legendary'
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                        : record.item.rarity === 'epic'
                                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                        : record.item.rarity === 'rare'
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                        : 'bg-gray-800 text-gray-300'
                                    }`}
                                  >
                                    {record.item.rarity || 'common'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-gray-400 flex items-center gap-3 mt-0.5">
                                  <span>{record.item.slot || 'misc'}</span>
                                  <span>•</span>
                                  <span>Vor {timeAgoMin === 0 ? 'wenigen Sekunden' : `${timeAgoMin} Min.`}</span>
                                  <span>•</span>
                                  <span className="text-gray-500">Hub: {record.soldToHubId}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <div className="text-xs text-gray-400">Rückkauf-Preis:</div>
                                <div className="text-sm font-mono font-bold text-amber-300 flex items-center justify-end gap-1">
                                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                                  {record.soldPrice} Gold
                                </div>
                              </div>

                              <button
                                onClick={() => handleBuybackItem(record)}
                                disabled={!canAfford}
                                className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-serif font-bold text-xs transition-all shadow disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Zurückkaufen
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right Col: Player inventory quick-sell drawer */}
                <div className="p-4 rounded-xl bg-black/50 border border-gray-800 flex flex-col space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                    <h4 className="text-xs font-serif font-bold text-gray-200 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-cyan-400" /> Spieler-Inventar (Schnellverkauf)
                    </h4>
                    <span className="text-[10px] font-mono text-gray-400">{playerInventory.length} Items</span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Klicke auf einen Gegenstand, um ihn an den Markt zu verkaufen. Er wird automatisch oben im 10-Plätze-Rückkauf registriert!
                  </p>

                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {playerInventory.length === 0 ? (
                      <div className="p-6 text-center text-xs text-gray-500 font-serif">
                        Inventar ist leer.
                      </div>
                    ) : (
                      playerInventory.map((item, idx) => {
                        const val = Math.max(1, Math.floor(item.valueGold || 10));
                        return (
                          <div
                            key={`${item.id}_${idx}`}
                            className="p-2 rounded-lg bg-gray-950/80 border border-gray-800 hover:border-cyan-400/50 flex items-center justify-between gap-2 transition-all"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-lg shrink-0">{item.icon || '📦'}</span>
                              <div className="truncate">
                                <div className="text-xs font-serif font-bold text-gray-200 truncate">{item.name}</div>
                                <div className="text-[10px] text-gray-500">{item.slot || 'misc'}</div>
                              </div>
                            </div>

                            <button
                              onClick={() => handleSellInventoryItem(item)}
                              className="px-2.5 py-1 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-bold shrink-0 cursor-pointer flex items-center gap-1"
                            >
                              +{val} G
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DYNAMIC ECONOMY PROCUREMENT QUESTS */}
          {activeTab === 'quests' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-cyan-950/30 to-amber-950/40 border border-amber-500/30 flex items-start gap-3">
                <Scroll className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-serif font-bold text-amber-200">
                    Emergente Handelsnotstands-Aufträge (Dynamic Shortage Quests)
                  </h3>
                  <p className="text-xs text-gray-300 mt-1">
                    Marktknoten mit kritischen Rohstoff-Engpässen schreiben automatisch hochdotierte
                    Versorgungsaufträge mit Goldprämien und Markstabilisierungs-Boni aus.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {Array.from(dynamicEconomyQuestEngine.activeQuests.values()).length === 0 ? (
                  <div className="p-8 text-center bg-black/40 rounded-xl border border-gray-800 text-gray-400 text-xs">
                    Aktuell sind alle regionalen Marktlager stabil versorgt. Keine akuten Handelsnotstände gemeldet.
                  </div>
                ) : (
                  Array.from(dynamicEconomyQuestEngine.activeQuests.values()).map((quest) => {
                    const commodity = COMMODITIES.find((c) => c.id === quest.resourceId);
                    const targetHub = economy.hubs.get(quest.targetHubId);
                    return (
                      <div
                        key={quest.id}
                        className="p-4 rounded-xl bg-black/60 border border-amber-500/30 hover:border-amber-400/60 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{quest.resourceIcon || '📦'}</span>
                            <span className="text-sm font-serif font-bold text-amber-100">{quest.title}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950/80 text-rose-300 border border-rose-500/40">
                              Kritischer Mangel
                            </span>
                          </div>
                          <p className="text-xs text-gray-300">{quest.description}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-400 font-mono pt-1">
                            <span>Zielort: <strong className="text-cyan-300">{quest.targetHubName || targetHub?.name}</strong></span>
                            <span>Bedarf: <strong className="text-amber-300">{quest.requiredQuantity}x {quest.resourceName}</strong></span>
                            <span>Ablauf: <strong className="text-gray-300">{Math.max(0, quest.deadlineTicks - economy.currentTick)} Ticks</strong></span>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 border-gray-800 pt-2 sm:pt-0">
                          <div className="text-right">
                            <div className="text-sm font-mono font-bold text-amber-300 flex items-center gap-1 justify-end">
                              <Coins className="w-4 h-4 text-amber-400" />
                              +{quest.goldReward.toLocaleString()} Gold
                            </div>
                            <div className="text-[10px] text-cyan-400 font-mono">
                              +{quest.reputationReward} Gilden-Ansehen
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              // Fulfill procurement quest
                              if (targetHub && commodity) {
                                targetHub.stock.set(
                                  commodity.id,
                                  (targetHub.stock.get(commodity.id) || 0) + quest.requiredQuantity
                                );
                              }
                              onPlayerGoldChange(playerStats.gold + quest.goldReward);
                              dynamicEconomyQuestEngine.activeQuests.delete(quest.id);
                              onShowMessage(
                                `Handelsnotstand erfüllt! +${quest.goldReward} Gold & Marktpreis in ${targetHub?.name} stabilisiert!`,
                                '#00f0ff'
                              );
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-950/90 hover:bg-amber-900 border border-amber-500/50 text-amber-200 text-xs font-serif font-bold transition-all cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.2)] flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                            Lieferung tätigen & Belohnung
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB: ROUTE SECURITY & HIGHWAY PATROLS */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/40 via-cyan-950/30 to-rose-950/40 border border-rose-500/30 flex items-start gap-3">
                <Sword className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-serif font-bold text-rose-200">
                    Handelsrouten-Sicherheit & Karawanen-Geleitschutz
                  </h3>
                  <p className="text-xs text-gray-300 mt-1">
                    Aktuelle Sicherheitslage der Überland-Handelskorridore in Aurion. Hohes Banditen-Risiko führt zu
                    Überfällen auf autonome NPC-Händler und Warenverlusten.
                  </p>
                </div>
              </div>

              {/* Highway Corridor Security Ratings */}
              <div className="space-y-3">
                <h4 className="text-xs font-serif font-bold text-amber-300 uppercase tracking-wider">
                  Überland-Handelskorridore
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Array.from(caravanSecuritySystem.routeReports.values()).map((report) => {
                    const hubA = economy.hubs.get(report.fromHub);
                    const hubB = economy.hubs.get(report.toHub);
                    const isSecure = report.securityIndex >= 70;
                    const isDanger = report.securityIndex < 40;

                    return (
                      <div
                        key={report.routeId}
                        className="p-4 rounded-xl bg-black/60 border border-gray-800 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-serif font-bold text-gray-100">
                            {hubA?.name || report.fromHub} ↔ {hubB?.name || report.toHub}
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                              isSecure
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-500/30'
                                : isDanger
                                ? 'bg-rose-950 text-rose-300 border-rose-500/30 animate-pulse'
                                : 'bg-amber-950 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {isSecure ? 'Gesichert' : isDanger ? 'Hohe Gefahr' : 'Mäßig'}
                          </span>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-400">Sicherheitsindex:</span>
                            <span
                              className={`font-mono font-bold ${
                                isSecure ? 'text-emerald-400' : isDanger ? 'text-rose-400' : 'text-amber-400'
                              }`}
                            >
                              {report.securityIndex.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-gray-900 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                isSecure
                                  ? 'bg-emerald-500'
                                  : isDanger
                                  ? 'bg-rose-500'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${report.securityIndex}%` }}
                            />
                          </div>
                        </div>

                        <div className="text-[10px] text-gray-400 flex items-center justify-between font-mono">
                          <span>Überfälle gemeldet: {report.activeRaiders.length}</span>
                          <button
                            onClick={() => {
                              report.securityIndex = Math.min(100, report.securityIndex + 20);
                              onShowMessage(
                                `Geleitschutz entsandt für Route ${hubA?.name} ↔ ${hubB?.name}! Sicherheitsindex +20%`,
                                '#10b981'
                              );
                            }}
                            className="px-2 py-1 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[9px] font-bold cursor-pointer"
                          >
                            Geleitschutz entsenden
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Bandit Raiders Status */}
              <div className="p-4 rounded-xl bg-black/60 border border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-serif font-bold text-rose-300 uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Aktive Wegelagerer & Banditen-Trupps ({caravanSecuritySystem.activeRaiders.length})
                  </h4>
                  <span className="text-[10px] text-gray-400 font-mono">
                    Visuelle Darstellung in 3D-Welt aktiv
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {caravanSecuritySystem.activeRaiders.length === 0 ? (
                    <div className="col-span-2 text-center text-xs text-gray-500 py-3">
                      Keine aktiven Wegelagerer auf den Hauptstraßen.
                    </div>
                  ) : (
                    caravanSecuritySystem.activeRaiders.map((raider) => (
                      <div
                        key={raider.id}
                        className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/20 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-serif font-bold text-rose-200">{raider.name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            Angriffskraft: <span className="text-amber-300">{raider.attackPower}</span> DMG
                          </div>
                        </div>
                        <div className="text-right font-mono text-xs">
                          <span className="text-rose-400">{raider.hp}/{raider.maxHp} HP</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CENSUS & DEMOGRAPHICS */}
          {activeTab === 'census' && (
            <div className="space-y-6">
              {/* Macro State Census Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/40 text-center">
                  <div className="text-2xl font-mono font-bold text-cyan-300">{commerceCount}</div>
                  <div className="text-xs font-serif font-bold text-cyan-200 mt-1">Handel & Karawanen</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Arbitrage-Export</div>
                </div>

                <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 text-center">
                  <div className="text-2xl font-mono font-bold text-amber-300">{productionCount}</div>
                  <div className="text-xs font-serif font-bold text-amber-200 mt-1">Rohstoff-Gewinnung</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Ernte & Bergbau</div>
                </div>

                <div className="p-4 rounded-xl bg-orange-950/30 border border-orange-500/40 text-center">
                  <div className="text-2xl font-mono font-bold text-orange-300">{survivalCount}</div>
                  <div className="text-xs font-serif font-bold text-orange-200 mt-1">Überleben / Notlage</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Hunger & Nahrungssuche</div>
                </div>

                <div className="p-4 rounded-xl bg-sky-950/30 border border-sky-500/40 text-center">
                  <div className="text-2xl font-mono font-bold text-sky-300">{defenseCount}</div>
                  <div className="text-xs font-serif font-bold text-sky-200 mt-1">Gilden-Miliz</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Patrouillen & Schutz</div>
                </div>
              </div>

              {/* Biological Need Gauges */}
              <div className="p-4 rounded-xl bg-black/60 border border-gray-800 space-y-4">
                <h3 className="text-sm font-serif font-bold text-amber-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Aggregierter biologischer Zustandsvektor
                </h3>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">Durchschnittlicher Hungerindex:</span>
                      <span className="font-mono text-orange-400">{avgHunger}%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-gray-900 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all duration-500"
                        style={{ width: `${avgHunger}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">Durchschnittliche Erschöpfung (Fatigue):</span>
                      <span className="font-mono text-cyan-400">{avgFatigue}%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-gray-900 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-indigo-500 transition-all duration-500"
                        style={{ width: `${avgFatigue}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Economic Global Summary Stats */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-black/40 border border-gray-800">
                  <div className="text-xs text-gray-400">Geburten (G2+)</div>
                  <div className="text-lg font-mono font-bold text-emerald-400">{economy.totalBirths}</div>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-gray-800">
                  <div className="text-xs text-gray-400">Verstorbene NPCs</div>
                  <div className="text-lg font-mono font-bold text-rose-400">{economy.totalDeaths}</div>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-gray-800">
                  <div className="text-xs text-gray-400">Handelsvolumen gesamt</div>
                  <div className="text-lg font-mono font-bold text-cyan-300">
                    {Math.round(economy.totalTradeVolumeCopper / 1000).toLocaleString()} G
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DYNASTIES & EVOLUTION */}
          {activeTab === 'evolution' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-black/60 border border-cyan-500/30 space-y-2">
                <h3 className="text-sm font-serif font-bold text-cyan-200 flex items-center gap-2">
                  <Dna className="w-4 h-4 text-cyan-400" /> Darwinistisches Vererbungssystem & Trait-Mutationen
                </h3>
                <p className="text-xs text-gray-300 leading-relaxed">
                  NPCs mit hohem Reichtum pflanzen sich bei Wohlstand fort. Nachkommen erben die Eigenschaften ihrer Ahnen
                  mit leichten Zufallsmutationen bei Handelsgeschick, Ernteertrag, Kampfzähigkeit und Genügsamkeit.
                </p>
              </div>

              {/* Top Merchant Dynasties */}
              <div className="space-y-3">
                <h4 className="text-xs font-serif font-bold text-amber-300 uppercase tracking-wider">
                  Führende Händler-Dynastien in Aurion
                </h4>
                <div className="space-y-2">
                  {topMerchants.map((merchant, idx) => (
                    <div
                      key={merchant.id}
                      className="p-3 rounded-xl bg-black/60 border border-gray-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-500/40 flex items-center justify-center font-mono font-bold text-amber-300 text-xs">
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="text-xs font-serif font-bold text-gray-100 flex items-center gap-2">
                            {merchant.name}
                            <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 font-mono text-[9px] border border-cyan-500/30">
                              Gen {merchant.generation}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400">
                            Heimat: {economy.hubs.get(merchant.homeHubId)?.name} | Status:{' '}
                            <span className="text-cyan-300">{merchant.macroState}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-amber-300">
                          {Math.round(merchant.wealthCopper / 1000).toLocaleString()} Gold
                        </div>
                        <div className="text-[9px] text-gray-400 font-mono">
                          Prowess: {merchant.traits.tradeProwess.toFixed(2)}x | Yield: {merchant.traits.harvestYield.toFixed(2)}x
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: GUILD TREASURIES & TARIFFS */}
          {activeTab === 'treasury' && (
            <div className="space-y-4">
              {hubsList.map((hub) => (
                <div
                  key={hub.id}
                  className="p-4 rounded-xl bg-black/60 border border-gray-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-serif font-bold text-amber-200">{hub.name}</h4>
                      <div className="text-xs text-gray-400">
                        Herrschende Fraktion: <span className="text-cyan-300 font-bold">{hub.controllingGuild}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Schatzkammer-Rücklagen:</div>
                      <div className="text-sm font-mono font-bold text-cyan-300">
                        {Math.round(hub.treasuryCopper / 1000).toLocaleString()} Gold
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-800/80 text-xs">
                    <div>
                      <span className="text-gray-400">Zolltarif:</span>{' '}
                      <strong className="text-amber-300 font-mono">{(hub.taxRateBasisPoints / 100).toFixed(1)}%</strong>
                    </div>
                    <div>
                      <span className="text-gray-400">Exportfokus:</span>{' '}
                      <strong className="text-gray-200">
                        {hub.productionFocus.map((id) => COMMODITIES.find((c) => c.id === id)?.name).join(', ')}
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-400">Importbedarf:</span>{' '}
                      <strong className="text-gray-200">
                        {hub.consumptionFocus.map((id) => COMMODITIES.find((c) => c.id === id)?.name).join(', ')}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
