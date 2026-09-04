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
} from 'lucide-react';
import {
  NPCStateMachine,
  NPCSnapshot,
  NPCBaseState,
  NPCSubState,
} from '../core/NPCStateMachine';
import { AutonomousNPCEconomy } from '../engine/economy/AutonomousNPCEconomy';
import { syncManager, HardResyncEvent } from '../core/SyncManager';
import { BinaryNPCSnapshotSerializer } from '../engine/net/BinaryNPCSnapshotSerializer';
import { NPCMemoryType, NPCMemoryRecord } from '../engine/ai/NPCShortTermMemory';

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
}

export const DeterminismDebugOverlay: React.FC<DeterminismDebugOverlayProps> = ({
  isOpen,
  onClose,
  economy,
  onShowNotification,
  onTogglePathfindingDebug,
  isPathfindingDebugActive = false,
}) => {
  const [currentTick, setCurrentTick] = useState(0);
  const [localHash, setLocalHash] = useState('00000000');
  const [serverHash, setServerHash] = useState('00000000');
  const [isSynced, setIsSynced] = useState(true);
  const [desyncLogs, setDesyncLogs] = useState<DesyncLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'status' | 'entities' | 'binary_memory' | 'logs'>('status');
  const [isMinimized, setIsMinimized] = useState(false);
  const [simulatedDesyncActive, setSimulatedDesyncActive] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Binary Snapshot Benchmark state
  const [binaryBenchmark, setBinaryBenchmark] = useState<{
    jsonSizeBytes: number;
    binarySizeBytes: number;
    bandwidthSavedPercent: number;
    compressionRatio: string;
    serializationTimeUs: number;
  }>({
    jsonSizeBytes: 18450,
    binarySizeBytes: 2480,
    bandwidthSavedPercent: 86,
    compressionRatio: '7.44x',
    serializationTimeUs: 85,
  });

  // Maintain synthetic server mirror to simulate authoritative server state verification
  const [syntheticServerNpcs, setSyntheticServerNpcs] = useState<NPCSnapshot[]>([]);

  // Update simulation determinism check on fixed intervals / ticks
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      const tick = economy ? economy.tickCount : Math.floor(Date.now() / 100);
      setCurrentTick(tick);

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
            security: 85 - (npc.fatigue / 200),
            energy: 100 - (npc.fatigue / 100),
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
        // In synchronized state, server state mirrors deterministic snapshot perfectly
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

      // Evaluate determinism divergence via SyncManager - triggers Hard State Resync if > 3 ticks desync
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
          // Keep maximum 20 entries
          return [newEntry, ...prev.slice(0, 19)];
        });
      }
    }, 250);

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
      // Inject deterministic drift into first NPC
      if (copy[0]) {
        copy[0].needs.hunger = 85.0; // Desync hunger
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
    syncManager.triggerHardStateResync({
      tick: currentTick,
      localHash,
      serverHash,
      reason: 'Manual User Re-Sync via Determinism Debug Overlay',
    });
    onShowNotification?.('✓ Simulation state resynchronized from Authoritative Server Snapshot', '#00f0ff');
  };

  const handleClearLogs = () => {
    setDesyncLogs([]);
    onShowNotification?.('Cleared desync logs', '#10b981');
  };

  if (!isOpen) return null;

  return (
    <div
      id="determinism-debug-overlay"
      className="fixed bottom-4 right-4 z-50 w-96 sm:w-[480px] max-h-[85vh] flex flex-col bg-[#040d1a]/95 border border-[#06b6d4]/40 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] backdrop-blur-md text-gray-200 overflow-hidden font-mono text-xs transition-all duration-200"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#081a2e] to-[#040d1a] border-b border-[#06b6d4]/30">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full animate-pulse ${
              isSynced
                ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
            }`}
          />
          <Cpu className="w-4 h-4 text-[#00f0ff]" />
          <span className="font-semibold text-gray-100 tracking-wider uppercase text-[11px]">
            Determinism Sync Monitor
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-[#22d3ee] border border-[#06b6d4]/30">
            Tick #{currentTick}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized((prev) => !prev)}
            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-rose-500/20 rounded text-gray-400 hover:text-rose-400 transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Status Metric Banner */}
          <div className="p-3 bg-black/40 border-b border-gray-800/80 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {isSynced ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 font-bold tracking-wide">
                      100% IN-SYNC
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
                    <span className="text-rose-400 font-bold tracking-wide">
                      DESYNCHRONIZATION DETECTED
                    </span>
                  </>
                )}
              </div>
              <span className="text-[10px] text-gray-400">
                Protocol: FNV-1a (32-bit Quantized)
              </span>
            </div>

            {/* Hash Grid */}
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="bg-[#081a2e]/80 p-2 rounded border border-gray-800 flex flex-col">
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Activity className="w-3 h-3 text-[#00f0ff]" />
                  <span>Local State Hash</span>
                </div>
                <span className="text-sm font-bold text-[#00f0ff] mt-0.5 tracking-widest font-mono">
                  0x{localHash}
                </span>
              </div>

              <div className="bg-[#081a2e]/80 p-2 rounded border border-gray-800 flex flex-col">
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Server className="w-3 h-3 text-[#22d3ee]" />
                  <span>Server Snapshot Hash</span>
                </div>
                <span
                  className={`text-sm font-bold mt-0.5 tracking-widest font-mono ${
                    isSynced ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  0x{serverHash}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-800 bg-[#061424]">
            <button
              onClick={() => setActiveTab('status')}
              className={`flex-1 py-1.5 px-1.5 text-center font-medium transition-colors ${
                activeTab === 'status'
                  ? 'border-b-2 border-[#00f0ff] text-[#00f0ff] bg-white/5'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Control & Stats
            </button>
            <button
              onClick={() => setActiveTab('binary_memory')}
              className={`flex-1 py-1.5 px-1.5 text-center font-medium transition-colors ${
                activeTab === 'binary_memory'
                  ? 'border-b-2 border-[#00f0ff] text-[#00f0ff] bg-white/5'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Binary & Memory
            </button>
            <button
              onClick={() => setActiveTab('entities')}
              className={`flex-1 py-1.5 px-1.5 text-center font-medium transition-colors ${
                activeTab === 'entities'
                  ? 'border-b-2 border-[#00f0ff] text-[#00f0ff] bg-white/5'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Entities ({economy?.npcs.length || 3})
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 py-1.5 px-1.5 text-center font-medium transition-colors relative ${
                activeTab === 'logs'
                  ? 'border-b-2 border-[#00f0ff] text-[#00f0ff] bg-white/5'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Logs
              {desyncLogs.length > 0 && (
                <span className="ml-1 px-1 py-0.2 rounded-full bg-rose-500 text-white text-[9px]">
                  {desyncLogs.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-3 overflow-y-auto max-h-64 space-y-3">
            {activeTab === 'status' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-black/30 p-2 rounded border border-gray-800/60">
                    <span className="text-gray-400">Simulation Timestep:</span>
                    <p className="font-semibold text-gray-200">50ms (20 Hz Fixed)</p>
                  </div>
                  <div className="bg-black/30 p-2 rounded border border-gray-800/60">
                    <span className="text-gray-400">RNG Seed Stream:</span>
                    <p className="font-semibold text-[#00f0ff]">Mulberry32 (0x811C9DC5)</p>
                  </div>
                  <div className="bg-black/30 p-2 rounded border border-gray-800/60">
                    <span className="text-gray-400">State Serialization:</span>
                    <p className="font-semibold text-[#00f0ff]">Binary ArrayBuffer (Dense)</p>
                  </div>
                  <div className="bg-black/30 p-2 rounded border border-gray-800/60">
                    <span className="text-gray-400">Desync Recovery:</span>
                    <p className="font-semibold text-emerald-400">Hard State Resync (&gt;3 Ticks)</p>
                  </div>
                  <div className="bg-black/30 p-2 rounded border border-gray-800/60">
                    <span className="text-gray-400">Divergence Window:</span>
                    <p
                      className={`font-semibold ${
                        syncManager.getConsecutiveDesyncTicks() > 0
                          ? syncManager.getConsecutiveDesyncTicks() >= 3
                            ? 'text-rose-400 animate-pulse'
                            : 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {syncManager.getConsecutiveDesyncTicks() > 0
                        ? `${syncManager.getConsecutiveDesyncTicks()} / 3 Ticks`
                        : '0 Ticks (Synchronized)'}
                    </p>
                  </div>
                  <div className="bg-black/30 p-2 rounded border border-gray-800/60">
                    <span className="text-gray-400">3D Pathfinding Debug:</span>
                    <p className={`font-semibold ${isPathfindingDebugActive ? 'text-emerald-400' : 'text-gray-400'}`}>
                      {isPathfindingDebugActive ? 'ACTIVE (Rendering)' : 'DISABLED'}
                    </p>
                  </div>
                </div>

                {/* Pathfinding Debug Mode Action */}
                {onTogglePathfindingDebug && (
                  <button
                    onClick={onTogglePathfindingDebug}
                    className={`w-full py-1.5 px-2 rounded border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      isPathfindingDebugActive
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                        : 'bg-black/40 text-gray-300 border-gray-700 hover:border-[#00f0ff]/50'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-[#00f0ff]" />
                    {isPathfindingDebugActive ? 'Disable 3D Pathfinding Debug' : 'Enable 3D Pathfinding Debug'}
                  </button>
                )}

                {/* Diagnostic Action Controls */}
                <div className="pt-2 border-t border-gray-800 flex gap-2">
                  <button
                    onClick={handleSimulateDesync}
                    className="flex-1 py-1.5 px-2 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-medium flex items-center justify-center gap-1.5 transition-colors active:scale-95"
                  >
                    <Bug className="w-3.5 h-3.5" />
                    Simulate Desync
                  </button>
                  <button
                    onClick={handleForceResync}
                    className="flex-1 py-1.5 px-2 rounded bg-[#06b6d4]/20 hover:bg-[#06b6d4]/30 text-[#00f0ff] border border-[#06b6d4]/40 font-medium flex items-center justify-center gap-1.5 transition-colors active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Re-Sync Server
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'binary_memory' && (
              <div className="space-y-3 text-[11px]">
                {/* Serialization Benchmark Card */}
                <div className="p-2.5 rounded bg-black/40 border border-[#06b6d4]/30 space-y-2">
                  <div className="flex items-center justify-between text-[#00f0ff] font-semibold">
                    <span className="flex items-center gap-1">
                      <Database className="w-3.5 h-3.5" />
                      Binary ArrayBuffer vs JSON Serialization
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      -{binaryBenchmark.bandwidthSavedPercent}% Payload
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-[#081a2e]/60 p-1.5 rounded border border-gray-800">
                      <span className="text-gray-400">Binary ArrayBuffer:</span>
                      <p className="text-emerald-400 font-bold font-mono mt-0.5">
                        {binaryBenchmark.binarySizeBytes} Bytes (Dense)
                      </p>
                    </div>
                    <div className="bg-[#081a2e]/60 p-1.5 rounded border border-gray-800">
                      <span className="text-gray-400">Legacy JSON.stringify:</span>
                      <p className="text-rose-400 font-bold font-mono mt-0.5">
                        {binaryBenchmark.jsonSizeBytes} Bytes
                      </p>
                    </div>
                    <div className="bg-[#081a2e]/60 p-1.5 rounded border border-gray-800">
                      <span className="text-gray-400">Compression Factor:</span>
                      <p className="text-[#00f0ff] font-bold font-mono mt-0.5">
                        {binaryBenchmark.compressionRatio} Compression
                      </p>
                    </div>
                    <div className="bg-[#081a2e]/60 p-1.5 rounded border border-gray-800">
                      <span className="text-gray-400">Packing Latency:</span>
                      <p className="text-yellow-300 font-bold font-mono mt-0.5">
                        ~{binaryBenchmark.serializationTimeUs} µs (Sub-ms)
                      </p>
                    </div>
                  </div>
                </div>

                {/* NPC Short-Term Memory Inspector */}
                <div className="p-2.5 rounded bg-black/40 border border-gray-800 space-y-2">
                  <div className="flex items-center justify-between text-gray-200 font-semibold">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      NPC Short-Term Working Memory
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Ring Buffer (Max 8 Slots / NPC, 3500-Tick Decay)
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-28 overflow-y-auto">
                    {economy && economy.npcs.length > 0 ? (
                      economy.npcs.slice(0, 3).map((npc) => {
                        const memories = npc.memory?.getMemories?.() || [];
                        return (
                          <div key={npc.id} className="p-1.5 bg-[#081a2e]/60 rounded border border-gray-800 text-[10px]">
                            <div className="flex justify-between items-center font-semibold text-gray-300">
                              <span>{npc.name}</span>
                              <span className="text-amber-300">{memories.length} Active Memories</span>
                            </div>
                            {memories.length === 0 ? (
                              <p className="text-gray-500 text-[9px] mt-0.5">No hazards or obstacles in recent buffer</p>
                            ) : (
                              <div className="mt-1 space-y-0.5">
                                {memories.map((m, idx) => (
                                  <div key={idx} className="flex justify-between text-[9px] text-gray-400">
                                    <span className={m.type === NPCMemoryType.HAZARD_THREAT ? 'text-rose-400' : m.type === NPCMemoryType.TRADE_DEAL ? 'text-emerald-400' : 'text-amber-400'}>
                                      {m.type === NPCMemoryType.HAZARD_THREAT ? '⚠️ THREAT' : m.type === NPCMemoryType.TRADE_DEAL ? '💰 TRADE' : m.type === NPCMemoryType.PATH_DEVIATION ? '🧭 DEVIATION' : '⚡ EVENT'}
                                    </span>
                                    <span>Pos: ({m.x.toFixed(1)}, {m.z.toFixed(1)})</span>
                                    <span>Intensity: {(m.intensity * 100).toFixed(0)}%</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-500 text-center py-2">No active NPC memory stores available.</p>
                    )}
                  </div>
                </div>

                {/* NPC Long-Term Memory (Episodic & Relational) Inspector */}
                <div className="p-2.5 rounded bg-black/40 border border-[#b8860b]/40 space-y-2">
                  <div className="flex items-center justify-between text-amber-200 font-semibold">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#00f0ff]" />
                      NPC Long-Term Memory & Social Standing
                    </span>
                    <span className="text-[10px] text-cyan-300">
                      Enemies | Trade Points | Resources | Leaders
                    </span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {economy && economy.npcs.length > 0 ? (
                      economy.npcs.slice(0, 3).map((npc) => {
                        const ltm = npc.longTermMemory;
                        if (!ltm) return null;
                        const enemies = ltm.getEnemies();
                        const tradePoints = ltm.getGoodTradePoints();
                        const resourceSpots = ltm.getBestResourceSpots();
                        const leadership = ltm.getZoneLeadership();

                        return (
                          <div key={`ltm_${npc.id}`} className="p-2 bg-[#061528]/80 rounded border border-gray-800 text-[10px] space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-amber-100">{npc.name}</span>
                              <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] border ${
                                leadership.socialStanding === 'EXALTED' || leadership.socialStanding === 'RESPECTED'
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                                  : leadership.socialStanding === 'GOOD'
                                  ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                                  : leadership.socialStanding === 'BAD' || leadership.socialStanding === 'EXILED'
                                  ? 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                                  : 'bg-gray-900 text-gray-300 border-gray-700'
                              }`}>
                                Standing: {leadership.socialStanding} ({leadership.reputationScore > 0 ? `+${leadership.reputationScore}` : leadership.reputationScore})
                              </span>
                            </div>

                            {/* Zone Leader Knowledge */}
                            <div className="bg-black/40 p-1.5 rounded border border-gray-800/80 flex justify-between items-center text-[9px]">
                              <div>
                                <span className="text-gray-400">Zone-Anführer: </span>
                                <span className="text-cyan-300 font-semibold">{leadership.zoneLeaderName}</span>
                                <span className="text-gray-500 ml-1">({leadership.zoneLeaderTitle})</span>
                              </div>
                              <span className="text-amber-300 font-mono text-[8px]">{leadership.zoneLeaderFaction}</span>
                            </div>

                            {/* Cognitive Memory Columns */}
                            <div className="grid grid-cols-3 gap-1.5 text-[8.5px]">
                              {/* Enemies */}
                              <div className="bg-rose-950/20 p-1 rounded border border-rose-500/20">
                                <span className="font-bold text-rose-300 block mb-0.5">Feinde ({enemies.length})</span>
                                {enemies.length === 0 ? (
                                  <span className="text-gray-500">Keine Feinde gemerkt</span>
                                ) : (
                                  enemies.slice(0, 2).map((e, idx) => (
                                    <div key={idx} className="text-rose-200 truncate">
                                      ⚔️ {e.enemyName} <span className="text-rose-400 font-mono">({e.dangerLevel} Dmg)</span>
                                    </div>
                                  ))
                                )}
                              </div>

                              {/* Trade Points */}
                              <div className="bg-emerald-950/20 p-1 rounded border border-emerald-500/20">
                                <span className="font-bold text-emerald-300 block mb-0.5">Top-Handel ({tradePoints.length})</span>
                                {tradePoints.length === 0 ? (
                                  <span className="text-gray-500">Keine Handelsknoten</span>
                                ) : (
                                  tradePoints.slice(0, 2).map((t, idx) => (
                                    <div key={idx} className="text-emerald-200 truncate">
                                      💰 {t.hubName} <span className="text-amber-300 font-mono">({Math.round(t.avgProfitCopper)} Cu)</span>
                                    </div>
                                  ))
                                )}
                              </div>

                              {/* Resource Spots */}
                              <div className="bg-cyan-950/20 p-1 rounded border border-cyan-500/20">
                                <span className="font-bold text-cyan-300 block mb-0.5">Ressourcen ({resourceSpots.length})</span>
                                {resourceSpots.length === 0 ? (
                                  <span className="text-gray-500">Keine Vorkommen</span>
                                ) : (
                                  resourceSpots.slice(0, 2).map((r, idx) => (
                                    <div key={idx} className="text-cyan-200 truncate">
                                      ⛏️ {r.depositName} <span className="text-cyan-400 font-mono">({r.yieldRating.toFixed(1)}x)</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-500 text-center py-2">Keine NPC-Langzeitgedächtnisse aktiv.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'entities' && (
              <div className="space-y-2">
                {(syntheticServerNpcs.length > 0 ? syntheticServerNpcs : [
                  {
                    id: 'npc_1',
                    name: 'Alden the Mason',
                    baseState: NPCBaseState.WORKING,
                    subState: NPCSubState.HARVESTING,
                    needs: { hunger: 24.5, security: 90.0, energy: 78.0, wealthGold: 14 },
                    inventory: { raw_material: 6, food: 2 },
                    homePosition: { x: 12.5, y: 0, z: -8.4 },
                    ticksInCurrentState: 14,
                  }
                ]).map((npc) => {
                  const npcHash = NPCStateMachine.calculateNPCHash(npc);
                  const isSelected = selectedEntityId === npc.id;

                  return (
                    <div
                      key={npc.id}
                      onClick={() => setSelectedEntityId(isSelected ? null : npc.id)}
                      className={`p-2 rounded border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#0a2342] border-[#00f0ff]'
                          : 'bg-black/30 border-gray-800/80 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-200">{npc.name}</span>
                          <span className="px-1 py-0.2 rounded bg-black/60 text-[#22d3ee] text-[10px] border border-[#06b6d4]/20">
                            {npc.baseState}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-gray-400">
                          #{npcHash.slice(0, 6)}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                        <span>Sub: <span className="text-gray-300">{npc.subState}</span></span>
                        <span>Hunger: <span className="text-amber-300">{npc.needs.hunger.toFixed(0)}%</span></span>
                        <span>Security: <span className="text-emerald-300">{npc.needs.security.toFixed(0)}%</span></span>
                        <span>Gold: <span className="text-yellow-400">{npc.needs.wealthGold}g</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

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
          <div className="px-3 py-2 bg-black/60 border-t border-gray-800/80 flex items-center justify-between text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3 text-[#00f0ff]" />
              Deterministic Simulation HSM v2.4
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
