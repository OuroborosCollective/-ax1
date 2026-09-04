import React, { useState, useEffect } from 'react';
import {
  Shield,
  Heart,
  Zap,
  Sword,
  Sparkles,
  Package,
  Map as MapIcon,
  Award,
  Volume2,
  VolumeX,
  Compass,
  Skull,
  Send,
  User,
  Users,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Crosshair,
  Hand,
  Navigation,
  Smartphone,
  Database,
  TrendingUp,
  Activity,
} from 'lucide-react';
import {
  ActiveBuffSummary,
  CharacterClassId,
  ChatMessage,
  ClassSkill,
  DayNightInfo,
  EnginePerformanceMetrics,
  FloatingCombatText,
  LootDropEntity,
  MultiplayerNetStats,
  NPCCharacter,
  PartyMember,
  PlayerStats,
  Quest,
  RPGItem,
  WorldMobEntity,
} from '../types';
import { MMORPG_CLASSES } from '../data/mmorpgData';
import { soundSynth } from '../audio/SoundSynthesizer';
import { VirtualJoystick } from './VirtualJoystick';

interface GameHUDProps {
  playerStats: PlayerStats;
  currentClassId: CharacterClassId;
  targetMob: WorldMobEntity | null;
  nearbyNPC: NPCCharacter | null;
  nearbyLoot: LootDropEntity | null;
  quests: Quest[];
  chatMessages: ChatMessage[];
  floatingTexts: FloatingCombatText[];
  partyMembers?: PartyMember[];
  dayNightInfo?: DayNightInfo;
  netStats?: MultiplayerNetStats;
  activeBuffs?: ActiveBuffSummary[];
  engineMetrics?: EnginePerformanceMetrics;
  onCastSkill: (skillIndex: number) => void;
  onCycleTarget?: () => void;
  onVirtualMove?: (forward: number, right: number) => void;
  onToggleMount: () => void;
  onInteract: () => void;
  onOpenInventory: () => void;
  onOpenCharacter: () => void;
  onOpenQuests: () => void;
  onOpenClasses: () => void;
  onOpenMap: () => void;
  onOpenParty?: () => void;
  onOpenServerConsole?: () => void;
  onOpenEconomy?: () => void;
  onOpenDeterminismOverlay?: () => void;
  onSendMessage: (text: string, channel: ChatMessage['channel']) => void;
}


export const GameHUD: React.FC<GameHUDProps> = ({
  playerStats,
  currentClassId,
  targetMob,
  nearbyNPC,
  nearbyLoot,
  quests,
  chatMessages,
  floatingTexts,
  partyMembers = [],
  dayNightInfo,
  netStats,
  activeBuffs = [],
  engineMetrics,
  onCastSkill,
  onCycleTarget,
  onVirtualMove,
  onToggleMount,
  onInteract,
  onOpenInventory,
  onOpenCharacter,
  onOpenQuests,
  onOpenClasses,
  onOpenMap,
  onOpenParty,
  onOpenServerConsole,
  onOpenEconomy,
  onOpenDeterminismOverlay,
  onSendMessage,
}) => {
  const [chatInput, setChatInput] = useState('');
  const [chatChannel, setChatChannel] = useState<ChatMessage['channel']>('all');
  const [isQuestsCollapsed, setIsQuestsCollapsed] = useState(false);
  const [isPartyCollapsed, setIsPartyCollapsed] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControlsGuide, setShowControlsGuide] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);


  useEffect(() => {
    const checkDevice = () => {
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 1024;
      const ua = navigator.userAgent.toLowerCase();
      setIsMobileDevice(isTouch || isSmallScreen);
      setIsAndroid(ua.includes('android'));
      // Default quests collapsed on small mobile screens
      if (window.innerWidth < 640) {
        setIsQuestsCollapsed(true);
      }
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  const classDef = MMORPG_CLASSES[currentClassId];
  const hpPct = Math.max(0, Math.min(100, (playerStats.hp / playerStats.maxHp) * 100));
  const resourcePct = Math.max(0, Math.min(100, (playerStats.resource / playerStats.maxResource) * 100));
  const xpPct = Math.max(0, Math.min(100, (playerStats.xp / playerStats.maxXp) * 100));

  const handleToggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundSynth.setMuted(next);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim(), chatChannel);
    setChatInput('');
  };

  const handleJoystickMove = (f: number, r: number) => {
    onVirtualMove?.(f, r);
  };

  return (
    <div
      id="game-hud-root"
      className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-2 sm:p-4 select-none overflow-hidden"
    >
      {/* ================= TOP BAR (Unit Frames, Minimap, Quests, Micro-menu) ================= */}
      <div className="flex items-start justify-between gap-2 w-full">
        {/* Top-Left: Player Unit Frame */}
        <div className="flex flex-col gap-1 pointer-events-auto">
          <div
            id="player-unit-frame"
            onClick={onOpenCharacter}
            className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2.5 rounded-2xl bg-black/85 border border-[#b8860b]/50 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.6)] cursor-pointer hover:border-[#fbbf24] transition-all"
          >
            {/* Class Portrait / Level Crest */}
            <div className="relative">
              <div
                className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl border-2 flex items-center justify-center text-xl sm:text-3xl shadow-inner bg-black/60"
                style={{ borderColor: classDef.color }}
              >
                {classDef.icon}
              </div>
              <div className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded bg-[#b8860b] text-black font-mono font-bold text-[9px] sm:text-xs border border-black shadow">
                {playerStats.level}
              </div>
            </div>

            {/* Bars & Name */}
            <div className="w-28 sm:w-48 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-serif font-bold text-[11px] sm:text-sm text-white truncate">
                  {classDef.name}
                </span>
                <span className="text-[9px] sm:text-[10px] font-mono text-[#fbbf24] font-bold">
                  🪙 {playerStats.gold.toLocaleString()}
                </span>
              </div>

              {/* Health Bar */}
              <div className="relative w-full h-3.5 sm:h-4 bg-black/80 rounded-md border border-red-950 overflow-hidden p-0.5">
                <div
                  className="h-full rounded bg-gradient-to-r from-red-700 via-red-500 to-rose-400 transition-all duration-150"
                  style={{ width: `${hpPct}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] sm:text-[10px] font-mono font-bold text-white drop-shadow">
                  {Math.round(playerStats.hp)}/{playerStats.maxHp}
                </span>
              </div>

              {/* Class Resource Bar */}
              <div className="relative w-full h-2.5 sm:h-3.5 bg-black/80 rounded-md border border-gray-900 overflow-hidden p-0.5">
                <div
                  className="h-full rounded transition-all duration-150"
                  style={{
                    width: `${resourcePct}%`,
                    backgroundColor: classDef.resourceColor,
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[7px] sm:text-[9px] font-mono font-bold text-white drop-shadow truncate px-1">
                  {Math.round(playerStats.resource)} {playerStats.resourceName}
                </span>
              </div>

              {/* Weapon Mastery XP Bar */}
              {playerStats.weaponMasteries && playerStats.activeWeaponType && (
                <div className="relative w-full h-2 bg-black/90 rounded-md border border-amber-900/60 overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-200"
                    style={{
                      width: `${Math.min(
                        100,
                        (playerStats.weaponMasteries[playerStats.activeWeaponType]?.xp /
                          playerStats.weaponMasteries[playerStats.activeWeaponType]?.maxXp) *
                          100
                      )}%`,
                      backgroundColor: playerStats.weaponMasteries[playerStats.activeWeaponType]?.color || '#f59e0b',
                    }}
                  />
                  <span className="absolute inset-0 flex items-center justify-between text-[6px] sm:text-[7.5px] font-mono font-bold text-amber-200 drop-shadow px-1">
                    <span>
                      {playerStats.weaponMasteries[playerStats.activeWeaponType]?.icon}{' '}
                      {playerStats.weaponMasteries[playerStats.activeWeaponType]?.name}
                    </span>
                    <span>Rank {playerStats.weaponMasteries[playerStats.activeWeaponType]?.level}</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Current Biome / Zone Badge & Dynamic Day-Night Cycle Clock */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-black/70 border border-gray-800 text-[10px] font-mono text-gray-300 w-fit backdrop-blur-sm">
              <Compass className="w-3 h-3 text-[#b8860b]" />
              <span className="text-[#fbbf24] font-serif font-bold truncate max-w-[120px] sm:max-w-none">
                {playerStats.currentZone}
              </span>
              <span className="text-gray-500">·</span>
              <span className="text-[9px] text-gray-400">
                [{Math.round(playerStats.x)}, {Math.round(playerStats.z)}]
              </span>
            </div>

            {dayNightInfo && (
              <div
                title={`Atmospheric Phase: ${dayNightInfo.phaseName} (Intensity: ${dayNightInfo.sunIntensity.toFixed(2)})`}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/80 border text-[10px] font-mono backdrop-blur-sm shadow"
                style={{
                  borderColor:
                    dayNightInfo.phase === 'dawn'
                      ? '#f59e0b'
                      : dayNightInfo.phase === 'day'
                      ? '#fbbf24'
                      : dayNightInfo.phase === 'dusk'
                      ? '#c084fc'
                      : '#38bdf8',
                  color:
                    dayNightInfo.phase === 'dawn'
                      ? '#fbbf24'
                      : dayNightInfo.phase === 'day'
                      ? '#fef08a'
                      : dayNightInfo.phase === 'dusk'
                      ? '#e9d5ff'
                      : '#bae6fd',
                }}
              >
                <span>{dayNightInfo.icon}</span>
                <span className="font-bold">{dayNightInfo.formattedTime}</span>
                <span className="text-[8.5px] opacity-80 uppercase hidden sm:inline">{dayNightInfo.phase}</span>
              </div>
            )}

            {/* Realtime WebSocket Realm Status */}
            {netStats && (
              <div
                title={`Realtime WebSocket Realm Gateway: ${netStats.connected ? 'Online' : 'Reconnecting'}`}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-mono backdrop-blur-sm shadow ${
                  netStats.connected
                    ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300'
                    : 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${netStats.connected ? 'bg-cyan-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="font-bold">{netStats.connected ? 'Realm 20Hz' : 'Connecting'}</span>
                {netStats.connected && (
                  <>
                    <span className="text-gray-500">·</span>
                    <span>{netStats.pingMs}ms</span>
                    <span className="text-gray-500">·</span>
                    <span className="text-cyan-200">👥 {netStats.onlinePlayers}</span>
                  </>
                )}
              </div>
            )}

            {/* Engine Performance & LOD Metrics */}
            {engineMetrics && (
              <div
                title={`Rendering Engine: ${engineMetrics.fps} FPS | LOD: High ${engineMetrics.lodStats.highCount}, Med ${engineMetrics.lodStats.mediumCount}, Low ${engineMetrics.lodStats.lowCount}, Culled ${engineMetrics.lodStats.culledCount}`}
                className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/70 border border-gray-800 text-[10px] font-mono text-gray-400 backdrop-blur-sm"
              >
                <span className="text-emerald-400 font-bold">{engineMetrics.fps} FPS</span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-300">LOD {engineMetrics.lodStats.highCount + engineMetrics.lodStats.mediumCount} visible</span>
              </div>
            )}

            {/* Synchronized Global Weather State */}
            {engineMetrics?.weatherState && (
              <div
                title={`Global Dynamic Weather: ${engineMetrics.weatherState.name} (${engineMetrics.weatherState.combatBuffDescription})`}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-teal-950/40 border border-teal-500/40 text-[10px] font-mono text-teal-300 backdrop-blur-sm"
              >
                <span>⚡</span>
                <span className="font-bold">{engineMetrics.weatherState.name}</span>
                <span className="hidden xl:inline text-teal-200/80 text-[9px]">({engineMetrics.weatherState.combatBuffDescription})</span>
              </div>
            )}

            {/* Deterministic Simulation & Prediction Telemetry */}
            {engineMetrics?.simulationStats && (
              <div
                title={`Deterministic Simulation Loop: ${engineMetrics.simulationStats.tickRate}Hz Tick #${engineMetrics.simulationStats.currentTick} | Predictions: ${engineMetrics.simulationStats.pendingPredictions} | Occluded: ${engineMetrics.simulationStats.occludedObjects}`}
                className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-950/40 border border-indigo-500/40 text-[10px] font-mono text-indigo-300 backdrop-blur-sm"
              >
                <span className="font-bold text-indigo-200">SIM {engineMetrics.simulationStats.tickRate}Hz</span>
                <span className="text-gray-500">·</span>
                <span className="text-indigo-400">T#{engineMetrics.simulationStats.currentTick}</span>
                {engineMetrics.simulationStats.activeBallistics > 0 && (
                  <>
                    <span className="text-gray-500">·</span>
                    <span className="text-amber-400">🚀 {engineMetrics.simulationStats.activeBallistics}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Active Buffs & Debuffs Tray */}
          {activeBuffs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1 pointer-events-auto">
              {activeBuffs.map((buff) => (
                <div
                  key={buff.id}
                  title={`${buff.name} (${Math.round(buff.duration)}s remaining)`}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/80 border border-cyan-500/40 text-[9px] font-mono shadow-md backdrop-blur-sm"
                  style={{ borderColor: buff.color }}
                >
                  <span>{buff.icon}</span>
                  <span className="text-white font-medium truncate max-w-[100px]">{buff.name}</span>
                  {buff.stacks > 1 && <span className="text-amber-300 font-bold">x{buff.stacks}</span>}
                  <span className="text-gray-400 text-[8px]">{Math.ceil(buff.duration)}s</span>
                </div>
              ))}
            </div>
          )}

          {/* Party Member Frames on HUD (Group vitals) */}
          {partyMembers.length > 0 && (
            <div className="mt-1 flex flex-col gap-1 w-36 sm:w-48 bg-black/80 rounded-xl border border-sky-900/60 p-1.5 backdrop-blur-md shadow-lg pointer-events-auto">
              <div
                onClick={() => setIsPartyCollapsed(!isPartyCollapsed)}
                className="flex items-center justify-between cursor-pointer text-[9px] font-serif font-bold text-sky-400 uppercase tracking-wider pb-0.5 border-b border-gray-800/80"
              >
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-sky-400" /> Party ({partyMembers.length})
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenParty?.();
                  }}
                  className="text-[8px] text-[#fbbf24] hover:underline cursor-pointer"
                >
                  Manage
                </button>
              </div>

              {!isPartyCollapsed && (
                <div className="space-y-1 pt-0.5">
                  {partyMembers.map((member) => {
                    const hpPercent = Math.max(0, Math.min(100, Math.round((member.hp / member.maxHp) * 100)));
                    const resPercent = Math.max(0, Math.min(100, Math.round((member.resource / member.maxResource) * 100)));

                    return (
                      <div
                        key={member.id}
                        onClick={onOpenParty}
                        className={`p-1 rounded-lg border transition-all cursor-pointer ${
                          member.isPlayer
                            ? 'bg-amber-950/20 border-amber-500/40'
                            : member.inCombat
                            ? 'bg-red-950/25 border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                            : 'bg-black/60 border-gray-800/80 hover:border-sky-500/50'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[8.5px] font-mono leading-none mb-0.5">
                          <span className="text-gray-200 font-bold truncate max-w-[85px] sm:max-w-[110px] flex items-center gap-1">
                            <span>{member.avatarIcon}</span>
                            <span>{member.name}</span>
                            {member.isLeader && <span className="text-[#fbbf24] text-[7.5px]">👑</span>}
                          </span>
                          <span className="text-gray-400 text-[8px]">Lv.{member.level}</span>
                        </div>

                        {/* Member Health Bar */}
                        <div className="relative w-full h-2 sm:h-2.5 bg-black/90 rounded border border-red-950 overflow-hidden mb-0.5">
                          <div
                            className="h-full rounded bg-gradient-to-r from-emerald-600 to-green-400 transition-all duration-150"
                            style={{ width: `${hpPercent}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-[6px] sm:text-[7px] font-mono font-bold text-white drop-shadow">
                            {Math.round(member.hp)}/{member.maxHp}
                          </span>
                        </div>

                        {/* Member Resource Bar */}
                        <div className="relative w-full h-1 sm:h-1.5 bg-black/90 rounded border border-blue-950 overflow-hidden">
                          <div
                            className="h-full rounded bg-sky-500 transition-all duration-150"
                            style={{ width: `${resPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>


        {/* Top-Center: Target Unit Frame (When mob is selected) */}
        {targetMob && (
          <div
            id="target-unit-frame"
            className="pointer-events-auto flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2.5 rounded-2xl bg-black/90 border border-red-500/60 backdrop-blur-md shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-in fade-in zoom-in-95 duration-150 max-w-[180px] sm:max-w-xs md:max-w-md w-full"
          >
            <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl bg-red-950/60 border border-red-500 flex items-center justify-center text-base sm:text-xl flex-shrink-0">
              {targetMob.isBoss ? '☠️' : targetMob.isElite ? '⚔️' : '👾'}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-serif font-bold text-[10px] sm:text-sm text-red-200 truncate flex items-center gap-1">
                  <span>{targetMob.name}</span>
                  {targetMob.isBoss && (
                    <span className="px-1 py-0.2 rounded bg-purple-950 border border-purple-500 text-purple-300 text-[8px] font-mono">
                      BOSS
                    </span>
                  )}
                </span>
                <span className="text-[9px] font-mono text-gray-400">Lv.{targetMob.level}</span>
              </div>

              {/* Mob Health Bar */}
              <div className="relative w-full h-3 sm:h-4 bg-black/80 rounded-md border border-red-900 overflow-hidden p-0.5">
                <div
                  className="h-full rounded bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 transition-all duration-100"
                  style={{ width: `${Math.max(0, (targetMob.hp / targetMob.maxHp) * 100)}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] sm:text-[9px] font-mono font-bold text-white drop-shadow">
                  {Math.round((targetMob.hp / targetMob.maxHp) * 100)}%
                </span>
              </div>

              {/* Boss Cast Bar */}
              {targetMob.isBoss && targetMob.castSkillName && (
                <div className="relative w-full h-2 bg-black/90 rounded border border-purple-900 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-pink-500 transition-all duration-75"
                    style={{ width: `${(targetMob.castProgress || 0) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top-Right: Quick Micro-Menu & Objective Tracker */}
        <div className="flex flex-col items-end gap-1.5 pointer-events-auto">
          {/* Micro-Menu Buttons (Minimum 44px touch targets on mobile) */}
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenCharacter}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-black/80 border border-gray-800 hover:border-[#b8860b] text-[#fbbf24] flex items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow"
              title="Character [C]"
            >
              <User className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenInventory}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-black/80 border border-gray-800 hover:border-[#b8860b] text-[#fbbf24] flex items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow"
              title="Inventory [B]"
            >
              <Package className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenClasses}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-black/80 border border-gray-800 hover:border-[#b8860b] text-[#fbbf24] flex items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow"
              title="Class Sanctum [K]"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenParty}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-black/80 border border-gray-800 hover:border-sky-400 text-sky-300 flex items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow relative"
              title="Party Management [P]"
            >
              <Users className="w-4 h-4" />
              {partyMembers.length > 0 && (
                <span className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full bg-sky-500 text-black font-mono font-bold text-[8px] leading-none">
                  {partyMembers.length}
                </span>
              )}
            </button>
            <button
              onClick={onOpenMap}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-black/80 border border-gray-800 hover:border-[#b8860b] text-[#fbbf24] flex items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow"
              title="World Map [M]"
            >
              <MapIcon className="w-4 h-4" />
            </button>

            {onOpenEconomy && (
              <button
                onClick={onOpenEconomy}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-black/80 border border-gray-800 hover:border-emerald-400 text-emerald-300 flex items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow relative"
                title="NPC Economy & Markets [N]"
              >
                <TrendingUp className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
              </button>
            )}

            {onOpenDeterminismOverlay && (
              <button
                onClick={onOpenDeterminismOverlay}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-black/80 border border-gray-800 hover:border-[#00f0ff] text-[#00f0ff] flex items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow relative"
                title="Determinism Sync Monitor [F2]"
              >
                <Activity className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#00f0ff] shadow-[0_0_6px_#00f0ff]" />
              </button>
            )}

            {onOpenServerConsole && (
              <button
                onClick={onOpenServerConsole}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-black/80 border border-gray-800 hover:border-cyan-400 text-cyan-300 flex items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow relative"
                title="MariaDB & GLB Vault [F1]"
              >
                <Database className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#00f0ff]" />
              </button>
            )}

            <button
              onClick={handleToggleSound}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-black/80 border border-gray-800 hover:border-[#b8860b] text-gray-300 flex items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow"
              title="Sound Toggle"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-[#fbbf24]" />}
            </button>
          </div>

          {/* Active Objectives Collapsible Card */}
          <div className="w-44 sm:w-64 bg-black/85 border border-[#b8860b]/40 rounded-xl p-1.5 sm:p-2 backdrop-blur-md shadow-2xl">
            <div
              onClick={() => setIsQuestsCollapsed(!isQuestsCollapsed)}
              className="flex items-center justify-between cursor-pointer text-[10px] font-serif font-bold text-[#b8860b] uppercase tracking-wider pb-1 border-b border-gray-800/80"
            >
              <span className="flex items-center gap-1">
                <Award className="w-3 h-3 text-[#fbbf24]" /> Quests ({quests.filter((q) => !q.completed).length})
              </span>
              {isQuestsCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </div>

            {!isQuestsCollapsed && (
              <div className="space-y-1 pt-1.5 max-h-36 sm:max-h-48 overflow-y-auto pr-1 no-scrollbar">
                {quests.length === 0 ? (
                  <div className="text-[10px] text-gray-500 font-sans italic p-1">No active quests.</div>
                ) : (
                  quests.map((q) => {
                    const progressPct = Math.min(100, Math.round((q.currentCount / q.targetCount) * 100));
                    const isBoss = q.type === 'kill_boss';

                    return (
                      <div
                        key={q.id}
                        onClick={onOpenQuests}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          q.completed
                            ? 'bg-emerald-950/20 border-emerald-500/40'
                            : isBoss
                            ? 'bg-purple-950/20 border-purple-500/40'
                            : 'bg-black/60 border-gray-800/80 hover:border-amber-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] gap-1">
                          <span className={`font-serif truncate font-bold ${q.completed ? 'text-emerald-400 line-through' : 'text-gray-100'}`}>
                            {q.title}
                          </span>
                          <span className={`text-[9px] font-mono font-bold flex-shrink-0 ${q.completed ? 'text-emerald-400' : 'text-[#fbbf24]'}`}>
                            {q.currentCount}/{q.targetCount}
                          </span>
                        </div>
                        {/* Mini Progress Bar */}
                        <div className="w-full h-1 bg-black/90 rounded-full border border-gray-800 overflow-hidden mt-1">
                          <div
                            className={`h-full transition-all duration-300 ${
                              q.completed ? 'bg-emerald-400' : isBoss ? 'bg-purple-500' : 'bg-amber-400'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Combat Text Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {floatingTexts.map((txt) => (
          <div
            key={txt.id}
            className="absolute font-mono font-black transition-all duration-75 select-none"
            style={{
              left: `${50 + (txt.x % 15)}%`,
              top: `${40 - txt.y * 3.5}%`,
              color: txt.color,
              fontSize: `${txt.size}px`,
              opacity: txt.opacity,
              textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 12px rgba(255,255,255,0.4)',
              transform: `translate(-50%, -50%) scale(${txt.isCrit ? 1.3 : 1.0})`,
            }}
          >
            {txt.text}
          </div>
        ))}
      </div>

      {/* ================= MIDDLE: Contextual Action Prompt ================= */}
      <div className="flex flex-col items-center justify-center pointer-events-none my-auto">
        {nearbyLoot && (
          <div
            onClick={onInteract}
            className="pointer-events-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-black/90 border-2 border-amber-400 text-amber-300 font-serif font-bold text-xs sm:text-sm shadow-[0_0_25px_rgba(251,191,36,0.6)] animate-bounce cursor-pointer flex items-center gap-2 active:scale-95 transition-transform"
          >
            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-black font-mono font-bold text-[10px] sm:text-xs">
              Loot [F]
            </span>
            <span>{nearbyLoot.item.name} ({nearbyLoot.rarity.toUpperCase()})</span>
          </div>
        )}

        {nearbyNPC && !nearbyLoot && (
          <div
            onClick={onInteract}
            className="pointer-events-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-black/90 border-2 border-[#b8860b] text-[#fbbf24] font-serif font-bold text-xs sm:text-sm shadow-[0_0_20px_rgba(184,134,11,0.5)] animate-pulse cursor-pointer flex items-center gap-2 active:scale-95 transition-transform"
          >
            <span className="px-1.5 py-0.5 rounded bg-[#b8860b] text-black font-mono font-bold text-[10px] sm:text-xs">
              Talk [F]
            </span>
            <span>{nearbyNPC.name} ({nearbyNPC.title})</span>
          </div>
        )}
      </div>

      {/* ================= BOTTOM BAR (Left: Virtual Joystick / Chat, Right: Mobile Action Cluster) ================= */}
      <div className="flex items-end justify-between w-full pointer-events-none pb-1">
        {/* Bottom-Left: Ergonomic Virtual Joystick & Collapsible Mobile Chat */}
        <div className="flex flex-col items-start gap-2 pointer-events-auto">
          {/* Collapsible Mobile Realm Chat */}
          {isChatExpanded ? (
            <div className="w-64 sm:w-80 bg-black/90 border border-gray-800 rounded-2xl p-2 backdrop-blur-md flex flex-col h-40 shadow-2xl animate-in slide-in-from-bottom-5">
              <div className="flex items-center justify-between pb-1 border-b border-gray-800 text-[9px] font-mono">
                <div className="flex items-center gap-1">
                  {(['all', 'party', 'guild', 'system'] as ChatMessage['channel'][]).map((ch) => (
                    <button
                      key={ch}
                      onClick={() => setChatChannel(ch)}
                      className={`px-1.5 py-0.5 rounded uppercase font-bold transition-colors ${
                        chatChannel === ch ? 'bg-[#b8860b] text-black' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setIsChatExpanded(false)}
                  className="text-gray-400 hover:text-white px-1.5 text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto space-y-1 py-1 text-[10px] font-sans pr-1">
                {chatMessages
                  .filter((m) => chatChannel === 'all' || m.channel === chatChannel)
                  .map((msg) => (
                    <div key={msg.id} className="leading-tight break-words">
                      <span className="text-gray-500 font-mono text-[8px]">[{msg.timestamp}] </span>
                      <span
                        className={`font-serif font-bold ${
                          msg.channel === 'system'
                            ? 'text-yellow-400'
                            : msg.channel === 'guild'
                            ? 'text-emerald-400'
                            : msg.isPlayer
                            ? 'text-[#00f2ff]'
                            : 'text-gray-300'
                        }`}
                      >
                        [{msg.sender}]:{' '}
                      </span>
                      <span className="text-gray-300">{msg.text}</span>
                    </div>
                  ))}
              </div>

              {/* Input */}
              <form onSubmit={handleSendChat} className="flex items-center gap-1 pt-1 border-t border-gray-800">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Chat in Realm or /help..."
                  className="flex-1 bg-black/60 border border-gray-800 focus:border-[#b8860b] rounded-lg px-2 py-0.5 text-xs text-white placeholder-gray-500 outline-none"
                />
                <button
                  type="submit"
                  className="p-1 bg-[#b8860b] hover:bg-[#d4af37] text-black rounded-lg cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                </button>
              </form>
            </div>
          ) : (
            <button
              onClick={() => setIsChatExpanded(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/80 border border-gray-800 hover:border-[#b8860b] text-[#fbbf24] text-xs font-mono backdrop-blur-md shadow cursor-pointer active:scale-95 transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Realm Chat ({chatMessages.length})</span>
            </button>
          )}

          {/* Virtual Joystick for Mobile Movement */}
          <div className="relative pl-1 pb-1">
            <VirtualJoystick onMove={handleJoystickMove} />
          </div>
        </div>

        {/* Bottom-Right: Mobile Action Cluster (Attack, Skills 1-5, Target, Interact, Mount) */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto pr-1 pb-1">
          {/* Utility Quick Action Bar (Target Lock, Interact, Mount, Dodge) */}
          <div className="flex items-center gap-1.5">
            {/* Target Lock / Cycle Button */}
            <button
              onClick={onCycleTarget}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/85 border border-red-500/70 text-red-300 flex flex-col items-center justify-center text-[9px] font-mono font-bold backdrop-blur-md shadow-lg active:scale-90 transition-transform cursor-pointer"
              title="Target Next Enemy [Tab]"
            >
              <Crosshair className="w-4 h-4 text-red-400" />
              <span className="text-[7px]">TARGET</span>
            </button>

            {/* Contextual Interact / Loot Button */}
            <button
              onClick={onInteract}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border flex flex-col items-center justify-center text-[9px] font-mono font-bold backdrop-blur-md shadow-lg active:scale-90 transition-transform cursor-pointer ${
                nearbyLoot || nearbyNPC
                  ? 'border-amber-400 bg-amber-500/20 text-amber-300 animate-pulse shadow-[0_0_15px_rgba(251,191,36,0.5)]'
                  : 'border-gray-700 bg-black/80 text-gray-400'
              }`}
              title="Interact / Loot [F]"
            >
              <Hand className="w-4 h-4 text-amber-400" />
              <span className="text-[7px]">ACTION</span>
            </button>

            {/* Mount Summon Button */}
            <button
              onClick={onToggleMount}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border flex flex-col items-center justify-center text-sm font-mono font-bold backdrop-blur-md shadow-lg active:scale-90 transition-transform cursor-pointer ${
                playerStats.isMounted
                  ? 'border-cyan-400 bg-cyan-950 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.5)]'
                  : 'border-gray-700 bg-black/80 text-gray-300'
              }`}
              title="Mount (+100% Speed) [Z]"
            >
              <span>{playerStats.isMounted ? '🏇' : '♞'}</span>
              <span className="text-[7px] text-cyan-300">MOUNT</span>
            </button>

            {/* Dodge / Defensive Skill 3 */}
            <button
              onClick={() => onCastSkill(2)}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/85 border border-purple-500/70 text-purple-300 flex flex-col items-center justify-center text-[9px] font-mono font-bold backdrop-blur-md shadow-lg active:scale-90 transition-transform cursor-pointer"
              title="Dodge / Shield"
            >
              <Shield className="w-4 h-4 text-purple-400" />
              <span className="text-[7px]">SHIELD</span>
            </button>
          </div>

          {/* Mobile Hotbar Skill Buttons Cluster */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-black/85 border border-[#b8860b]/40 backdrop-blur-md shadow-2xl">
            {(playerStats.equippedSkills && playerStats.equippedSkills.length > 0
              ? playerStats.equippedSkills
              : classDef.skills
            ).map((skill, index) => {
              const isOnCd = skill.currentCooldown > 0;
              const isPrimary = index === 0;

              return (
                <button
                  key={skill.id || index}
                  onClick={() => onCastSkill(index)}
                  className={`relative rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer active:scale-90 shadow-inner ${
                    isPrimary
                      ? 'w-13 h-13 sm:w-15 sm:h-15 border-amber-400 bg-gradient-to-br from-amber-600/30 to-black text-2xl sm:text-3xl shadow-[0_0_12px_rgba(251,191,36,0.3)]'
                      : 'w-10 h-10 sm:w-12 sm:h-12 border-gray-700 bg-black/70 text-lg sm:text-xl hover:border-[#fbbf24]'
                  }`}
                  title={`${skill.name} (${skill.resourceCost} ${classDef.resourceName})`}
                >
                  <span className="drop-shadow">{skill.icon}</span>

                  {/* Cooldown Overlay */}
                  {isOnCd && (
                    <div className="absolute inset-0 bg-black/85 rounded-xl flex items-center justify-center text-[10px] sm:text-xs font-mono font-bold text-amber-300">
                      {skill.currentCooldown.toFixed(1)}s
                    </div>
                  )}

                  {/* Keybind Index Badge */}
                  <span className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded bg-black border border-gray-700 text-[#fbbf24] font-mono font-bold text-[8px] flex items-center justify-center shadow">
                    {index + 1}
                  </span>

                  {/* Resource Cost Pill */}
                  <span className="absolute -bottom-1 -right-1 px-0.5 bg-black/90 rounded border border-gray-800 text-[7px] font-mono text-gray-400">
                    {skill.resourceCost}
                  </span>
                </button>
              );
            })}
          </div>

          {/* XP Progression Line */}
          <div className="w-full max-w-xs h-1 bg-black/90 rounded-full border border-gray-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all duration-200"
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
