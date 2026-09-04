import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Compass,
  Skull,
  Shield,
  Award,
  Layers,
  Users,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Clock,
  Flame,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { NPCCharacter, PlayerStats, WorldChunkData, WorldExpansionStats, WorldBossRecord } from '../types';
import { WorldChunkManager } from '../world/WorldChunkManager';
import { INITIAL_WORLD_BOSSES } from '../data/bossLedgerData';

interface WorldMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerStats: PlayerStats;
  npcs: NPCCharacter[];
  chunkManager?: WorldChunkManager | null;
  worldBosses?: WorldBossRecord[];
}

export const WorldMapModal: React.FC<WorldMapModalProps> = ({
  isOpen,
  onClose,
  playerStats,
  npcs,
  chunkManager,
  worldBosses = INITIAL_WORLD_BOSSES,
}) => {
  const [zoomScale, setZoomScale] = useState<number>(1); // 1 = Realm View, 2.5 = Detailed View
  const [chunks, setChunks] = useState<WorldChunkData[]>([]);
  const [isLedgerOpen, setIsLedgerOpen] = useState<boolean>(true);
  const [selectedBossId, setSelectedBossId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [stats, setStats] = useState<WorldExpansionStats>({
    totalChunks: 25,
    totalAreaSqMeters: 160000,
    targetMaxPlayers: 2900,
    discoveredKingdoms: ['Königreich Aethelgard', 'Erzfürstentum Eisenmark', 'Aetherwald Vaeloria'],
    activeLandmarks: [],
    currentChunkKey: '0,0',
    currentKingdom: 'Königreich Aethelgard',
    currentLandmark: 'Aethelgard Sanctum',
  });

  // Ticker for live boss countdown timers
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (chunkManager) {
      setChunks(chunkManager.getAllChunks());
      setStats(chunkManager.getExpansionStats());
    }
  }, [isOpen, chunkManager, playerStats.x, playerStats.z]);

  if (!isOpen) return null;

  // View span dynamically computed from loaded chunks or default to +/- 220m
  const maxExtent = Math.max(220, ...chunks.map((c) => Math.max(Math.abs(c.centerX), Math.abs(c.centerZ)) + 40));
  const effectiveExtent = maxExtent / zoomScale;

  const toMapPct = (coord: number, isZ = false) => {
    const origin = isZ ? (zoomScale > 1 ? playerStats.z : 0) : (zoomScale > 1 ? playerStats.x : 0);
    const rel = coord - origin;
    const pct = ((rel + effectiveExtent) / (effectiveExtent * 2)) * 100;
    return Math.max(2, Math.min(98, pct));
  };

  const playerMapX = toMapPct(playerStats.x, false);
  const playerMapY = toMapPct(playerStats.z, true);

  const formatTimeSpan = (seconds: number) => {
    if (seconds <= 0) return 'Jetzt aktiv / Bereit';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const formatElapsed = (timestamp: number | null) => {
    if (!timestamp) return 'Noch nicht bezwungen';
    const elapsedSec = Math.max(0, Math.floor((now - timestamp) / 1000));
    const mins = Math.floor(elapsedSec / 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) {
      return `vor ${hours}h ${mins % 60}m`;
    }
    return `vor ${mins}m ${elapsedSec % 60}s`;
  };

  return (
    <div id="worldmap-modal-overlay" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div
        id="worldmap-dialog"
        className="w-full max-w-5xl bg-[#11141a] border border-[#b8860b]/40 rounded-2xl p-4 sm:p-6 text-gray-200 shadow-[0_0_40px_rgba(184,134,11,0.15)] flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-black/80 border-2 border-[#b8860b] flex items-center justify-center text-[#b8860b]">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                REALM ATLAS & DYNAMIC WORLD LOGIC
              </h3>
              <p className="text-xs text-gray-400 font-sans">
                Feste generierte Welt für bis zu 2.900 Spieler · Reale Grenzen, Wälder, Städte & Dungeons
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Toggles */}
            <div className="flex items-center bg-black/60 border border-gray-800 rounded-lg p-0.5">
              <button
                onClick={() => setZoomScale((z) => Math.max(0.6, z - 0.4))}
                className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-800/80 cursor-pointer"
                title="Herauszoomen (Großreich)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-mono px-1.5 text-amber-400 font-bold">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                onClick={() => setZoomScale((z) => Math.min(2.5, z + 0.4))}
                className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-800/80 cursor-pointer"
                title="Heranzoomen (Nahbereich)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-black/50 border border-gray-800 hover:border-[#b8860b] text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global World Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2 py-1.5 px-3 bg-black/60 rounded-xl border border-gray-800/80 text-xs">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Weltfläche</span>
            <span className="text-cyan-400 font-bold font-mono">
              {stats.totalAreaSqMeters.toLocaleString()} m² <span className="text-[10px] text-gray-500">(120.000+ qm)</span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Spieler-Kapazität</span>
            <span className="text-amber-400 font-bold font-mono">
              Bis zu {stats.targetMaxPlayers.toLocaleString()} Spieler
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Feste Welt-Chunks</span>
            <span className="text-emerald-400 font-bold font-mono">
              {stats.totalChunks} Sektoren gespeichert
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Königreiche & Grenzen</span>
            <span className="text-purple-300 font-bold truncate">
              {stats.discoveredKingdoms.length} Territorialmächte
            </span>
          </div>
        </div>

        {/* Map Canvas Visual Area */}
        <div className="relative flex-1 my-1 bg-[#07090e] rounded-xl border border-gray-800 overflow-hidden shadow-inner flex items-center justify-center min-h-[380px]">
          {/* Compass Rose */}
          <div className="absolute top-4 right-4 bg-black/80 border border-gray-700 rounded-full w-9 h-9 flex items-center justify-center text-[#b8860b] font-serif font-bold text-xs pointer-events-none z-30">
            N
          </div>

          {/* Render Persistent World Chunks Grid */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {chunks.map((chunk) => {
              const left = toMapPct(chunk.centerX - chunk.size / 2, false);
              const right = toMapPct(chunk.centerX + chunk.size / 2, false);
              const top = toMapPct(chunk.centerZ - chunk.size / 2, true);
              const bottom = toMapPct(chunk.centerZ + chunk.size / 2, true);
              const width = Math.max(4, right - left);
              const height = Math.max(4, bottom - top);

              // Tint color per landmark or biome
              const isSanctumOrCity = chunk.landmarkType === 'sanctum' || chunk.landmarkType === 'city';
              const isForest = chunk.landmarkType === 'forest' || chunk.biome.includes('forest') || chunk.biome.includes('woods');
              const isDungeon = chunk.landmarkType === 'dungeon' || chunk.biome.includes('dungeon');
              const isBorder = chunk.landmarkType === 'border' || chunk.landmarkType === 'quarry';

              const borderColor = isSanctumOrCity
                ? 'rgba(217, 119, 6, 0.4)'
                : isForest
                ? 'rgba(16, 185, 129, 0.35)'
                : isDungeon
                ? 'rgba(168, 85, 247, 0.4)'
                : isBorder
                ? 'rgba(148, 163, 184, 0.35)'
                : 'rgba(56, 189, 248, 0.3)';

              const bgColor = isSanctumOrCity
                ? 'rgba(180, 83, 9, 0.08)'
                : isForest
                ? 'rgba(5, 150, 105, 0.08)'
                : isDungeon
                ? 'rgba(126, 34, 206, 0.12)'
                : isBorder
                ? 'rgba(71, 85, 105, 0.08)'
                : 'rgba(14, 116, 144, 0.06)';

              return (
                <div
                  key={chunk.chunkKey}
                  className="absolute border transition-all duration-300 pointer-events-auto group/chunk"
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: `${width}%`,
                    height: `${height}%`,
                    borderColor,
                    backgroundColor: bgColor,
                  }}
                >
                  {/* Chunk Landmark Center Marker */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-1 text-center">
                    <span className="text-xs">
                      {chunk.landmarkType === 'city' || chunk.landmarkType === 'sanctum'
                        ? '🏛️'
                        : chunk.landmarkType === 'dungeon'
                        ? '⚔️'
                        : chunk.landmarkType === 'forest'
                        ? '🌲'
                        : chunk.landmarkType === 'border'
                        ? '🏰'
                        : '⛰️'}
                    </span>
                    <span className="text-[8px] font-serif text-gray-300 font-bold truncate max-w-full px-1">
                      {chunk.landmarkName}
                    </span>
                    <span className="text-[7px] text-gray-500 font-mono hidden sm:inline">
                      [{chunk.chunkX},{chunk.chunkZ}]
                    </span>
                  </div>

                  {/* Hover Details Tooltip */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 z-40 px-2 py-1 bg-black/95 border border-[#b8860b]/60 rounded-lg text-[10px] text-gray-200 whitespace-nowrap opacity-0 group-hover/chunk:opacity-100 transition-opacity pointer-events-none shadow-xl">
                    <div className="font-bold text-[#fbbf24] font-serif">{chunk.landmarkName}</div>
                    <div className="text-[8.5px] text-cyan-300">{chunk.kingdom} ({chunk.biome.toUpperCase()})</div>
                    <div className="text-[8px] text-gray-400">{chunk.obstacles.length} feste Kollisionsobjekte</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Central Sanctum Hub Label */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-[#b8860b]/40 bg-[#b8860b]/10 flex flex-col items-center justify-center text-center p-1 pointer-events-none z-10"
            style={{ left: `${toMapPct(0, false)}%`, top: `${toMapPct(0, true)}%` }}
          >
            <Shield className="w-4 h-4 text-[#b8860b] mb-0.5" />
            <span className="font-serif text-[9px] font-bold text-[#fbbf24] uppercase leading-tight">
              Grand Sanctum
            </span>
            <span className="text-[7.5px] text-gray-400">Hauptstadt</span>
          </div>

          {/* Dynamic World Boss Markers */}
          {worldBosses.map((boss) => {
            const isAlive = !boss.lastDefeatedTimestamp || (now - boss.lastDefeatedTimestamp >= boss.respawnIntervalSec * 1000);
            return (
              <div
                key={boss.id}
                onClick={() => setSelectedBossId(selectedBossId === boss.id ? null : boss.id)}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                style={{ left: `${toMapPct(boss.coords.x, false)}%`, top: `${toMapPct(boss.coords.z, true)}%` }}
              >
                <div
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-base shadow-lg transition-transform hover:scale-125 ${
                    isAlive
                      ? 'bg-rose-950/90 border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.6)] animate-pulse'
                      : 'bg-gray-900/90 border-gray-600 text-gray-400 opacity-70'
                  }`}
                >
                  <Skull className="w-4 h-4" />
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-1 bg-black/95 border border-rose-500/80 rounded text-[10px] font-serif font-bold text-amber-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 shadow-xl">
                  {boss.name} (Lv. {boss.level}) · {isAlive ? '🔥 AKTIV' : '⏳ RESPAWN'}
                </div>
              </div>
            );
          })}

          {/* NPC Marker Pins */}
          {npcs.map((npc) => (
            <div
              key={npc.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-20"
              style={{ left: `${toMapPct(npc.x, false)}%`, top: `${toMapPct(npc.z, true)}%` }}
            >
              <div
                className="w-5 h-5 rounded-full border-2 bg-black flex items-center justify-center text-[10px] shadow-md"
                style={{ borderColor: npc.color }}
              >
                💬
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 -top-7 px-2 py-0.5 bg-black/90 border border-gray-700 rounded text-[9px] font-serif text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {npc.name} ({npc.title})
              </div>
            </div>
          ))}

          {/* Player Real-Time Coordinate Pin with Radar Pulsing Ring */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
            style={{ left: `${playerMapX}%`, top: `${playerMapY}%` }}
          >
            <div className="relative flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-[#00f2ff] border-2 border-white shadow-[0_0_14px_#00f2ff] animate-ping opacity-75" />
              <div className="absolute w-3.5 h-3.5 rounded-full bg-[#00f2ff] border-2 border-white shadow-[0_0_10px_#00f2ff]" />
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 top-4 px-1.5 py-0.5 bg-black/90 border border-[#00f2ff] rounded text-[9px] font-mono font-bold text-[#00f2ff] whitespace-nowrap shadow-md">
              DU (X: {Math.round(playerStats.x)}, Z: {Math.round(playerStats.z)})
            </div>
          </div>
        </div>

        {/* WORLD BOSS LEDGER & SPAWN TRACKER DRAWER */}
        <div className="mt-1 bg-black/70 border border-rose-950/80 rounded-xl overflow-hidden">
          <button
            onClick={() => setIsLedgerOpen(!isLedgerOpen)}
            className="w-full px-4 py-2 bg-gradient-to-r from-rose-950/40 via-purple-950/30 to-rose-950/40 hover:bg-rose-950/60 border-b border-rose-900/40 flex items-center justify-between text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Skull className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-serif font-bold text-rose-200">
                World Boss Ledger & Respawn-Chronik (Titan Ignis & Weltenbosse)
              </span>
              <span className="px-2 py-0.2 rounded-full text-[9px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40">
                {worldBosses.filter((b) => !b.lastDefeatedTimestamp || (now - b.lastDefeatedTimestamp >= b.respawnIntervalSec * 1000)).length}/{worldBosses.length} Bosses Aktiv
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="text-[10px] hidden sm:inline">Klicke zum {isLedgerOpen ? 'Einklappen' : 'Ausklappen'}</span>
              {isLedgerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isLedgerOpen && (
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 max-h-[160px] overflow-y-auto">
              {worldBosses.map((boss) => {
                const elapsedSec = boss.lastDefeatedTimestamp ? Math.floor((now - boss.lastDefeatedTimestamp) / 1000) : 999999;
                const isAlive = !boss.lastDefeatedTimestamp || elapsedSec >= boss.respawnIntervalSec;
                const remainingSec = Math.max(0, boss.respawnIntervalSec - elapsedSec);

                return (
                  <div
                    key={boss.id}
                    onClick={() => setSelectedBossId(selectedBossId === boss.id ? null : boss.id)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                      selectedBossId === boss.id
                        ? 'bg-rose-950/50 border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                        : isAlive
                        ? 'bg-[#150a12] border-rose-900/50 hover:border-rose-500/50'
                        : 'bg-[#0c0d12] border-gray-800 hover:border-gray-700 opacity-85'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-base shrink-0">{boss.icon}</span>
                        <div className="truncate">
                          <div className="text-xs font-serif font-bold text-amber-100 truncate">{boss.name}</div>
                          <div className="text-[9px] text-gray-400">Lv. {boss.level} · {boss.zone}</div>
                        </div>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase shrink-0 ${
                          isAlive
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {isAlive ? 'Aktiv' : 'Respawn'}
                      </span>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-gray-800/80 grid grid-cols-2 gap-1 text-[10px] font-mono">
                      <div>
                        <span className="text-gray-500 block text-[8px]">Letzter Fall:</span>
                        <span className="text-gray-300 truncate block">{formatElapsed(boss.lastDefeatedTimestamp)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500 block text-[8px]">{isAlive ? 'Status:' : 'Respawn in:'}</span>
                        <span className={isAlive ? 'text-rose-400 font-bold' : 'text-amber-400'}>
                          {isAlive ? 'Bereit zum Kampf' : formatTimeSpan(remainingSec)}
                        </span>
                      </div>
                    </div>

                    {selectedBossId === boss.id && (
                      <div className="mt-2 pt-2 border-t border-rose-900/60 text-[9px] text-gray-300 space-y-1">
                        <div>
                          <strong className="text-rose-300">Letzter Bezwinger:</strong> {boss.lastSlayerName} ({boss.defeatCount}x besiegt)
                        </div>
                        <div>
                          <strong className="text-amber-300">Beute-Pool:</strong> {boss.rareDrops.join(', ')}
                        </div>
                        <div className="text-cyan-300 font-mono">
                          Arena-Koordinaten: [X: {boss.coords.x}, Z: {boss.coords.z}]
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Zone Info & Realm Legend */}
        <div className="flex flex-wrap items-center justify-between text-xs font-mono text-gray-400 pt-2 border-t border-gray-800 gap-2">
          <div className="flex items-center gap-3">
            <div>Zone: <span className="text-[#fbbf24] font-bold font-serif">{playerStats.currentZone}</span></div>
            <div className="text-gray-500">·</div>
            <div>Koordinaten: <span className="text-white font-bold">[X: {Math.round(playerStats.x)}, Z: {Math.round(playerStats.z)}]</span></div>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500 inline-block" /> Städte</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500 inline-block" /> Wälder</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-purple-500 inline-block" /> Dungeons</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-cyan-400 inline-block" /> Grenzen</span>
          </div>
        </div>
      </div>
    </div>
  );
};

