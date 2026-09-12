import React, { useState } from 'react';
import {
  Shield,
  Flame,
  Zap,
  Clock,
  Skull,
  Award,
  Sparkles,
  ChevronRight,
  LogOut,
  Package,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';
import { DungeonInstanceProgress, RPGItem } from '../types';

interface DungeonInstanceOverlayProps {
  instance: DungeonInstanceProgress;
  onOpenRewardChest: () => void;
  onExitDungeon: () => void;
}

export const DungeonInstanceOverlay: React.FC<DungeonInstanceOverlayProps> = ({
  instance,
  onOpenRewardChest,
  onExitDungeon,
}) => {
  const [showChestModal, setShowChestModal] = useState<boolean>(true);

  const { dungeon, activeBoss, elapsedSeconds, rankRating, deathCount, trashMobsAlive, totalTrashMobs, status } =
    instance;

  const isBossActive = status === 'boss_active' || activeBoss !== null;
  const isVictory = status === 'victory';

  // Format Elapsed Time
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = Math.floor(elapsedSeconds % 60);
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <>
      {/* 1. TOP DUNGEON INSTANCE HUD */}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-30 flex flex-col items-center px-4">
        {/* Active Boss Vitals & Phase Bar */}
        {activeBoss && !isVictory && (
          <div className="pointer-events-auto w-full max-w-2xl bg-black/85 backdrop-blur-md rounded-2xl border border-red-500/40 p-3.5 shadow-[0_0_35px_rgba(239,68,68,0.25)] animate-in slide-in-from-top-4">
            {/* Header: Name, Title & Phase */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-950/80 border border-red-500/60 flex items-center justify-center text-xl shadow-md">
                  👑
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-sm text-red-100 drop-shadow">
                      {activeBoss.name}
                    </span>
                    {activeBoss.isEnraged && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-600 text-white animate-pulse">
                        🔥 ENRAGE!
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-gray-400 block">
                    {activeBoss.title}
                  </span>
                </div>
              </div>

              {/* Boss Phase Indicator */}
              <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1 rounded-xl border border-gray-800">
                <span className="text-xs font-mono text-gray-400">PHASE</span>
                <span className="text-sm font-serif font-bold text-amber-400">
                  {activeBoss.phase}/3
                </span>
              </div>
            </div>

            {/* Boss HP Bar */}
            <div className="mt-2.5 space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-red-300 font-bold">
                  {activeBoss.hp.toLocaleString()} / {activeBoss.maxHp.toLocaleString()} HP
                </span>
                <span className="text-gray-400">
                  {Math.round((activeBoss.hp / activeBoss.maxHp) * 100)}%
                </span>
              </div>

              <div className="relative w-full h-3.5 bg-gray-950 rounded-full overflow-hidden border border-red-900/60">
                <div
                  className={`h-full transition-all duration-300 ${
                    activeBoss.isEnraged
                      ? 'bg-gradient-to-r from-orange-500 via-red-600 to-rose-700 animate-pulse'
                      : 'bg-gradient-to-r from-red-600 to-rose-500'
                  }`}
                  style={{ width: `${Math.max(0, (activeBoss.hp / activeBoss.maxHp) * 100)}%` }}
                />

                {/* Shield Overlay Bar if active */}
                {activeBoss.isShieldActive && activeBoss.shieldHp > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 bg-cyan-400/80 border-r-2 border-white animate-pulse"
                    style={{
                      width: `${Math.min(100, (activeBoss.shieldHp / activeBoss.maxShieldHp) * 100)}%`,
                    }}
                  />
                )}
              </div>
            </div>

            {/* Spell Cast Progress Bar (if casting) */}
            {activeBoss.castSkillName && activeBoss.castProgress !== undefined && (
              <div className="mt-2 pt-2 border-t border-gray-800/80">
                <div className="flex items-center justify-between text-[11px] font-mono text-amber-300 mb-1">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400 animate-spin" /> Wirkt: {activeBoss.castSkillName}
                  </span>
                  <span>{Math.round(activeBoss.castProgress)}%</span>
                </div>
                <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-100"
                    style={{ width: `${activeBoss.castProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Mechanic Hint */}
            <div className="mt-2 text-[11px] text-gray-300 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10 font-sans">
              💡 {activeBoss.mechanicDescription}
            </div>
          </div>
        )}
      </div>

      {/* 2. TOP-LEFT INSTANCE OBJECTIVE & TIME TRACKER */}
      <div className="pointer-events-none fixed top-4 left-4 z-20">
        <div className="pointer-events-auto bg-black/80 backdrop-blur-md rounded-2xl border border-amber-500/30 p-3 shadow-xl max-w-xs space-y-2">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{dungeon.icon}</span>
              <div>
                <span className="font-serif font-bold text-xs text-amber-200 block">
                  {dungeon.germanName}
                </span>
                <span className="text-[10px] font-mono text-gray-400">{dungeon.zone}</span>
              </div>
            </div>

            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40">
              {rankRating}
            </span>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex items-center justify-between text-gray-300">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" /> Zeit:
              </span>
              <span className="text-white font-bold">{formattedTime}</span>
            </div>

            <div className="flex items-center justify-between text-gray-300">
              <span className="flex items-center gap-1">
                <Skull className="w-3.5 h-3.5 text-red-400" /> Tode:
              </span>
              <span className="text-white">{deathCount}</span>
            </div>

            <div className="pt-1 border-t border-gray-800 flex items-center justify-between text-gray-200">
              <span>Ziel:</span>
              <span className="text-amber-300">
                {trashMobsAlive > 0
                  ? `Wächter (${totalTrashMobs - trashMobsAlive}/${totalTrashMobs})`
                  : isVictory
                  ? 'Gewölbe abgeschlossen! 🎉'
                  : 'Boss bezwingen!'}
              </span>
            </div>
          </div>

          <button
            onClick={onExitDungeon}
            className="w-full mt-2 py-1 px-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 font-mono text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
          >
            <LogOut className="w-3 h-3" /> Instanz verlassen
          </button>
        </div>
      </div>

      {/* 3. VICTORY REWARD CHEST MODAL */}
      {isVictory && showChestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-xl bg-gradient-to-b from-[#1c1917] via-[#0c0a09] to-black rounded-3xl border-2 border-amber-500/60 p-6 shadow-[0_0_60px_rgba(245,158,11,0.35)] space-y-5">
            {/* Header */}
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 font-mono text-xs">
                <Sparkles className="w-3.5 h-3.5" /> GEWÖLBE ERFOLGREICH BEZWUNGEN
              </div>
              <h2 className="font-serif font-black text-2xl text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-400">
                {dungeon.germanName}
              </h2>
              <p className="text-xs text-gray-400 font-mono">
                Laufzeit: {formattedTime} • Rang: <strong className="text-amber-300">{rankRating}</strong>
              </p>
            </div>

            {/* 3D Chest / Interactive Loot Box */}
            <div className="relative p-5 rounded-2xl bg-black/60 border border-amber-500/30 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-600 to-yellow-400 border-2 border-white/40 flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(245,158,11,0.5)] animate-bounce">
                🎁
              </div>

              {!instance.chestOpened ? (
                <div className="space-y-2">
                  <h3 className="font-serif font-bold text-lg text-white">
                    Titanische Belohnungstruhe
                  </h3>
                  <p className="text-xs text-gray-300 max-w-xs">
                    Öffne die Gewölbe-Truhe, um epische Beute, Gold, Gruppen-XP und Gewölbe-Medaillen zu bergen!
                  </p>
                  <button
                    onClick={onOpenRewardChest}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-serif font-black text-sm shadow-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center gap-2 mx-auto"
                  >
                    <Package className="w-4 h-4" /> Belohnungstruhe öffnen
                  </button>
                </div>
              ) : (
                <div className="w-full space-y-3">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-serif font-bold text-sm">
                    <CheckCircle className="w-4 h-4" /> Beute geborgen!
                  </div>

                  {/* Loot Item Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                    {instance.chestLoot.items.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${
                          item.rarity === 'legendary'
                            ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                            : 'bg-purple-950/40 border-purple-500 text-purple-200'
                        }`}
                      >
                        <span className="text-2xl">{item.icon}</span>
                        <div>
                          <span className="font-serif font-bold text-xs block text-white">
                            {item.name}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400 uppercase">
                            {item.rarity} {item.slot}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Currency summary */}
                  <div className="flex items-center justify-around p-2.5 rounded-xl bg-black/40 border border-gray-800 text-xs font-mono">
                    <span className="text-amber-400">💰 +{instance.chestLoot.gold} Gold</span>
                    <span className="text-cyan-400">✨ +{instance.chestLoot.xp} XP</span>
                    <span className="text-purple-400">🏅 +{instance.chestLoot.tokens} Abzeichen</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={() => setShowChestModal(false)}
                className="px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 font-mono text-xs cursor-pointer"
              >
                In der Instanz verweilen
              </button>

              <button
                onClick={onExitDungeon}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-[#00f0ff] text-black font-serif font-bold text-xs hover:brightness-110 shadow-lg cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" /> Zum Oberwelt-Portal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
