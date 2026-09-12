import React, { useState } from 'react';
import {
  Compass,
  ChevronDown,
  ChevronUp,
  X,
  Package,
  Sparkles,
  Navigation,
  AlertCircle,
} from 'lucide-react';
import { LeylineRiftEvent, WorldEventAlert } from '../types';

interface WorldEventOverlayProps {
  activeRifts: LeylineRiftEvent[];
  recentAlerts: WorldEventAlert[];
  playerCoords: { x: number; z: number };
  onTrackRift?: (rift: LeylineRiftEvent) => void;
  onCollectRiftLoot?: (riftId: string) => void;
  onDismissAlert?: (alertId: string) => void;
}

export const WorldEventOverlay: React.FC<WorldEventOverlayProps> = ({
  activeRifts,
  recentAlerts,
  playerCoords,
  onTrackRift,
  onCollectRiftLoot,
  onDismissAlert,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const activeAlert = recentAlerts[0] || null;
  const hasRifts = activeRifts.length > 0;

  return (
    <div className="pointer-events-none fixed top-24 left-3 z-30 select-none flex flex-col items-start gap-2">
      {/* 1. TOP-LEFT COMPACT CLICKABLE ICON BUTTON */}
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          id="btn-toggle-leylinerifts"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-lg transition-all duration-200 cursor-pointer active:scale-95 ${
            isOpen
              ? 'bg-cyan-950/90 border-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.4)] text-white'
              : hasRifts
              ? 'bg-black/85 hover:bg-cyan-950/70 border-cyan-500/50 hover:border-[#00f0ff] text-cyan-100 shadow-[0_0_12px_rgba(0,240,255,0.25)]'
              : 'bg-black/75 hover:bg-black/90 border-gray-700/60 text-gray-300'
          }`}
          title="Leylinien-Risse Welt-Events öffnen/schließen"
        >
          {/* Glowing Animated Icon */}
          <div className="relative flex items-center justify-center">
            <span
              className={`text-lg transition-transform duration-300 ${
                hasRifts ? 'animate-spin-slow' : ''
              }`}
            >
              🌀
            </span>
            {hasRifts && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00f0ff] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00f0ff]" />
              </span>
            )}
          </div>

          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-serif font-bold text-xs tracking-wide text-[#00f0ff] group-hover:text-white transition-colors">
                Leylinien-Risse
              </span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${
                  hasRifts
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-500/40'
                    : 'bg-black/50 text-gray-400 border-gray-700'
                }`}
              >
                {activeRifts.length}
              </span>
            </div>
          </div>

          <ChevronDown
            className={`w-3.5 h-3.5 text-cyan-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Subtle mini notification toast when new alert arrives without opening menu */}
        {!isOpen && activeAlert && (
          <div
            onClick={() => setIsOpen(true)}
            className="animate-in fade-in slide-in-from-left-2 duration-200 cursor-pointer px-2.5 py-1 rounded-lg bg-cyan-950/90 border border-cyan-500/60 shadow-md text-cyan-200 text-xs flex items-center gap-1.5 hover:brightness-110"
          >
            <span className="text-xs">{activeAlert.icon || '⚠️'}</span>
            <span className="font-serif text-[11px] font-medium max-w-[180px] truncate">
              {activeAlert.title}
            </span>
          </div>
        )}
      </div>

      {/* 2. COLLAPSIBLE POPUP PANEL */}
      {isOpen && (
        <div className="pointer-events-auto w-80 sm:w-96 bg-black/95 backdrop-blur-xl border border-cyan-500/50 rounded-2xl shadow-[0_0_30px_rgba(0,240,255,0.25)] p-3.5 text-white animate-in fade-in slide-in-from-top-2 duration-200 max-h-[75vh] flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-cyan-900/50 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-base">🌀</span>
              <div>
                <h3 className="font-serif font-bold text-sm text-[#00f0ff]">
                  Aktive Leylinien-Risse
                </h3>
                <p className="text-[10px] text-gray-400 font-mono">
                  Dynamische Zonen-Ereignisse ({activeRifts.length})
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg bg-black/60 hover:bg-black text-gray-400 hover:text-white border border-gray-800 transition-colors cursor-pointer"
              title="Schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Active Alert Banner inside Panel */}
          {activeAlert && (
            <div
              className={`p-2.5 rounded-xl border flex items-start justify-between gap-2 ${
                activeAlert.tier === 'mythic'
                  ? 'bg-purple-950/60 border-purple-500/50 text-purple-100'
                  : activeAlert.tier === 'heroic'
                  ? 'bg-amber-950/60 border-amber-500/50 text-amber-100'
                  : 'bg-cyan-950/60 border-cyan-500/50 text-cyan-100'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">{activeAlert.icon || '⚠️'}</span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-serif font-bold text-xs text-white">
                      {activeAlert.title}
                    </span>
                    <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-black/50 border border-white/20">
                      {activeAlert.tier}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300 mt-0.5 leading-tight">
                    {activeAlert.message}
                  </p>
                </div>
              </div>

              {onDismissAlert && (
                <button
                  onClick={() => onDismissAlert(activeAlert.id)}
                  className="p-1 text-gray-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Rifts List */}
          <div className="space-y-2.5 overflow-y-auto max-h-[50vh] pr-1 custom-scrollbar">
            {activeRifts.length === 0 ? (
              <div className="py-6 text-center text-gray-400">
                <Sparkles className="w-6 h-6 mx-auto mb-2 text-cyan-400/60" />
                <p className="font-serif text-xs text-gray-300">
                  Die Leylinien sind aktuell stabil.
                </p>
                <p className="text-[10px] font-mono text-gray-500 mt-1">
                  Neue Risse erscheinen periodisch in der offenen Welt.
                </p>
              </div>
            ) : (
              activeRifts.map((rift) => {
                const dist = Math.round(
                  Math.hypot(
                    playerCoords.x - rift.coords.x,
                    playerCoords.z - rift.coords.z
                  )
                );
                const isSealed = rift.phase === 'sealed';

                return (
                  <div
                    key={rift.id}
                    className={`p-2.5 rounded-xl border transition-all ${
                      isSealed
                        ? 'bg-emerald-950/40 border-emerald-500/50'
                        : rift.tier === 'mythic'
                        ? 'bg-purple-950/30 border-purple-500/40'
                        : 'bg-black/60 border-cyan-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{rift.icon}</span>
                        <span className="font-serif font-bold text-xs text-gray-100">
                          {rift.germanName}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          isSealed
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-black/50 text-cyan-300 border border-cyan-500/40'
                        }`}
                      >
                        {isSealed ? 'VERSIEGELT' : `${dist}m Entfernt`}
                      </span>
                    </div>

                    {/* Instability Bar / Timer */}
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-cyan-200">{rift.phaseName}</span>
                        {!isSealed && (
                          <span className="text-amber-300">
                            ⏱️ {Math.floor(rift.timeRemainingSec)}s
                          </span>
                        )}
                      </div>

                      {!isSealed ? (
                        <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden border border-gray-800">
                          <div
                            className={`h-full transition-all duration-300 ${
                              rift.instabilityPercent > 75
                                ? 'bg-gradient-to-r from-orange-500 to-red-500'
                                : 'bg-gradient-to-r from-teal-500 to-[#00f0ff]'
                            }`}
                            style={{ width: `${rift.instabilityPercent}%` }}
                          />
                        </div>
                      ) : (
                        <div className="w-full bg-emerald-950 rounded-full h-1.5 overflow-hidden border border-emerald-800">
                          <div className="h-full bg-emerald-400 w-full" />
                        </div>
                      )}
                    </div>

                    {/* Actions & Rewards */}
                    <div className="mt-2.5 flex items-center justify-between gap-2 pt-1.5 border-t border-gray-800/80">
                      <span className="text-[10px] text-gray-400 font-mono">
                        +{rift.rewards.gold} Gold • +{rift.rewards.leylineShards} Scherben
                      </span>

                      {isSealed && !rift.chestOpened ? (
                        <button
                          onClick={() => onCollectRiftLoot?.(rift.id)}
                          className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-400 text-black font-serif font-bold text-[11px] hover:brightness-110 shadow-lg cursor-pointer flex items-center gap-1 active:scale-95"
                        >
                          <Package className="w-3.5 h-3.5" /> Beute öffnen
                        </button>
                      ) : (
                        <button
                          onClick={() => onTrackRift?.(rift)}
                          className="px-2 py-0.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 font-mono text-[10px] cursor-pointer flex items-center gap-1 active:scale-95"
                        >
                          <Compass className="w-3 h-3" /> Wegpunkt
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

