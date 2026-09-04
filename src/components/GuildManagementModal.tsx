import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Crown,
  Building2,
  Users,
  Coins,
  Package,
  Scroll,
  CheckCircle2,
  Lock,
  Plus,
  ArrowUpRight,
  Sparkles,
  Sword,
  MapPin,
  Flag,
  X,
  ChevronRight,
  Layers,
  Pickaxe,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Award,
  BookOpen,
} from 'lucide-react';
import {
  GuildData,
  GuildKingdom,
  GuildMember,
  GuildBankItem,
  KingdomBuilding,
  ControlledTerritorySummary,
} from '../types/guild';
import { PlayerStats, RPGItem, WorldChunkData } from '../types';
import { createDefaultGuildData } from '../data/defaultGuildData';

interface GuildManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerStats: PlayerStats;
  onUpdatePlayerStats: (stats: Partial<PlayerStats>) => void;
  playerInventory: RPGItem[];
  onUpdatePlayerInventory: (inventory: RPGItem[]) => void;
  worldChunks?: WorldChunkData[];
  onConsolidateKingdomSuccess?: (result: { kingdomName: string; chunkKeys: string[] }) => void;
  onAddFloatingText?: (text: string, color?: string) => void;
  onAddChatMessage?: (channel: string, sender: string, text: string) => void;
}

type GuildTab = 'overview' | 'bank' | 'alliances' | 'goals' | 'kingdom';

export const GuildManagementModal: React.FC<GuildManagementModalProps> = ({
  isOpen,
  onClose,
  playerStats,
  onUpdatePlayerStats,
  playerInventory,
  onUpdatePlayerInventory,
  worldChunks = [],
  onConsolidateKingdomSuccess,
  onAddFloatingText,
  onAddChatMessage,
}) => {
  const [activeTab, setActiveTab] = useState<GuildTab>('overview');
  const [guild, setGuild] = useState<GuildData>(() => createDefaultGuildData());
  const [loading, setLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Bank Deposit/Withdraw inputs
  const [goldInput, setGoldInput] = useState<string>('250');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<RPGItem | null>(null);

  // Kingdom Consolidation States
  const [selectedChunkKeys, setSelectedChunkKeys] = useState<Set<string>>(new Set());
  const [customKingdomName, setCustomKingdomName] = useState<string>('Großkönigreich von Aurion');
  const [capitalKey, setCapitalKey] = useState<string>('0,0');
  const [isConsolidating, setIsConsolidating] = useState<boolean>(false);

  // Load guild data on open
  useEffect(() => {
    if (!isOpen) return;

    const fetchGuild = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/guild');
        if (res.ok) {
          const data = await res.json();
          if (data.guild) {
            setGuild(data.guild);
          }
        }
      } catch (err) {
        console.warn('Could not fetch guild from backend, using local store:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGuild();
  }, [isOpen]);

  // Aggregate controlled territories from player + guild NPCs
  const availableControlledLands: ControlledTerritorySummary[] = useMemo(() => {
    const list: ControlledTerritorySummary[] = [];

    // Map existing chunks for landmark names and biomes
    const chunkMap = new Map<string, WorldChunkData>();
    worldChunks.forEach((c) => chunkMap.set(c.chunkKey, c));

    // Player lands
    const playerLands = ['0,0']; // Sanctum / primary chunk
    playerLands.forEach((k) => {
      const c = chunkMap.get(k);
      list.push({
        chunkKey: k,
        chunkX: c?.chunkX ?? 0,
        chunkZ: c?.chunkZ ?? 0,
        landmarkName: c?.landmarkName || 'Aethelgard Sanctum (Hauptstadt)',
        biome: c?.biome || 'sanctum',
        ownerId: 'hero_player_1',
        ownerName: 'Hero (Gildenmeister)',
        ownerRole: 'player',
        stability: 100,
        guardCount: 4,
        areaSqMeters: 6400,
      });
    });

    // NPC lands of the same guild
    guild.members
      .filter((m) => m.isNPC && m.controlledTerritories && m.controlledTerritories.length > 0)
      .forEach((npc) => {
        npc.controlledTerritories.forEach((k) => {
          const c = chunkMap.get(k);
          const [cx, cz] = k.split(',').map(Number);
          list.push({
            chunkKey: k,
            chunkX: isNaN(cx) ? 0 : cx,
            chunkZ: isNaN(cz) ? 0 : cz,
            landmarkName: c?.landmarkName || `${npc.zone} Outpost`,
            biome: c?.biome || 'highland',
            ownerId: npc.id,
            ownerName: `${npc.name} (${npc.role})`,
            ownerRole: 'npc_ally',
            stability: 85,
            guardCount: 3,
            areaSqMeters: 6400,
          });
        });
      });

    return list;
  }, [guild.members, worldChunks]);

  // Auto-select first 6 or all controlled territories by default if empty
  useEffect(() => {
    if (availableControlledLands.length >= 6 && selectedChunkKeys.size === 0) {
      const initialSet = new Set<string>();
      availableControlledLands.slice(0, 6).forEach((land) => initialSet.add(land.chunkKey));
      setSelectedChunkKeys(initialSet);
    }
  }, [availableControlledLands]);

  const toggleSelectLand = (chunkKey: string) => {
    setSelectedChunkKeys((prev) => {
      const next = new Set(prev);
      if (next.has(chunkKey)) {
        next.delete(chunkKey);
      } else {
        next.add(chunkKey);
      }
      return next;
    });
  };

  const selectAllLands = () => {
    const all = new Set<string>();
    availableControlledLands.forEach((l) => all.add(l.chunkKey));
    setSelectedChunkKeys(all);
  };

  // Deposit Gold Handler
  const handleDepositGold = async (amountToDeposit: number) => {
    if (amountToDeposit <= 0) return;
    if (playerStats.gold < amountToDeposit) {
      setActionNotice('⚠️ Nicht genügend Gold in deiner Tasche!');
      return;
    }

    try {
      const res = await fetch('/api/guild/bank/deposit-gold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountToDeposit,
          playerName: 'Hero',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGuild(data.guild);
        onUpdatePlayerStats({ gold: playerStats.gold - amountToDeposit });
        setActionNotice(`🪙 ${amountToDeposit.toLocaleString()} Gold in die Gildenbank eingezahlt!`);
        onAddFloatingText?.(`+${amountToDeposit} Gold (Gildenbank)`, '#00f0ff');
      } else {
        const err = await res.json();
        setActionNotice(`Fehler: ${err.error || 'Fehlgeschlagen'}`);
      }
    } catch {
      // Fallback local update
      const updatedTreasury = guild.bank.treasuryGold + amountToDeposit;
      const updatedGuild: GuildData = {
        ...guild,
        bank: {
          ...guild.bank,
          treasuryGold: updatedTreasury,
          logs: [
            {
              id: 'log_' + Date.now(),
              timestamp: 'Gerade eben',
              action: 'deposit_gold',
              playerName: 'Hero',
              details: `Hat ${amountToDeposit.toLocaleString()} Gold in die Schatzkammer eingezahlt.`,
            },
            ...guild.bank.logs,
          ],
        },
      };
      setGuild(updatedGuild);
      onUpdatePlayerStats({ gold: playerStats.gold - amountToDeposit });
      setActionNotice(`🪙 ${amountToDeposit.toLocaleString()} Gold eingezahlt!`);
    }
  };

  // Withdraw Gold Handler
  const handleWithdrawGold = async (amountToWithdraw: number) => {
    if (amountToWithdraw <= 0) return;
    if (guild.bank.treasuryGold < amountToWithdraw) {
      setActionNotice('⚠️ Nicht genügend Gold in der Gildenbank!');
      return;
    }

    try {
      const res = await fetch('/api/guild/bank/withdraw-gold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountToWithdraw,
          playerName: 'Hero',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGuild(data.guild);
        onUpdatePlayerStats({ gold: playerStats.gold + amountToWithdraw });
        setActionNotice(`🪙 ${amountToWithdraw.toLocaleString()} Gold entnommen!`);
        onAddFloatingText?.(`+${amountToWithdraw} Gold erhalten`, '#fbbf24');
      } else {
        const err = await res.json();
        setActionNotice(`Fehler: ${err.error || 'Fehlgeschlagen'}`);
      }
    } catch {
      const updatedTreasury = guild.bank.treasuryGold - amountToWithdraw;
      const updatedGuild: GuildData = {
        ...guild,
        bank: {
          ...guild.bank,
          treasuryGold: updatedTreasury,
          logs: [
            {
              id: 'log_' + Date.now(),
              timestamp: 'Gerade eben',
              action: 'withdraw_gold',
              playerName: 'Hero',
              details: `Hat ${amountToWithdraw.toLocaleString()} Gold aus der Schatzkammer entnommen.`,
            },
            ...guild.bank.logs,
          ],
        },
      };
      setGuild(updatedGuild);
      onUpdatePlayerStats({ gold: playerStats.gold + amountToWithdraw });
      setActionNotice(`🪙 ${amountToWithdraw.toLocaleString()} Gold entnommen!`);
    }
  };

  // Deposit Item Handler
  const handleDepositItem = async () => {
    if (!selectedInventoryItem) return;

    try {
      const res = await fetch('/api/guild/bank/deposit-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: selectedInventoryItem,
          playerName: 'Hero',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGuild(data.guild);
        // Remove item from inventory
        const newInv = [...playerInventory];
        const idx = newInv.findIndex((i) => i.id === selectedInventoryItem.id);
        if (idx >= 0) newInv.splice(idx, 1);
        onUpdatePlayerInventory(newInv);
        setSelectedInventoryItem(null);
        setActionNotice(`📦 [${selectedInventoryItem.name}] eingelagert!`);
      }
    } catch {
      // Fallback
      const newBankItem: GuildBankItem = {
        id: 'gbank_' + Date.now(),
        name: selectedInventoryItem.name,
        rarity: selectedInventoryItem.rarity,
        icon: selectedInventoryItem.icon,
        type: selectedInventoryItem.slot,
        quantity: 1,
        itemData: selectedInventoryItem,
        depositedBy: 'Hero',
        depositedAt: 'Gerade eben',
      };
      setGuild((prev) => ({
        ...prev,
        bank: {
          ...prev.bank,
          items: [...prev.bank.items, newBankItem],
          logs: [
            {
              id: 'log_' + Date.now(),
              timestamp: 'Gerade eben',
              action: 'deposit_item',
              playerName: 'Hero',
              details: `Hat [${selectedInventoryItem.name}] eingelagert.`,
            },
            ...prev.bank.logs,
          ],
        },
      }));
      const newInv = [...playerInventory];
      const idx = newInv.findIndex((i) => i.id === selectedInventoryItem.id);
      if (idx >= 0) newInv.splice(idx, 1);
      onUpdatePlayerInventory(newInv);
      setSelectedInventoryItem(null);
      setActionNotice(`📦 [${selectedInventoryItem.name}] eingelagert!`);
    }
  };

  // Withdraw Item Handler
  const handleWithdrawItem = async (bankItem: GuildBankItem) => {
    try {
      const res = await fetch('/api/guild/bank/withdraw-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: bankItem.id,
          playerName: 'Hero',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGuild(data.guild);
        onUpdatePlayerInventory([...playerInventory, bankItem.itemData]);
        setActionNotice(`📦 [${bankItem.name}] ins Inventar gelegt!`);
      }
    } catch {
      setGuild((prev) => ({
        ...prev,
        bank: {
          ...prev.bank,
          items: prev.bank.items.filter((i) => i.id !== bankItem.id),
          logs: [
            {
              id: 'log_' + Date.now(),
              timestamp: 'Gerade eben',
              action: 'withdraw_item',
              playerName: 'Hero',
              details: `Hat [${bankItem.name}] entnommen.`,
            },
            ...prev.bank.logs,
          ],
        },
      }));
      onUpdatePlayerInventory([...playerInventory, bankItem.itemData]);
      setActionNotice(`📦 [${bankItem.name}] ins Inventar gelegt!`);
    }
  };

  // Consolidate Kingdom Handler (The core user requirement!)
  const handleConsolidateKingdom = async () => {
    const chunkArray = Array.from(selectedChunkKeys);
    if (chunkArray.length < 6) {
      setActionNotice('⚠️ Mindestens 6 kontrollierte Gebiete müssen ausgewählt sein!');
      return;
    }

    setIsConsolidating(true);
    try {
      const res = await fetch('/api/guild/consolidate-kingdom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kingdomName: customKingdomName.trim() || 'Großkönigreich von Aurion',
          bannerIcon: '👑',
          bannerColor: '#00f0ff',
          chunkKeys: chunkArray,
          capitalChunkKey: capitalKey,
          rulerName: 'Hero',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGuild((prev) => ({ ...prev, kingdom: data.kingdom }));
        setActionNotice(`👑 ${data.message}`);
        onConsolidateKingdomSuccess?.({
          kingdomName: data.kingdom.name,
          chunkKeys: data.mergedChunks,
        });
        onAddFloatingText?.(`👑 Großes Königreich Proklamiert! (${chunkArray.length} Gebiete)`, '#00f0ff');
        onAddChatMessage?.(
          'guild',
          'Königlicher Herold',
          `👑 Heil dem neuen Souverän! Die Länder (${chunkArray.join(', ')}) wurden feierlich unter der Gildenleitung zum '${data.kingdom.name}' vereinigt!`
        );
      } else {
        const err = await res.json();
        setActionNotice(`⚠️ Fehler: ${err.error || 'Zusammenlegung fehlgeschlagen'}`);
      }
    } catch (e: any) {
      console.error('Consolidation error:', e);
      setActionNotice('⚠️ Verbindung zum Server fehlgeschlagen.');
    } finally {
      setIsConsolidating(false);
    }
  };

  // Upgrade Kingdom Building Handler
  const handleUpgradeBuilding = async (buildingId: string) => {
    try {
      const res = await fetch('/api/guild/kingdom/upgrade-building', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildingId,
          playerName: 'Hero',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGuild(data.guild);
        setActionNotice(`🏰 [${data.building.name}] erfolgreich auf Stufe ${data.building.level} ausgebaut!`);
        onAddFloatingText?.(`🏰 Bauwerk Stufe ${data.building.level}!`, '#10b981');
      } else {
        const err = await res.json();
        setActionNotice(`⚠️ ${err.error}`);
      }
    } catch {
      setActionNotice('⚠️ Ausbau-Anfrage fehlgeschlagen.');
    }
  };

  // Donate Resources to Kingdom
  const handleDonateResources = async () => {
    try {
      const res = await fetch('/api/guild/kingdom/donate-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resources: { wood: 100, stone: 80, aether: 50, crops: 60 },
          playerName: 'Hero',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGuild(data.guild);
        setActionNotice('🪵 Ressourcen erfolgreich an das Königreich gespendet!');
        onAddFloatingText?.('+Ressourcen gespendet!', '#00f0ff');
      }
    } catch {
      setActionNotice('⚠️ Spende fehlgeschlagen.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="guild-management-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md"
    >
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-[#081325] border border-amber-900/60 shadow-[0_0_40px_rgba(0,240,255,0.15)] overflow-hidden text-slate-200">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-gradient-to-r from-[#0a1b33] via-[#0d2242] to-[#0a1b33] border-b border-amber-900/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shadow-md">
              <Shield className="w-5 h-5 text-[#00f0ff]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-serif font-bold text-amber-100 tracking-wide">
                  {guild.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-950/80 border border-cyan-500/40 text-[#00f0ff]">
                  {guild.tag}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-amber-950/80 border border-amber-500/40 text-amber-300">
                  Stufe {guild.level}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-sm sm:max-w-xl">
                {guild.motd}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Schließen [Escape]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Notice Toast */}
        {actionNotice && (
          <div className="px-4 py-2 bg-gradient-to-r from-cyan-950/90 via-slate-900/90 to-cyan-950/90 border-b border-cyan-500/40 text-xs text-cyan-200 flex items-center justify-between animate-fadeIn">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5 text-[#00f0ff]" />
              <span>{actionNotice}</span>
            </div>
            <button
              onClick={() => setActionNotice(null)}
              className="text-slate-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto scrollbar-none px-4 sm:px-6 py-2 bg-[#050e1d] border-b border-slate-800/80 space-x-1 sm:space-x-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-amber-500/15 border border-amber-500/50 text-amber-200 shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Übersicht & Mitglieder ({guild.members.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('bank')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'bank'
                ? 'bg-amber-500/15 border border-amber-500/50 text-amber-200 shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Coins className="w-4 h-4 text-amber-400" />
            <span>Gildenbank & Tresor</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950 text-amber-300">
              🪙 {guild.bank.treasuryGold.toLocaleString()}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('alliances')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'alliances'
                ? 'bg-amber-500/15 border border-amber-500/50 text-amber-200 shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Flag className="w-4 h-4 text-sky-400" />
            <span>Allianzen ({guild.alliances.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('goals')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'goals'
                ? 'bg-amber-500/15 border border-amber-500/50 text-amber-200 shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Scroll className="w-4 h-4 text-emerald-400" />
            <span>Ziele ({guild.goals.length})</span>
          </button>

          {/* Tab 5: The Core Requirement: Kingdom & Territory Consolidation */}
          <button
            onClick={() => setActiveTab('kingdom')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center space-x-2 whitespace-nowrap cursor-pointer relative ${
              activeTab === 'kingdom'
                ? 'bg-cyan-500/20 border border-[#00f0ff] text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.25)]'
                : 'text-cyan-300 hover:text-white hover:bg-cyan-950/40 border border-cyan-900/40'
            }`}
          >
            <Crown className="w-4 h-4 text-[#00f0ff]" />
            <span>Länder-Zusammenlegung & Königreich</span>
            {guild.kingdom ? (
              <span className="w-2 h-2 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
            ) : availableControlledLands.length >= 6 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500 text-black font-bold">
                6+ Bereit
              </span>
            ) : null}
          </button>
        </div>

        {/* Tab Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: OVERVIEW & ROSTER */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Guild Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-medium">Gilden-Stufe & XP</div>
                  <div className="text-lg font-bold text-amber-200 mt-1">Stufe {guild.level}</div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-amber-400 h-full rounded-full"
                      style={{ width: `${Math.min(100, (guild.xp / guild.xpToNextLevel) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 font-mono">
                    {guild.xp} / {guild.xpToNextLevel} XP
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-medium">Gildenbank-Gold</div>
                  <div className="text-lg font-bold text-amber-300 mt-1">
                    🪙 {guild.bank.treasuryGold.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2 font-mono">
                    {guild.bank.items.length} / {guild.bank.maxSlots} Fächer belegt
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-medium">Mitglieder (Spieler & NPCs)</div>
                  <div className="text-lg font-bold text-cyan-200 mt-1">
                    {guild.members.length} Recken
                  </div>
                  <div className="text-[10px] text-cyan-400/80 mt-2">
                    {guild.members.filter((m) => !m.isNPC).length} Spieler •{' '}
                    {guild.members.filter((m) => m.isNPC).length} Gilden-NPCs
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-medium">Kontrollierte Länder</div>
                  <div className="text-lg font-bold text-emerald-300 mt-1">
                    {availableControlledLands.length} Gebiete
                  </div>
                  <div className="text-[10px] text-emerald-400/80 mt-2">
                    {guild.kingdom ? '👑 Zum Königreich vereint' : 'Bereit zur Zusammenlegung (ab 6)'}
                  </div>
                </div>
              </div>

              {/* Roster Table */}
              <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
                <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-amber-100 flex items-center space-x-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>Gilden-Rostereintragsliste</span>
                  </h3>
                  <span className="text-xs text-slate-400">
                    Gildenleitung & Vasallen (Spieler & treue Gebiets-NPCs)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4">Name & Wappen</th>
                        <th className="py-2.5 px-3">Rang</th>
                        <th className="py-2.5 px-3">Klasse / Stufe</th>
                        <th className="py-2.5 px-3">Kontrollierte Gebiete</th>
                        <th className="py-2.5 px-3">Beitrag (Gold)</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {guild.members.map((member) => (
                        <tr key={member.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 flex items-center space-x-2.5">
                            <span className="text-lg">{member.avatarIcon}</span>
                            <div>
                              <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
                                <span>{member.name}</span>
                                {member.isNPC && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                    NPC
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">{member.zone}</div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                member.role === 'Guild Master'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : member.role === 'Officer'
                                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {member.role}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono">
                            <span className="capitalize">{member.classId}</span> (Lv. {member.level})
                          </td>
                          <td className="py-3 px-3">
                            {member.controlledTerritories && member.controlledTerritories.length > 0 ? (
                              <div className="flex items-center space-x-1 text-emerald-400">
                                <MapPin className="w-3.5 h-3.5" />
                                <span>{member.controlledTerritories.join(', ')}</span>
                              </div>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-amber-300">
                            🪙 {member.contributedGold.toLocaleString()}
                          </td>
                          <td className="py-3 px-3">
                            <span className="flex items-center space-x-1.5 text-emerald-400 font-medium text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>Aktiv</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GUILD BANK & SHARED VAULT */}
          {activeTab === 'bank' && (
            <div className="space-y-6">
              {/* Treasury Section */}
              <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-900/60 to-slate-900/60 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl shadow">
                    🪙
                  </div>
                  <div>
                    <div className="text-xs text-amber-300/80 font-semibold tracking-wider uppercase">
                      Gilden-Schatzkammer
                    </div>
                    <div className="text-2xl font-bold font-mono text-amber-200 mt-0.5">
                      {guild.bank.treasuryGold.toLocaleString()} <span className="text-sm font-normal text-amber-400">Gold</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Dein persönliches Gold: <span className="font-mono text-amber-300">{playerStats.gold.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Gold Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    value={goldInput}
                    onChange={(e) => setGoldInput(e.target.value)}
                    className="w-24 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-amber-200 focus:outline-none focus:border-amber-500"
                    placeholder="Betrag"
                  />
                  <button
                    onClick={() => handleDepositGold(parseInt(goldInput, 10) || 100)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/60 hover:bg-amber-500/30 text-amber-200 text-xs font-semibold transition-all cursor-pointer shadow"
                  >
                    + Einzahlen
                  </button>
                  <button
                    onClick={() => handleWithdrawGold(parseInt(goldInput, 10) || 100)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-amber-400 text-slate-200 hover:text-amber-200 text-xs font-semibold transition-all cursor-pointer"
                  >
                    - Abheben
                  </button>
                  <button
                    onClick={() => handleDepositGold(1000)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-[11px] font-mono text-amber-300 cursor-pointer"
                  >
                    +1.000
                  </button>
                </div>
              </div>

              {/* Shared Vault Grid & Deposit from Inventory */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Vault Items (Left 2 cols) */}
                <div className="lg:col-span-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                      <Package className="w-4 h-4 text-[#00f0ff]" />
                      <span>Gemeinschaftliches Tresorfach</span>
                    </h3>
                    <span className="text-xs text-slate-400 font-mono">
                      {guild.bank.items.length} / {guild.bank.maxSlots} Fächer
                    </span>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800 min-h-[220px]">
                    {guild.bank.items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleWithdrawItem(item)}
                        className={`group relative p-2 rounded-xl bg-slate-950/80 border transition-all cursor-pointer flex flex-col items-center justify-center text-center hover:scale-105 ${
                          item.rarity === 'legendary'
                            ? 'border-amber-500/70 hover:shadow-[0_0_12px_#f59e0b]'
                            : item.rarity === 'epic'
                            ? 'border-purple-500/70 hover:shadow-[0_0_12px_#a855f7]'
                            : item.rarity === 'rare'
                            ? 'border-cyan-500/70 hover:shadow-[0_0_12px_#00f0ff]'
                            : 'border-slate-800 hover:border-slate-600'
                        }`}
                        title={`${item.name} (${item.rarity}) - Klicke zum Abheben`}
                      >
                        <span className="text-2xl">{item.icon}</span>
                        <span className="text-[10px] font-medium text-slate-300 truncate w-full mt-1">
                          {item.name}
                        </span>
                        {item.quantity > 1 && (
                          <span className="absolute top-1 right-1 px-1 rounded bg-black/80 font-mono text-[9px] font-bold text-cyan-300 border border-slate-800">
                            x{item.quantity}
                          </span>
                        )}
                        <span className="absolute -bottom-1 text-[8px] opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 px-1 rounded text-amber-300">
                          Abheben
                        </span>
                      </div>
                    ))}

                    {/* Empty Slots */}
                    {Array.from({ length: Math.max(0, guild.bank.maxSlots - guild.bank.items.length) }).map(
                      (_, idx) => (
                        <div
                          key={`empty_${idx}`}
                          className="h-16 rounded-xl bg-slate-950/30 border border-dashed border-slate-800/80 flex items-center justify-center text-slate-700"
                        >
                          <span className="text-xs font-mono">{guild.bank.items.length + idx + 1}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Deposit from player bag (Right col) */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                    <ArrowUpRight className="w-4 h-4 text-amber-400" />
                    <span>Aus Inventar einlagern</span>
                  </h3>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 max-h-[220px] overflow-y-auto space-y-1.5 scrollbar-thin">
                    {playerInventory.length === 0 ? (
                      <div className="text-xs text-slate-500 text-center py-6">
                        Dein persönliches Inventar ist leer.
                      </div>
                    ) : (
                      playerInventory.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => setSelectedInventoryItem(item)}
                          className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                            selectedInventoryItem?.id === item.id
                              ? 'bg-amber-500/15 border-amber-500 text-amber-100'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <span className="text-base">{item.icon}</span>
                            <span className="truncate">{item.name}</span>
                          </div>
                          <span className="text-[10px] uppercase font-mono text-slate-500">
                            {item.rarity}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {selectedInventoryItem && (
                    <button
                      onClick={handleDepositItem}
                      className="w-full py-2 rounded-xl bg-amber-500/20 border border-amber-500/60 hover:bg-amber-500/30 text-amber-200 text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow"
                    >
                      <Plus className="w-4 h-4" />
                      <span>[{selectedInventoryItem.name}] ins Tresorfach legen</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Transaction Logs */}
              <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center space-x-2">
                    <Scroll className="w-3.5 h-3.5 text-amber-400" />
                    <span>Gildenbank-Protokoll & Rechnungsbuch</span>
                  </span>
                  <span className="text-[11px] text-slate-500">Letzte Aktivitäten</span>
                </div>
                <div className="divide-y divide-slate-800/40 max-h-48 overflow-y-auto">
                  {guild.bank.logs.map((log) => (
                    <div key={log.id} className="px-4 py-2 text-xs flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-amber-200">{log.playerName}:</span>
                        <span className="text-slate-300">{log.details}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">{log.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ALLIANCES */}
          {activeTab === 'alliances' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-amber-100 flex items-center space-x-2">
                    <Flag className="w-4 h-4 text-sky-400" />
                    <span>Bündnisse & Diplomatischer Pakt</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Gegenseitiger Schutz, Grenzwachenunterstützung und offene Handelswege zwischen den Reichen.
                  </p>
                </div>
                <button
                  onClick={() =>
                    setActionNotice('Diplomatischer Gesandter wurde zu den verbündeten Außenposten entsandt!')
                  }
                  className="px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-500/50 hover:bg-sky-500/30 text-sky-200 text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Neues Bündnis Verhandeln</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {guild.alliances.map((ally) => (
                  <div
                    key={ally.id}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-500/30">
                          {ally.targetGuildTag}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            ally.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {ally.status === 'active' ? 'Aktives Bündnis' : 'Waffenstillstand'}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-100 mt-2">{ally.targetGuildName}</h4>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Anführer: <span className="text-slate-300">{ally.leaderName}</span>
                      </div>
                      <p className="text-xs text-sky-200/90 mt-2.5 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                        {ally.bonusDescription}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{ally.sharedTerritoriesCount} geteilte Grenzgebiete</span>
                      <span>{ally.formedAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: COMMON GOALS */}
          {activeTab === 'goals' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-amber-100 flex items-center space-x-2">
                    <Scroll className="w-4 h-4 text-emerald-400" />
                    <span>Gemeinsame Gilden-Ziele & Expeditionen</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Erfüllt kollektive Meilensteine, um Gilden-Erfahrung, Schatzkammer-Gold und Reichsbuffs freizuschalten.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {guild.goals.map((goal) => {
                  const pct = Math.min(100, Math.round((goal.currentProgress / goal.targetProgress) * 100));
                  return (
                    <div
                      key={goal.id}
                      className={`p-4 rounded-xl border transition-all ${
                        goal.completed
                          ? 'bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-200">{goal.title}</span>
                        {goal.completed ? (
                          <span className="flex items-center space-x-1 text-emerald-400 text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Erfüllt</span>
                          </span>
                        ) : (
                          <span className="text-xs font-mono text-amber-300 font-bold">
                            {pct}%
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 mt-1.5">{goal.description}</p>

                      <div className="w-full bg-slate-950 h-2 rounded-full mt-3 overflow-hidden border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            goal.completed ? 'bg-emerald-400' : 'bg-gradient-to-r from-amber-500 to-cyan-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between mt-2 text-[11px]">
                        <span className="text-slate-400 font-mono">
                          Fortschritt: {goal.currentProgress} / {goal.targetProgress} {goal.unit}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-cyan-300 font-mono">+{goal.rewardGuildXp} XP</span>
                          <span className="text-amber-300 font-mono">🪙 +{goal.rewardGold}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: TERRITORY CONSOLIDATION & KINGDOM (THE MAIN USER REQUIREMENT) */}
          {activeTab === 'kingdom' && (
            <div className="space-y-6">
              {/* If Kingdom is already proclaimed: Display Sovereign Kingdom Management */}
              {guild.kingdom ? (
                <div className="space-y-6">
                  {/* Proclaimed Kingdom Banner */}
                  <div className="relative p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#071d3a] via-[#092b52] to-[#071d3a] border border-[#00f0ff]/50 shadow-[0_0_30px_rgba(0,240,255,0.2)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-[#00f0ff] flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(0,240,255,0.4)]">
                        👑
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h2 className="text-xl font-serif font-bold text-amber-100 tracking-wide">
                            {guild.kingdom.name}
                          </h2>
                          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-950 text-[#00f0ff] border border-cyan-500/40">
                            Stufe {guild.kingdom.kingdomLevel}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 mt-1">
                          Souverän: <span className="font-semibold text-amber-300">{guild.kingdom.rulerName}</span> ({guild.kingdom.rulerRole}) • Hauptstadt: <span className="text-cyan-300">{guild.kingdom.capitalLandmarkName}</span>
                        </div>
                        <div className="text-xs text-cyan-200 mt-1 flex items-center space-x-2">
                          <MapPin className="w-3.5 h-3.5 text-[#00f0ff]" />
                          <span>
                            {guild.kingdom.mergedChunkKeys.length} vereinte Gebiete • {guild.kingdom.totalTerritoryAreaSqMeters.toLocaleString()} m² Reichsterritorium
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="px-3 py-2 rounded-xl bg-slate-950/70 border border-cyan-500/30 text-center">
                        <div className="text-[10px] text-slate-400">Verteidigungswert</div>
                        <div className="text-base font-bold font-mono text-[#00f0ff]">
                          🛡️ {guild.kingdom.defenseRating}
                        </div>
                      </div>
                      <div className="px-3 py-2 rounded-xl bg-slate-950/70 border border-cyan-500/30 text-center">
                        <div className="text-[10px] text-slate-400">Gebietsstabilität</div>
                        <div className="text-base font-bold font-mono text-emerald-300">
                          100%
                        </div>
                      </div>
                      <div className="px-3 py-2 rounded-xl bg-slate-950/70 border border-cyan-500/30 text-center">
                        <div className="text-[10px] text-slate-400">Königliche Abgaben</div>
                        <div className="text-base font-bold font-mono text-amber-300">
                          +{guild.kingdom.passiveIncomeGoldPerHour} G/h
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Kingdom Construction Treasury & Donation */}
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-300">
                        <Pickaxe className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">
                          Königreichs-Bauressourcen (Ausbau & Unterhalt)
                        </div>
                        <div className="flex items-center space-x-4 text-xs font-mono mt-1">
                          <span className="text-amber-200">🪵 Holz: {guild.kingdom.resources.wood}</span>
                          <span className="text-slate-300">🪨 Stein: {guild.kingdom.resources.stone}</span>
                          <span className="text-[#00f0ff]">💎 Türkis-Aether: {guild.kingdom.resources.aether}</span>
                          <span className="text-emerald-300">🌾 Nahrung: {guild.kingdom.resources.crops}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleDonateResources}
                      className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/60 hover:bg-cyan-500/30 text-[#00f0ff] text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Ressourcen aus Inventar Spenden</span>
                    </button>
                  </div>

                  {/* Upgradable Kingdom Buildings */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-amber-100 flex items-center space-x-2">
                      <Building2 className="w-4 h-4 text-amber-400" />
                      <span>Königreich-Bauwerke & Monumente (Ausbau mit Ressourcen)</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {guild.kingdom.buildings.map((bld) => {
                        const canAfford =
                          guild.bank.treasuryGold >= bld.cost.gold &&
                          guild.kingdom!.resources.wood >= bld.cost.wood &&
                          guild.kingdom!.resources.stone >= bld.cost.stone &&
                          guild.kingdom!.resources.aether >= bld.cost.aether;

                        return (
                          <div
                            key={bld.id}
                            className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                              bld.built
                                ? 'bg-slate-900/80 border-cyan-500/30 shadow-[0_0_15px_rgba(0,240,255,0.05)]'
                                : 'bg-slate-950/60 border-slate-800/80'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2.5">
                                  <span className="text-2xl">{bld.icon}</span>
                                  <div>
                                    <h4 className="text-sm font-bold text-slate-100">{bld.name}</h4>
                                    <span className="text-[10px] font-mono text-cyan-300">
                                      Stufe {bld.level} / {bld.maxLevel}
                                    </span>
                                  </div>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                    bld.built
                                      ? 'bg-cyan-950 text-[#00f0ff] border border-cyan-500/40'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {bld.built ? 'Errichtet' : 'Nicht gebaut'}
                                </span>
                              </div>

                              <p className="text-xs text-slate-400 mt-2">{bld.description}</p>

                              <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-xs text-cyan-200 mt-2.5">
                                <span className="font-semibold text-[#00f0ff]">Reichsbonus:</span> {bld.perk}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                              <div className="text-[10px] font-mono text-slate-400 space-y-0.5">
                                <div>Kosten für Stufe {bld.level + 1}:</div>
                                <div className="text-amber-300">🪙 {bld.cost.gold} Gold • 🪵 {bld.cost.wood} Holz</div>
                                <div className="text-slate-300">🪨 {bld.cost.stone} Stein • 💎 {bld.cost.aether} Äther</div>
                              </div>

                              <button
                                onClick={() => handleUpgradeBuilding(bld.id)}
                                disabled={bld.level >= bld.maxLevel || !canAfford}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow ${
                                  bld.level >= bld.maxLevel
                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    : canAfford
                                    ? 'bg-gradient-to-r from-amber-500 to-cyan-500 text-black font-bold hover:scale-102 active:scale-95 shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                                }`}
                              >
                                {bld.level >= bld.maxLevel ? (
                                  <span>Max Stufe</span>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>{bld.level === 0 ? 'Errichten' : 'Ausbauen'}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* Proclamation & Consolidation Flow: Merge 6+ territories into a Kingdom */
                <div className="space-y-6">
                  {/* Informational Guidance Box */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-[#08182f] via-[#0d2340] to-[#08182f] border border-cyan-500/30">
                    <div className="flex items-center space-x-3">
                      <Crown className="w-7 h-7 text-[#00f0ff] flex-shrink-0" />
                      <div>
                        <h3 className="text-sm sm:text-base font-serif font-bold text-amber-100">
                          Reichsgründung: Länder-Zusammenlegung zu einem gemeinsamen Königreich
                        </h3>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          Spieler und NPCs der gleichen Gilde können ihre kontrollierten Länder vereinen!
                          Sobald mindestens <strong>6 Gebiete</strong> ausgewählt sind, werden sie zu einem großen
                          gemeinsamen Königreich verschmolzen, das der Gildenleitung untersteht und mit Ressourcen
                          monumental ausgebaut werden kann.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Territories Selection Panel */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-sm font-semibold text-slate-200">
                          Kontrollierte Gebiete von Spielern & Gilden-NPCs
                        </h4>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300">
                          {selectedChunkKeys.size} / 6 Gebiete ausgewählt
                        </span>
                      </div>

                      <button
                        onClick={selectAllLands}
                        className="text-xs text-cyan-300 hover:text-white underline cursor-pointer"
                      >
                        Alle verfügbaren Länder auswählen
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {availableControlledLands.map((land) => {
                        const isSelected = selectedChunkKeys.has(land.chunkKey);
                        return (
                          <div
                            key={land.chunkKey}
                            onClick={() => toggleSelectLand(land.chunkKey)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                              isSelected
                                ? 'bg-cyan-950/40 border-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.15)]'
                                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-xs text-cyan-400 font-bold">
                                  Chunk [{land.chunkKey}]
                                </span>
                                <span
                                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                    isSelected
                                      ? 'bg-[#00f0ff] text-black shadow-[0_0_6px_#00f0ff]'
                                      : 'border border-slate-600 text-transparent'
                                  }`}
                                >
                                  ✓
                                </span>
                              </div>
                              <div className="text-sm font-semibold text-slate-200 mt-1 truncate">
                                {land.landmarkName}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Verwalter: <span className="text-amber-200">{land.ownerName}</span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
                              <span>Fläche: {land.areaSqMeters} m²</span>
                              <span className="text-emerald-400">Stabilität: {land.stability}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Proclamation Action Box */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-[#0a1f38] to-slate-900 border border-amber-500/40 shadow-lg space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-amber-200">
                          Name des neuen vereinten Königreichs:
                        </label>
                        <input
                          type="text"
                          value={customKingdomName}
                          onChange={(e) => setCustomKingdomName(e.target.value)}
                          placeholder="z.B. Großkönigreich von Aurion"
                          className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm font-serif font-bold text-amber-100 focus:outline-none focus:border-[#00f0ff]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-300">
                          Hauptstadt des Reiches:
                        </label>
                        <select
                          value={capitalKey}
                          onChange={(e) => setCapitalKey(e.target.value)}
                          className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#00f0ff]"
                        >
                          {availableControlledLands.map((l) => (
                            <option key={l.chunkKey} value={l.chunkKey}>
                              {l.landmarkName} [{l.chunkKey}]
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between pt-2 border-t border-slate-800/80 gap-3">
                      <div className="text-xs text-slate-300">
                        {selectedChunkKeys.size >= 6 ? (
                          <span className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              Bedingung erfüllt ({selectedChunkKeys.size} von 6 Gebieten)! Gesamtfläche:{' '}
                              <strong className="font-mono text-white">
                                {(selectedChunkKeys.size * 6400).toLocaleString()} m²
                              </strong>
                            </span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-1.5 text-amber-400">
                            <AlertCircle className="w-4 h-4" />
                            <span>
                              Noch {6 - selectedChunkKeys.size} weiteres Gebiet nötig, um ein Königreich zu gründen.
                            </span>
                          </span>
                        )}
                      </div>

                      <button
                        onClick={handleConsolidateKingdom}
                        disabled={selectedChunkKeys.size < 6 || isConsolidating}
                        className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                          selectedChunkKeys.size >= 6 && !isConsolidating
                            ? 'bg-gradient-to-r from-amber-500 via-[#00f0ff] to-amber-500 text-black shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:scale-102 active:scale-95'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        }`}
                      >
                        <Crown className="w-4 h-4" />
                        <span>
                          {isConsolidating
                            ? 'Vereinigung läuft...'
                            : `👑 Großes Königreich Proklamieren (${selectedChunkKeys.size} Länder)`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 bg-[#050e1d] border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
            <span>Gilden-Synchronisation aktiv • Tastaturkürzel [G]</span>
          </div>

          <div className="flex items-center space-x-2 font-mono text-slate-300">
            <span>🪙 Dein Gold: {playerStats.gold.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
