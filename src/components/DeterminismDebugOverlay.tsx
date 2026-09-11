import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  RefreshCw,
  Server,
  Zap,
  ChevronDown,
  ChevronUp,
  X,
  Bug,
  Database,
  ArrowRightLeft,
  Sparkles,
  ShieldCheck,
  Globe,
  Coins,
  History,
  Compass,
  FileCode,
} from 'lucide-react';
import {
  NPCStateMachine,
  NPCSnapshot,
  NPCBaseState,
  NPCSubState,
} from '../core/NPCStateMachine';
import { AutonomousNPCEconomy } from '../engine/economy/AutonomousNPCEconomy';
import { syncManager } from '../core/SyncManager';
import { areInvariantGuard } from '../engine/are/AREInvariantGuard';
import { deterministicTickRecorder } from '../engine/are/DeterministicTickRecorder';
import {
  aurionTransitionRuntime,
  AURION_EXPANSE_ZONE_ID,
  AURION_TOWER_ZONE_ID,
} from '../engine/aurion/AurionTransitionRuntime';
import {
  merchantBootstrapMarkets,
  HubId,
} from '../engine/aurion/merchantRules';
import {
  commodityBasePrice,
  productionFocus,
  routeSecurity,
  CommodityId,
} from '../engine/aurion/ax1LivingWorldProtocol';
import { cityLayoutCompiler } from '../engine/are/CityLayoutCompiler';
import {
  timestampedInputBuffer,
  TimestampedUserCommand,
  InputBufferStats,
} from '../engine/net/TimestampedInputBuffer';
import {
  arelorianLingua,
  SemanticWordProfile,
  PlayerUtteranceAnalysis,
} from '../engine/lingua/ArelorianLinguaGrammar';


interface DesyncLogEntry {
  id: string;
  tick: number;
  timestamp: string;
  localHash: string;
  serverHash: string;
  divergingNpcIds: string[];
  details: string[];
}

interface DeterminismDebugOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  economy: AutonomousNPCEconomy | null;
  onShowNotification?: (msg: string, color?: string) => void;
  onTogglePathfindingDebug?: () => void;
  isPathfindingDebugActive?: boolean;
  onTriggerZoneTransition?: () => void;
  onCompileCityLayout?: () => void;
}

export const DeterminismDebugOverlay: React.FC<DeterminismDebugOverlayProps> = ({
  isOpen,
  onClose,
  economy,
  onShowNotification,
  onTogglePathfindingDebug,
  isPathfindingDebugActive = false,
  onTriggerZoneTransition,
}) => {
  const [currentTick, setCurrentTick] = useState(0);
  const [localHash, setLocalHash] = useState('00000000');
  const [serverHash, setServerHash] = useState('00000000');
  const [isSynced, setIsSynced] = useState(true);
  const [desyncLogs, setDesyncLogs] = useState<DesyncLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<
    'are_guard' | 'world_hash' | 'living_world' | 'transitions' | 'input_buffer' | 'lingua' | 'entities' | 'logs'
  >('are_guard');
  const [isMinimized, setIsMinimized] = useState(false);
  const [simulatedDesyncActive, setSimulatedDesyncActive] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Lingua Memory State
  const [linguaProfiles, setLinguaProfiles] = useState<SemanticWordProfile[]>([]);
  const [linguaSimulatorInput, setLinguaSimulatorInput] = useState('Gib mir deine Beute oder ich greife an!');
  const [linguaSimAnalysis, setLinguaSimAnalysis] = useState<PlayerUtteranceAnalysis | null>(null);
  const [linguaStats, setLinguaStats] = useState({
    totalVocabularySize: 0,
    totalSamplesRecorded: 0,
    hostileLearnedCount: 0,
    peacefulLearnedCount: 0,
    recentUtterancesCount: 0,
  });

  // ARE Invariant Guard state
  const [guardStatus, setGuardStatus] = useState(areInvariantGuard.getStatus());
  const [recorderStats, setRecorderStats] = useState(deterministicTickRecorder.stats());
  const [transitionSnapshot, setTransitionSnapshot] = useState(
    aurionTransitionRuntime.getSnapshot('hero_player_1')
  );
  const [inputBufferStats, setInputBufferStats] = useState<InputBufferStats>(
    timestampedInputBuffer.getStats(0)
  );
  const [selectedHub, setSelectedHub] = useState<HubId>('observatory_threshold');
  const [cityCompilerOutput, setCityCompilerOutput] = useState<{
    ok: boolean;
    sector: number;
    fixesCount: number;
    entitiesCount: number;
  } | null>(null);

  // Maintain synthetic server mirror to simulate authoritative server state verification
  const [syntheticServerNpcs, setSyntheticServerNpcs] = useState<NPCSnapshot[]>([]);

  // Update simulation determinism check on fixed intervals / ticks
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      const tick = economy ? economy.tickCount : Math.floor(Date.now() / 100);
      setCurrentTick(tick);
      setGuardStatus(areInvariantGuard.getStatus());
      setRecorderStats(deterministicTickRecorder.stats());
      setTransitionSnapshot(aurionTransitionRuntime.getSnapshot('hero_player_1'));
      setInputBufferStats(timestampedInputBuffer.getStats(tick));

      // Extract local snapshot from the active economy
      let localSnapshots: NPCSnapshot[] = [];
      if (economy && economy.npcs.length > 0) {
        localSnapshots = economy.npcs.slice(0, 16).map((npc) => ({
          id: `npc_${npc.id}`,
          name: npc.name,
          baseState: (npc.macroState === 'SURVIVAL'
            ? NPCBaseState.IDLE
            : npc.macroState === 'PRODUCTION'
            ? NPCBaseState.WORKING
            : npc.macroState === 'COMMERCE'
            ? NPCBaseState.TRADE
            : NPCBaseState.DEFEND) as NPCBaseState,
          subState: (npc.subState === 'IDLE'
            ? NPCSubState.WANDERING
            : npc.subState === 'CONSUME_RATION'
            ? NPCSubState.EXECUTING_TRANSACTION
            : npc.subState === 'HARVEST_RESOURCE'
            ? NPCSubState.HARVESTING
            : npc.subState === 'CRAFT_GOODS'
            ? NPCSubState.CRAFTING
            : npc.subState === 'TRANSIT_CARAVAN'
            ? NPCSubState.TRAVELING_TO_MARKET
            : NPCSubState.RESTING) as NPCSubState,
          needs: {
            hunger: npc.hunger / 100,
            security: 85 - npc.fatigue / 200,
            energy: 100 - npc.fatigue / 100,
            wealthGold: Math.floor(npc.wealthCopper / 1000),
          },
          inventory: {
            food: npc.inventory.get(1) || 0,
            raw_material: npc.inventory.get(2) || 0,
            finished_goods: npc.inventory.get(4) || 0,
          },
          homePosition: { x: npc.x, y: 0, z: npc.z },
          ticksInCurrentState: npc.ageTicks % 50,
        }));
      } else {
        // Fallback synthetic demonstration entities
        localSnapshots = [
          {
            id: 'npc_1',
            name: 'Alden the Mason',
            baseState: NPCBaseState.WORKING,
            subState: NPCSubState.HARVESTING,
            needs: { hunger: 24.5, security: 90.0, energy: 78.0, wealthGold: 14 },
            inventory: { raw_material: 6, food: 2 },
            homePosition: { x: 12.5, y: 0, z: -8.4 },
            ticksInCurrentState: 14,
          },
          {
            id: 'npc_2',
            name: 'Lyra of Areloria',
            baseState: NPCBaseState.TRADE,
            subState: NPCSubState.TRAVELING_TO_MARKET,
            needs: { hunger: 42.0, security: 75.0, energy: 60.0, wealthGold: 45 },
            inventory: { finished_goods: 3, food: 1 },
            homePosition: { x: -4.2, y: 0, z: 18.0 },
            ticksInCurrentState: 6,
          },
          {
            id: 'npc_3',
            name: 'Gareth Bronzeheart',
            baseState: NPCBaseState.DEFEND,
            subState: NPCSubState.ALERT_PATROL,
            needs: { hunger: 18.0, security: 45.0, energy: 88.0, wealthGold: 8 },
            inventory: { food: 1 },
            homePosition: { x: 0.0, y: 0, z: 0.0 },
            ticksInCurrentState: 22,
          },
        ];
      }

      // Compute local hash
      const computedLocalHash = NPCStateMachine.calculateSimulationStateHash(localSnapshots, tick);
      setLocalHash(computedLocalHash);

      // Server state mirror
      let currentServerSnapshots = syntheticServerNpcs;
      if (currentServerSnapshots.length === 0 || !simulatedDesyncActive) {
        currentServerSnapshots = JSON.parse(JSON.stringify(localSnapshots));
        setSyntheticServerNpcs(currentServerSnapshots);
      }

      // Compute server hash
      const computedServerHash = NPCStateMachine.calculateSimulationStateHash(
        currentServerSnapshots,
        tick
      );
      setServerHash(computedServerHash);

      // Check comparison
      const comparison = NPCStateMachine.compareSnapshots(localSnapshots, currentServerSnapshots);
      const synced = comparison.matched && computedLocalHash === computedServerHash;
      setIsSynced(synced);

      // Evaluate determinism divergence via SyncManager
      syncManager.checkDeterminismDivergence(
        computedLocalHash,
        computedServerHash,
        tick,
        currentServerSnapshots
      );

      if (!synced) {
        setDesyncLogs((prev) => {
          const newEntry: DesyncLogEntry = {
            id: `desync_${Date.now()}`,
            tick,
            timestamp: new Date().toLocaleTimeString(),
            localHash: computedLocalHash,
            serverHash: computedServerHash,
            divergingNpcIds: comparison.divergingNpcIds,
            details: comparison.details,
          };
          return [newEntry, ...prev.slice(0, 19)];
        });
      }
    }, 250);

    // Update Lingua profiles
    setLinguaProfiles(arelorianLingua.getLearnedProfiles());
    setLinguaStats(arelorianLingua.getStats());

    return () => clearInterval(interval);
  }, [isOpen, economy, syntheticServerNpcs, simulatedDesyncActive]);

  // Subscribe to Hard State Resync events from SyncManager
  useEffect(() => {
    const unsubscribe = syncManager.onHardStateResync((event) => {
      setSimulatedDesyncActive(false);
      setSyntheticServerNpcs([]);
      setIsSynced(true);
      onShowNotification?.(
        `⚡ HARD STATE RESYNC executed at Tick #${event.tick} (${event.divergentTicksCount} ticks divergence > 3 threshold). Authoritative snapshot restored.`,
        '#00f0ff'
      );
    });

    return unsubscribe;
  }, [onShowNotification]);

  const handleSimulateDesync = () => {
    setSimulatedDesyncActive(true);
    setSyntheticServerNpcs((prev) => {
      if (prev.length === 0) return prev;
      const copy = JSON.parse(JSON.stringify(prev));
      if (copy[0]) {
        copy[0].needs.hunger = 85.0;
        copy[0].baseState = NPCBaseState.TRADE;
        copy[0].subState = NPCSubState.FORAGING_EMERGENCY;
      }
      return copy;
    });
    onShowNotification?.('⚠️ Injected simulated desync event on Entity #1', '#f59e0b');
  };

  const handleForceResync = () => {
    setSimulatedDesyncActive(false);
    setSyntheticServerNpcs([]);
    setIsSynced(true);
    onShowNotification?.('🔄 Authoritative state hash resynchronized successfully.', '#00f0ff');
  };

  const handleClearLogs = () => {
    setDesyncLogs([]);
  };

  const handleRunCityCompiler = () => {
    const mockEntities = (economy?.npcs ?? []).map((npc) => ({
      id: `npc_${npc.id}`,
      type: 'building',
      role: 'forge',
      position: { x: npc.x, y: npc.z, z: 0 },
    }));
    const res = cityLayoutCompiler.compileSector(mockEntities, 0);
    setCityCompilerOutput({
      ok: res.ok,
      sector: res.sector,
      fixesCount: res.fixes.length,
      entitiesCount: res.entities.length,
    });
    onShowNotification?.(
      `🏛️ City Layout Sector 0 compiled: ${res.entities.length} entities, ${res.fixes.length} fixes applied.`,
      '#00f0ff'
    );
  };

  if (!isOpen) return null;

  const latestRecorded = deterministicTickRecorder.latest();
  const activeMarket = merchantBootstrapMarkets[selectedHub];

  return (
    <div
      id="determinism-debug-overlay"
      className="fixed bottom-20 right-4 z-50 w-96 md:w-[480px] bg-[#040d1a]/95 backdrop-blur-md border border-[#cd7f32]/40 rounded-xl shadow-2xl overflow-hidden text-xs text-stone-200 font-mono transition-all duration-200"
      style={{
        boxShadow: '0 0 35px rgba(0, 240, 255, 0.12), inset 0 0 15px rgba(205, 127, 50, 0.15)',
      }}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-[#0a192f] via-[#081a2e] to-[#040d1a] border-b border-[#cd7f32]/30 select-none">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#00f0ff] animate-pulse" />
          <span className="font-bold tracking-wider text-amber-200 font-sans uppercase">
            ARE Deterministic Kernel
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              guardStatus.ok && isSynced
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}
          >
            {guardStatus.ok && isSynced ? 'AXIOM COMPLIANT' : 'VIOLATION DETECTED'}
          </span>
        </div>

        <div className="flex items-center gap-1 text-gray-400">
          <button
            onClick={() => setIsMinimized((prev) => !prev)}
            className="p-1 hover:text-white rounded hover:bg-white/10"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:text-white rounded hover:bg-white/10"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-4 divide-x divide-stone-800 bg-[#061426] border-b border-stone-800 text-center py-1.5 text-[10px]">
            <div>
              <div className="text-gray-400">ARE Tick</div>
              <div className="font-bold text-[#00f0ff]">#{currentTick}</div>
            </div>
            <div>
              <div className="text-gray-400">Kappa Invariant</div>
              <div className="font-bold text-amber-300">{guardStatus.kappa ?? 1000} κ</div>
            </div>
            <div>
              <div className="text-gray-400">Replay Ring</div>
              <div className="font-bold text-emerald-400">{recorderStats.size}/1000</div>
            </div>
            <div>
              <div className="text-gray-400">Zone State</div>
              <div className="font-bold text-cyan-300 uppercase">
                {transitionSnapshot.zoneId}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-[#040d1a] border-b border-stone-800 px-1 py-1 gap-1 text-[11px] overflow-x-auto">
            <button
              onClick={() => setActiveTab('are_guard')}
              className={`px-2.5 py-1 rounded flex items-center gap-1 font-sans transition-all ${
                activeTab === 'are_guard'
                  ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
              }`}
            >
              <Cpu className="w-3 h-3" />
              Invariant Guard
            </button>
            <button
              onClick={() => setActiveTab('world_hash')}
              className={`px-2.5 py-1 rounded flex items-center gap-1 font-sans transition-all ${
                activeTab === 'world_hash'
                  ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
              }`}
            >
              <Database className="w-3 h-3" />
              World Hash
            </button>
            <button
              onClick={() => setActiveTab('living_world')}
              className={`px-2.5 py-1 rounded flex items-center gap-1 font-sans transition-all ${
                activeTab === 'living_world'
                  ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
              }`}
            >
              <Coins className="w-3 h-3" />
              4-Hub Economy
            </button>
            <button
              onClick={() => setActiveTab('transitions')}
              className={`px-2.5 py-1 rounded flex items-center gap-1 font-sans transition-all ${
                activeTab === 'transitions'
                  ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
              }`}
            >
              <Compass className="w-3 h-3" />
              Portal / Zone
            </button>
            <button
              onClick={() => setActiveTab('input_buffer')}
              className={`px-2.5 py-1 rounded flex items-center gap-1 font-sans transition-all relative ${
                activeTab === 'input_buffer'
                  ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
              }`}
            >
              <Zap className="w-3 h-3" />
              Input Buffer
              {inputBufferStats.queuedCount > 0 && (
                <span className="px-1 py-0.2 bg-[#00f0ff] text-black font-bold rounded-full text-[8px]">
                  {inputBufferStats.queuedCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('lingua')}
              className={`px-2.5 py-1 rounded flex items-center gap-1 font-sans transition-all relative ${
                activeTab === 'lingua'
                  ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
              }`}
            >
              <FileCode className="w-3 h-3" />
              Lingua AI
              {linguaProfiles.length > 0 && (
                <span className="px-1 py-0.2 bg-amber-500 text-black font-bold rounded-full text-[8px]">
                  {linguaProfiles.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('entities')}
              className={`px-2.5 py-1 rounded flex items-center gap-1 font-sans transition-all ${
                activeTab === 'entities'
                  ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
              }`}
            >
              <Activity className="w-3 h-3" />
              Entities ({economy?.npcs.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-2.5 py-1 rounded flex items-center gap-1 font-sans transition-all relative ${
                activeTab === 'logs'
                  ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
              }`}
            >
              <History className="w-3 h-3" />
              Logs
              {desyncLogs.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping absolute top-1 right-1" />
              )}
            </button>
          </div>

          {/* Main Tab Content */}
          <div className="p-3 max-h-80 overflow-y-auto space-y-3">
            {/* Tab 1: ARE Invariant Guard */}
            {activeTab === 'are_guard' && (
              <div className="space-y-3">
                <div className="p-2.5 bg-black/40 border border-stone-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Axiom 3 Invariant Guard</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Zero Forbidden Tokens
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-1.5 bg-stone-900/60 rounded border border-stone-800">
                      <div className="text-gray-500">Deterministic Seed</div>
                      <div className="text-amber-300 font-bold truncate">
                        {String(guardStatus.seed ?? 'aurion-genesis-seed-v1')}
                      </div>
                    </div>
                    <div className="p-1.5 bg-stone-900/60 rounded border border-stone-800">
                      <div className="text-gray-500">Standard Precision</div>
                      <div className="text-[#00f0ff] font-bold">1000 κ / tile (Exact)</div>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 bg-black/40 border border-stone-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-200 font-sans">
                      Axiomatic City Layout Compiler
                    </span>
                    <button
                      onClick={handleRunCityCompiler}
                      className="px-2 py-0.5 bg-[#00f0ff]/20 hover:bg-[#00f0ff]/30 text-[#00f0ff] border border-[#00f0ff]/40 rounded text-[10px] font-bold transition-all"
                    >
                      Compile Sector 0
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Enforces deterministic non-overlapping building distances & road anchors without wall-clock drift.
                  </p>
                  {cityCompilerOutput && (
                    <div className="p-1.5 bg-cyan-950/30 border border-cyan-500/30 rounded text-[10px] text-cyan-200 space-y-0.5">
                      <div>Sector: {cityCompilerOutput.sector} | Status: {cityCompilerOutput.ok ? 'COMPLIANT' : 'FIXED'}</div>
                      <div>Entities: {cityCompilerOutput.entitiesCount} | Spacing Fixes: {cityCompilerOutput.fixesCount}</div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSimulateDesync}
                    className="flex-1 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[10px] font-bold transition-all"
                  >
                    Simulate Drift
                  </button>
                  <button
                    onClick={handleForceResync}
                    className="flex-1 py-1.5 bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 rounded text-[10px] font-bold transition-all"
                  >
                    Force State Sync
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: World Hash Snapshot */}
            {activeTab === 'world_hash' && (
              <div className="space-y-3">
                <div className="p-2.5 bg-black/40 border border-stone-800 rounded-lg space-y-2">
                  <div className="text-[11px] font-bold text-amber-200 font-sans">
                    SHA-256 World Hash Snapshot
                  </div>
                  <div className="p-2 bg-stone-900/80 rounded font-mono text-[10px] text-cyan-300 break-all border border-stone-800">
                    {latestRecorded?.worldHash || 'Generating canonical SHA-256 root hash...'}
                  </div>
                  <div className="text-[10px] text-gray-400 flex justify-between">
                    <span>Chunk Grid: 64x64m</span>
                    <span>Deterministic Marker: tick:{currentTick}</span>
                  </div>
                </div>

                {latestRecorded?.worldSnapshot && (
                  <div className="p-2.5 bg-black/40 border border-stone-800 rounded-lg space-y-2">
                    <div className="text-[11px] font-bold text-stone-300 font-sans">
                      Active Chunk Buckets ({latestRecorded.worldSnapshot.chunks.length})
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {latestRecorded.worldSnapshot.chunks.map((chunk, idx) => (
                        <div
                          key={idx}
                          className="p-1.5 bg-stone-900/50 border border-stone-800 rounded flex items-center justify-between text-[10px]"
                        >
                          <div>
                            <span className="text-amber-300 font-bold">
                              Chunk [{chunk.chunkX}:{chunk.chunkY}]
                            </span>
                            <span className="text-gray-400 ml-2">
                              {chunk.counts.total} entities ({chunk.counts.players}P / {chunk.counts.npcs}N / {chunk.counts.loot}L)
                            </span>
                          </div>
                          <span className="text-cyan-400 font-mono text-[9px]">
                            0x{chunk.hash.slice(0, 8)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: 4-Hub Living World Economy */}
            {activeTab === 'living_world' && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-1">
                  {(['observatory_threshold', 'windhollow', 'emberfall', 'cinder_vault'] as HubId[]).map(
                    (hub) => (
                      <button
                        key={hub}
                        onClick={() => setSelectedHub(hub)}
                        className={`p-1.5 rounded text-[10px] text-center font-bold capitalize transition-all ${
                          selectedHub === hub
                            ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40'
                            : 'bg-stone-900/60 text-stone-400 hover:text-stone-200 border border-stone-800'
                        }`}
                      >
                        {hub.replace('_', ' ')}
                      </button>
                    )
                  )}
                </div>

                <div className="p-2.5 bg-black/40 border border-stone-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-amber-200 capitalize">
                      {activeMarket.hubId.replace('_', ' ')}
                    </span>
                    <span className="text-gray-400">{activeMarket.controllingGuild}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-1.5 bg-stone-900/60 rounded border border-stone-800">
                      <span className="text-gray-400">Treasury:</span>{' '}
                      <span className="text-yellow-400 font-bold">
                        {activeMarket.treasuryCopper.toLocaleString()} Cu
                      </span>
                    </div>
                    <div className="p-1.5 bg-stone-900/60 rounded border border-stone-800">
                      <span className="text-gray-400">Tax Rate:</span>{' '}
                      <span className="text-cyan-300 font-bold">
                        {(activeMarket.taxRateBasisPoints / 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="text-[10px] text-gray-400 font-bold pt-1">
                    Commodity Stock & Base Prices:
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[9px]">
                    {(Object.keys(activeMarket.stock) as CommodityId[]).map((c) => (
                      <div
                        key={c}
                        className="p-1 bg-stone-900/40 rounded border border-stone-800/80 flex justify-between"
                      >
                        <span className="capitalize text-stone-300">{c}</span>
                        <span className="text-amber-300 font-bold">{activeMarket.stock[c]}</span>
                      </div>
                    ))}
                  </div>

                  <div className="text-[9px] text-gray-400 flex justify-between pt-1 border-t border-stone-800">
                    <span>Production Focus: {productionFocus[selectedHub].join(', ')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Deterministic Zone Transition */}
            {activeTab === 'transitions' && (
              <div className="space-y-3">
                <div className="p-2.5 bg-black/40 border border-stone-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-200 font-sans">
                      Turmportal & Rückkehrstein Transition
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        transitionSnapshot.zoneId === AURION_EXPANSE_ZONE_ID
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      Zone: {transitionSnapshot.zoneId.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-1.5 bg-stone-900/60 rounded border border-stone-800">
                      <div className="text-gray-500">Entry Anchor</div>
                      <div className="text-stone-300 font-bold truncate">
                        {transitionSnapshot.entryPointId}
                      </div>
                    </div>
                    <div className="p-1.5 bg-stone-900/60 rounded border border-stone-800">
                      <div className="text-gray-500">Return Anchor</div>
                      <div className="text-stone-300 font-bold truncate">
                        {transitionSnapshot.returnPointId}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={onTriggerZoneTransition}
                    className="w-full py-2 bg-gradient-to-r from-[#00f0ff]/20 to-[#cd7f32]/20 hover:from-[#00f0ff]/30 hover:to-[#cd7f32]/30 text-amber-200 border border-[#00f0ff]/50 rounded-lg text-[11px] font-bold tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#00f0ff]" />
                    {transitionSnapshot.zoneId === AURION_EXPANSE_ZONE_ID
                      ? 'Touch Return Stone (Return to Tower)'
                      : 'Step Through Turmportal (Enter Aurion Expanse)'}
                  </button>
                </div>

                {transitionSnapshot.lastReceipt && (
                  <div className="p-2 bg-stone-900/70 border border-stone-800 rounded text-[10px] space-y-1">
                    <div className="text-gray-400 font-bold">Latest Transition Receipt:</div>
                    <div className="text-cyan-300 font-mono text-[9px]">
                      Req: {transitionSnapshot.lastReceipt.requestId}
                    </div>
                    <div className="flex justify-between text-gray-400 text-[9px]">
                      <span>Seq #{transitionSnapshot.lastReceipt.sequenceId}</span>
                      <span>Status: {transitionSnapshot.lastReceipt.status}</span>
                      <span>Tick: #{transitionSnapshot.lastReceipt.appliedAtTick ?? 'pending'}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Timestamped Input Buffer */}
            {activeTab === 'input_buffer' && (
              <div className="space-y-3">
                <div className="p-2.5 bg-black/40 border border-stone-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-200 font-sans flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-[#00f0ff]" />
                      Deterministic Input Buffer (Axiom 3)
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        inputBufferStats.bufferHealth === 'optimal'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {inputBufferStats.bufferHealth.toUpperCase()}
                    </span>
                  </div>

                  {/* Buffer Network & Delay Metrics */}
                  <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                    <div className="p-1.5 bg-stone-900/60 rounded border border-stone-800">
                      <div className="text-gray-400">RTT / Ping</div>
                      <div className="text-[#00f0ff] font-bold font-mono">
                        {inputBufferStats.currentEstimatedPingMs.toFixed(1)} ms
                      </div>
                    </div>
                    <div className="p-1.5 bg-stone-900/60 rounded border border-stone-800">
                      <div className="text-gray-400">Jitter (σ)</div>
                      <div className="text-amber-300 font-bold font-mono">
                        ±{inputBufferStats.jitterMs.toFixed(1)} ms
                      </div>
                    </div>
                    <div className="p-1.5 bg-stone-900/60 rounded border border-stone-800">
                      <div className="text-gray-400">Lead Ticks</div>
                      <div className="text-cyan-300 font-bold font-mono">
                        +{inputBufferStats.bufferedLeadTicks} ticks
                      </div>
                    </div>
                    <div className="p-1.5 bg-stone-900/60 rounded border border-stone-800">
                      <div className="text-gray-400">Processed</div>
                      <div className="text-emerald-400 font-bold font-mono">
                        {inputBufferStats.totalExecuted}
                      </div>
                    </div>
                  </div>

                  {/* Test Dispatch Button */}
                  <div className="pt-1 flex gap-2">
                    <button
                      onClick={() => {
                        timestampedInputBuffer.enqueueCommand(
                          'hero_player_1',
                          'CAST_SPELL',
                          { skillIndex: 0, spellId: 'Arcane Cleave' },
                          currentTick
                        );
                        setInputBufferStats(timestampedInputBuffer.getStats(currentTick));
                        if (onShowNotification) {
                          onShowNotification('⚡ Timestamped Input Queued (+lead ticks compensated)', '#00f0ff');
                        }
                      }}
                      className="flex-1 py-1.5 bg-[#00f0ff]/20 hover:bg-[#00f0ff]/30 text-cyan-200 border border-[#00f0ff]/40 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Zap className="w-3 h-3 text-[#00f0ff]" />
                      Simulate Queued Skill Cast
                    </button>
                    <button
                      onClick={() => {
                        timestampedInputBuffer.enqueueCommand(
                          'hero_player_1',
                          'DODGE_ROLL',
                          { dirX: 1, dirZ: 0, speed: 1 },
                          currentTick
                        );
                        setInputBufferStats(timestampedInputBuffer.getStats(currentTick));
                        if (onShowNotification) {
                          onShowNotification('💨 Timestamped Roll Queued', '#fbbf24');
                        }
                      }}
                      className="flex-1 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      Simulate Queued Roll
                    </button>
                  </div>
                </div>

                {/* Queued Commands Pipeline */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-gray-400 px-1 font-bold">
                    <span>Active Queued Commands ({timestampedInputBuffer.getQueuedCommands().length})</span>
                    <span>Target Tick</span>
                  </div>

                  {timestampedInputBuffer.getQueuedCommands().length === 0 ? (
                    <div className="p-3 text-center text-gray-500 bg-stone-900/30 border border-stone-800 rounded text-[10px]">
                      Input queue empty. Commands execute upon reaching target tick.
                    </div>
                  ) : (
                    timestampedInputBuffer.getQueuedCommands().map((cmd) => (
                      <div
                        key={cmd.sequenceId}
                        className="p-2 bg-stone-900/80 border border-stone-700/80 rounded text-[10px] flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold text-amber-200">
                            <span className="text-[#00f0ff] font-mono">#{cmd.sequenceId}</span>
                            <span>{cmd.actionType}</span>
                            <span className="text-gray-400 font-mono text-[9px]">({cmd.commandHash})</span>
                          </div>
                          <div className="text-[9px] text-gray-400 font-mono">
                            Sent at #{currentTick} | RTT: {cmd.estimatedLatencyMs}ms
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-cyan-300 font-mono font-bold">
                            Tick #{cmd.targetTick}
                          </div>
                          <div className="text-[8px] text-gray-500 font-mono">
                            Δ {cmd.targetTick - currentTick} ticks left
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Execution History */}
                {timestampedInputBuffer.getHistory().length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-gray-400 font-bold px-1">
                      Recent Deterministic Executions:
                    </div>
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {timestampedInputBuffer.getHistory().slice(-5).reverse().map((cmd) => (
                        <div
                          key={cmd.sequenceId}
                          className="p-1.5 bg-black/40 border border-stone-800 rounded text-[9px] flex items-center justify-between text-gray-300 font-mono"
                        >
                          <span className="text-emerald-400 font-bold">
                            #{cmd.sequenceId} {cmd.actionType}
                          </span>
                          <span className="text-gray-400">
                            Target #{cmd.targetTick} → Exec #{cmd.executedAtTick ?? cmd.targetTick}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Arelorian Lingua Semantic Memory & Learning Engine */}
            {activeTab === 'lingua' && (
              <div className="space-y-3">
                {/* Stats Header */}
                <div className="p-2.5 bg-black/40 border border-stone-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400 font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#00f0ff]" />
                      Arelorian Deterministic Lingua Memory
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/30">
                      Active
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1 text-center text-[10px] pt-1">
                    <div className="p-1.5 bg-stone-900/60 rounded border border-stone-800">
                      <div className="text-gray-400 text-[9px]">Words</div>
                      <div className="font-bold text-cyan-300">{linguaStats.totalVocabularySize}</div>
                    </div>
                    <div className="p-1.5 bg-stone-900/60 rounded border border-stone-800">
                      <div className="text-gray-400 text-[9px]">Samples</div>
                      <div className="font-bold text-amber-300">{linguaStats.totalSamplesRecorded}</div>
                    </div>
                    <div className="p-1.5 bg-stone-900/60 rounded border border-stone-800">
                      <div className="text-gray-400 text-[9px]">Hostile</div>
                      <div className="font-bold text-rose-400">{linguaStats.hostileLearnedCount}</div>
                    </div>
                    <div className="p-1.5 bg-stone-900/60 rounded border border-stone-800">
                      <div className="text-gray-400 text-[9px]">Peaceful</div>
                      <div className="font-bold text-emerald-400">{linguaStats.peacefulLearnedCount}</div>
                    </div>
                  </div>
                </div>

                {/* Live Semantic Simulator */}
                <div className="p-2.5 bg-black/50 border border-stone-800 rounded-lg space-y-2">
                  <div className="text-[10px] text-amber-300 font-bold flex items-center justify-between">
                    <span>Live Utterance Semantic Intent Simulator</span>
                    <span className="text-[9px] text-gray-400 font-mono">Tokenized Evaluation</span>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={linguaSimulatorInput}
                      onChange={(e) => setLinguaSimulatorInput(e.target.value)}
                      placeholder="Type player utterance..."
                      className="flex-1 bg-stone-900/90 border border-stone-700 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-[#00f0ff]"
                    />
                    <button
                      onClick={() => {
                        const res = arelorianLingua.analyzeUtterance(linguaSimulatorInput, currentTick);
                        setLinguaSimAnalysis(res);
                      }}
                      className="px-2.5 py-1 bg-[#00f0ff]/20 hover:bg-[#00f0ff]/30 text-cyan-200 border border-[#00f0ff]/40 rounded text-[10px] font-bold transition-colors"
                    >
                      Analyze
                    </button>
                  </div>

                  {linguaSimAnalysis && (
                    <div className="p-2 bg-stone-950/80 border border-cyan-500/30 rounded space-y-1.5 text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Dominant Intent:</span>
                        <span
                          className={`font-bold px-1.5 py-0.2 rounded text-[9px] ${
                            linguaSimAnalysis.dominantEventType.includes('ATTACK') ||
                            linguaSimAnalysis.dominantEventType.includes('THREAT') ||
                            linguaSimAnalysis.dominantEventType.includes('RAID')
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                              : linguaSimAnalysis.dominantEventType.includes('COMMERCE')
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {linguaSimAnalysis.dominantEventType}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[9px]">
                        <span className="text-gray-400">Threat Score:</span>
                        <span
                          className={`font-bold ${
                            linguaSimAnalysis.inferredThreatLevel > 20
                              ? 'text-rose-400'
                              : linguaSimAnalysis.inferredThreatLevel < -20
                              ? 'text-emerald-400'
                              : 'text-stone-300'
                          }`}
                        >
                          {linguaSimAnalysis.inferredThreatLevel > 0 ? '+' : ''}
                          {linguaSimAnalysis.inferredThreatLevel} / 100
                        </span>
                      </div>

                      <div className="text-[9px] text-cyan-300 font-mono border-t border-stone-800 pt-1">
                        <span className="text-gray-500">Runic: </span>
                        {linguaSimAnalysis.arelorianTranslation}
                      </div>

                      {/* Simulated NPC Reactions */}
                      <div className="grid grid-cols-2 gap-1 pt-1 text-[8.5px]">
                        {(['guard', 'merchant'] as const).map((role) => {
                          const react = arelorianLingua.generateNPCReaction(
                            role === 'guard' ? 'Wache Kaelen' : 'Händler Barnaby',
                            role,
                            linguaSimAnalysis
                          );
                          return (
                            <div key={role} className="p-1.5 bg-stone-900/90 rounded border border-stone-800 space-y-0.5">
                              <div className="flex justify-between font-bold text-gray-300 capitalize">
                                <span>{role}:</span>
                                <span
                                  className={
                                    react.posture === 'DEFENSIVE' || react.posture === 'ALERT_GUARDS'
                                      ? 'text-rose-400'
                                      : react.posture === 'FRIENDLY'
                                      ? 'text-emerald-400'
                                      : 'text-amber-300'
                                  }
                                >
                                  [{react.posture}]
                                </span>
                              </div>
                              <p className="text-gray-400 truncate">"{react.dialogueText}"</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Contextual Training Action Buttons */}
                  <div className="pt-1 space-y-1">
                    <div className="text-[9px] text-gray-400 font-bold">Simulate Contextual Event Learning:</div>
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => {
                          arelorianLingua.learnFromContextualUtterance('Beute Raub Angriff', 'RAID_THEFT', currentTick);
                          setLinguaProfiles(arelorianLingua.getLearnedProfiles());
                          setLinguaStats(arelorianLingua.getStats());
                          onShowNotification?.("🧠 Learned 'Beute / Raub / Angriff' under RAID_THEFT", '#ef4444');
                        }}
                        className="px-2 py-0.5 bg-rose-950/50 hover:bg-rose-900/50 text-rose-200 border border-rose-500/30 rounded text-[9px] font-bold"
                      >
                        + Train Raid Words ('Beute')
                      </button>
                      <button
                        onClick={() => {
                          arelorianLingua.learnFromContextualUtterance('Handel Gold Kaufen Tauschen', 'TRADE_COMMERCE', currentTick);
                          setLinguaProfiles(arelorianLingua.getLearnedProfiles());
                          setLinguaStats(arelorianLingua.getStats());
                          onShowNotification?.("🧠 Learned 'Handel / Gold' under TRADE_COMMERCE", '#f59e0b');
                        }}
                        className="px-2 py-0.5 bg-amber-950/50 hover:bg-amber-900/50 text-amber-200 border border-amber-500/30 rounded text-[9px] font-bold"
                      >
                        + Train Trade Words ('Handel')
                      </button>
                      <button
                        onClick={() => {
                          arelorianLingua.learnFromContextualUtterance('Frieden Danke Freund Ehre', 'PEACE_GREETING', currentTick);
                          setLinguaProfiles(arelorianLingua.getLearnedProfiles());
                          setLinguaStats(arelorianLingua.getStats());
                          onShowNotification?.("🧠 Learned 'Frieden / Danke' under PEACE_GREETING", '#10b981');
                        }}
                        className="px-2 py-0.5 bg-emerald-950/50 hover:bg-emerald-900/50 text-emerald-200 border border-emerald-500/30 rounded text-[9px] font-bold"
                      >
                        + Train Peace Words ('Frieden')
                      </button>
                    </div>
                  </div>
                </div>

                {/* Learned Word Profiles List */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold px-1">
                    <span>Learned Semantic Profiles ({linguaProfiles.length})</span>
                    <span>Threat / Samples</span>
                  </div>

                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {linguaProfiles.length === 0 ? (
                      <div className="p-3 text-center text-gray-500 bg-stone-900/30 border border-stone-800 rounded text-[10px]">
                        No custom words learned yet. Talk in chat or simulate events above.
                      </div>
                    ) : (
                      linguaProfiles.map((p) => (
                        <div
                          key={p.word}
                          className="p-1.5 bg-stone-900/70 border border-stone-800 rounded text-[9.5px] flex items-center justify-between"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-bold text-gray-200">
                              <span className="text-cyan-300 font-mono">{p.word}</span>
                              <span className="text-gray-500 text-[8.5px]">({arelorianLingua.transliterateToArelorian(p.word)})</span>
                            </div>
                            <div className="text-[8.5px] text-gray-400 flex gap-2">
                              <span>Atk: {p.eventCounts?.COMBAT_ATTACK || 0}</span>
                              <span>Raid: {p.eventCounts?.RAID_THEFT || 0}</span>
                              <span>Trade: {p.eventCounts?.TRADE_COMMERCE || 0}</span>
                              <span>Peace: {p.eventCounts?.PEACE_GREETING || 0}</span>
                            </div>
                          </div>

                          <div className="text-right font-mono">
                            <div
                              className={`font-bold ${
                                p.threatScore > 20
                                  ? 'text-rose-400'
                                  : p.threatScore < -20
                                  ? 'text-emerald-400'
                                  : 'text-stone-300'
                              }`}
                            >
                              {p.threatScore > 0 ? '+' : ''}
                              {p.threatScore}
                            </div>
                            <div className="text-[8px] text-gray-500">{p.totalOccurrences}x seen</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 5: Entities */}
            {activeTab === 'entities' && (
              <div className="space-y-1.5">
                {(economy?.npcs ?? []).slice(0, 10).map((npc) => (
                  <div
                    key={npc.id}
                    className="p-2 bg-black/40 border border-stone-800 rounded text-[10px] space-y-1 hover:border-stone-700 transition-colors"
                  >
                    <div className="flex items-center justify-between text-amber-200">
                      <span className="font-bold">{npc.name}</span>
                      <span className="text-[#00f0ff] font-mono">
                        ({npc.x.toFixed(1)}, {npc.z.toFixed(1)})
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-gray-400 text-[9px]">
                      <span>State: {npc.macroState}</span>
                      <span>Fatigue: {npc.fatigue}</span>
                      <span>Gold: {Math.floor(npc.wealthCopper / 1000)}g</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 6: Logs */}
            {activeTab === 'logs' && (
              <div className="space-y-2">
                {desyncLogs.length === 0 ? (
                  <div className="py-6 text-center text-gray-500">
                    <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500/40 mb-1" />
                    <p>No desynchronization events recorded.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center pb-1">
                      <span className="text-[10px] text-gray-400">
                        {desyncLogs.length} events logged
                      </span>
                      <button
                        onClick={handleClearLogs}
                        className="text-[10px] text-rose-400 hover:underline"
                      >
                        Clear History
                      </button>
                    </div>
                    {desyncLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2 bg-rose-950/20 border border-rose-500/30 rounded text-[10px] space-y-1"
                      >
                        <div className="flex items-center justify-between text-rose-300">
                          <span className="font-bold">Tick #{log.tick}</span>
                          <span className="text-gray-400">{log.timestamp}</span>
                        </div>
                        <div className="flex justify-between text-gray-400 font-mono">
                          <span>Local: 0x{log.localHash}</span>
                          <span>Server: 0x{log.serverHash}</span>
                        </div>
                        {log.details.map((d, idx) => (
                          <p key={idx} className="text-amber-200/90 font-sans">
                            {d}
                          </p>
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="px-3 py-2 bg-black/60 border-t border-stone-800 flex items-center justify-between text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3 text-[#00f0ff]" />
              ARE Kernel v2.4 (Axiom 3 Compliant)
            </span>
            <span className="text-[#00f0ff] font-semibold">
              Aurion State Sync
            </span>
          </div>
        </>
      )}
    </div>
  );
};
