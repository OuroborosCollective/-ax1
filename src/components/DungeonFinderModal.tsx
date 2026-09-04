import React, { useState, useEffect } from 'react';
import {
  Shield,
  Heart,
  Sword,
  Compass,
  Clock,
  CheckCircle,
  Users,
  X,
  Sparkles,
  AlertCircle,
  Flame,
  Zap,
} from 'lucide-react';
import { DungeonDefinition, DungeonQueueState, ItemRarity, RPGItem } from '../types';
import { DUNGEON_CATALOG } from '../data/professionsData';

interface DungeonFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerLevel: number;
  playerName: string;
  onEnterDungeon: (dungeon: DungeonDefinition, rewardXP: number, rewardGold: number) => void;
}

export const DungeonFinderModal: React.FC<DungeonFinderModalProps> = ({
  isOpen,
  onClose,
  playerLevel,
  playerName,
  onEnterDungeon,
}) => {
  const [selectedDungeonId, setSelectedDungeonId] = useState<string>(DUNGEON_CATALOG[0].id);
  const [selectedRole, setSelectedRole] = useState<'tank' | 'healer' | 'dps'>('dps');
  const [queueState, setQueueState] = useState<DungeonQueueState>({
    dungeonId: null,
    selectedRole: 'dps',
    status: 'idle',
    queueStartTime: null,
    elapsedSeconds: 0,
    matchedParty: {
      tank: null,
      healer: null,
      dps: [],
    },
  });

  // Handle queue timer
  useEffect(() => {
    let timer: any = null;
    if (queueState.status === 'queuing') {
      timer = setInterval(() => {
        setQueueState((prev) => {
          const nextSec = prev.elapsedSeconds + 1;

          // Simulate realistic dungeon match after 4-6 seconds
          if (nextSec >= 5 && prev.status === 'queuing') {
            return {
              ...prev,
              status: 'group_found',
              elapsedSeconds: nextSec,
              matchedParty: {
                tank: prev.selectedRole === 'tank' ? playerName : 'Paladin Valerius',
                healer: prev.selectedRole === 'healer' ? playerName : 'Klerikerin Lyra',
                dps: [
                  prev.selectedRole === 'dps' ? playerName : 'Waldläufer Thorne',
                  'Arkanistin Selene',
                  'Schattenklinge Corvus',
                ],
              },
            };
          }

          return { ...prev, elapsedSeconds: nextSec };
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [queueState.status, playerName]);

  if (!isOpen) return null;

  const selectedDungeon = DUNGEON_CATALOG.find((d) => d.id === selectedDungeonId) || DUNGEON_CATALOG[0];
  const levelTooLow = playerLevel < selectedDungeon.levelReq;

  const handleStartQueue = () => {
    if (levelTooLow) return;
    setQueueState({
      dungeonId: selectedDungeon.id,
      selectedRole,
      status: 'queuing',
      queueStartTime: Date.now(),
      elapsedSeconds: 0,
      matchedParty: {
        tank: null,
        healer: null,
        dps: [],
      },
    });
  };

  const handleLeaveQueue = () => {
    setQueueState({
      dungeonId: null,
      selectedRole,
      status: 'idle',
      queueStartTime: null,
      elapsedSeconds: 0,
      matchedParty: {
        tank: null,
        healer: null,
        dps: [],
      },
    });
  };

  const handleAcceptDungeon = () => {
    onEnterDungeon(selectedDungeon, selectedDungeon.rewards.xp, selectedDungeon.rewards.gold);
    handleLeaveQueue();
    onClose();
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-4xl bg-[#081a2e] border-2 border-amber-500/50 rounded-2xl p-4 sm:p-5 text-gray-200 shadow-[0_0_50px_rgba(0,240,255,0.2)] flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
              <Compass className="w-5 h-5 text-[#00f0ff]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-serif font-bold text-white flex items-center gap-2 tracking-wide">
                DUNGEON-FINDER & GRUPPENSUCHE
              </h3>
              <p className="text-[11px] text-gray-400 font-sans">
                Wähle deine Gruppenrolle, finde Mitstreiter und betritt mythische Instanzen
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-black/50 border border-gray-800 hover:border-amber-500 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 py-3 min-h-0 overflow-y-auto custom-scrollbar">
          
          {/* Left Column: Role Selection & Dungeon List (5 cols) */}
          <div className="md:col-span-5 flex flex-col space-y-3 bg-black/40 p-3.5 rounded-2xl border border-gray-800">
            {/* Role Selection */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-serif font-bold text-amber-300 uppercase tracking-widest block">
                1. Gruppen-Rolle wählen
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'tank', label: 'Verteidiger', sub: 'Tank', icon: <Shield className="w-4 h-4 text-blue-400" /> },
                    { id: 'healer', label: 'Heiler', sub: 'Support', icon: <Heart className="w-4 h-4 text-emerald-400" /> },
                    { id: 'dps', label: 'Schaden', sub: 'DPS', icon: <Sword className="w-4 h-4 text-red-400" /> },
                  ] as const
                ).map((r) => {
                  const isSelected = selectedRole === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRole(r.id)}
                      disabled={queueState.status !== 'idle'}
                      className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#00f0ff]/15 border-[#00f0ff] text-white shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                          : 'bg-black/50 border-gray-800 text-gray-400 hover:border-gray-700'
                      }`}
                    >
                      {r.icon}
                      <span className="text-xs font-serif font-bold">{r.label}</span>
                      <span className="text-[9px] font-mono text-gray-400">{r.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dungeon Catalog List */}
            <div className="space-y-1.5 flex-1 overflow-y-auto custom-scrollbar pr-1">
              <span className="text-[11px] font-serif font-bold text-amber-300 uppercase tracking-widest block">
                2. Instanz auswählen
              </span>
              <div className="space-y-2">
                {DUNGEON_CATALOG.map((dungeon) => {
                  const isSelected = selectedDungeonId === dungeon.id;
                  const isLocked = playerLevel < dungeon.levelReq;

                  return (
                    <button
                      key={dungeon.id}
                      onClick={() => setSelectedDungeonId(dungeon.id)}
                      disabled={queueState.status !== 'idle'}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-2.5 cursor-pointer ${
                        isSelected
                          ? 'bg-[#081a2e] border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : 'bg-black/50 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <span className="text-2xl shrink-0">{dungeon.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-serif font-bold text-xs text-white truncate">
                            {dungeon.germanName}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-1.5 rounded ${
                              isLocked
                                ? 'bg-red-950/70 text-red-300 border border-red-800/40'
                                : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/40'
                            }`}
                          >
                            Stufe {dungeon.levelReq}+
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">{dungeon.zone}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Dungeon Details & Matchmaking Status (7 cols) */}
          <div className="md:col-span-7 bg-black/60 rounded-2xl border border-gray-800 p-4.5 flex flex-col justify-between space-y-4 overflow-y-auto custom-scrollbar">
            {/* Dungeon Banner Card */}
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/50 via-black to-[#081a2e] border border-amber-500/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-3xl">{selectedDungeon.icon}</span>
                    <div>
                      <h4 className="font-serif font-bold text-base text-amber-200">
                        {selectedDungeon.germanName}
                      </h4>
                      <span className="text-[11px] font-mono text-[#00f0ff]">
                        Gebiet: {selectedDungeon.zone} • Empf. Gegenstandsstufe: {selectedDungeon.recommendedIlvl}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {selectedDungeon.bossCount} Bosse
                  </span>
                </div>

                <p className="text-xs text-gray-300 mt-2.5 leading-relaxed">
                  {selectedDungeon.description}
                </p>
              </div>

              {/* Bosses & Rewards */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-black/50 border border-gray-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-gray-400 block">Dungeon-Bosse</span>
                  <ul className="space-y-0.5 text-amber-100 font-serif text-[11px]">
                    {selectedDungeon.bosses.map((b, idx) => (
                      <li key={idx} className="flex items-center gap-1.5">
                        <Flame className="w-3 h-3 text-red-400" /> {b}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 rounded-xl bg-black/50 border border-gray-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-gray-400 block">Abschluss-Beute</span>
                  <div className="space-y-1 font-mono text-[11px]">
                    <div className="text-amber-300">🪙 +{selectedDungeon.rewards.gold} Gold</div>
                    <div className="text-emerald-300">✨ +{selectedDungeon.rewards.xp} Gruppen-XP</div>
                    <div className="text-[#00f0ff]">🛡️ Garantiertes {selectedDungeon.rewards.gearRarity.toUpperCase()} Rüstungsteil</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Matchmaking Queue State Panel */}
            <div className="p-4 rounded-xl bg-black/70 border border-gray-800 space-y-3">
              {queueState.status === 'idle' && (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-serif font-bold text-xs text-gray-200 block">
                      Bereit für die Gruppensuche
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Rolle: <strong>{selectedRole.toUpperCase()}</strong> für {selectedDungeon.germanName}
                    </span>
                  </div>

                  <button
                    onClick={handleStartQueue}
                    disabled={levelTooLow}
                    className={`py-2.5 px-5 rounded-xl font-serif font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                      levelTooLow
                        ? 'bg-gray-800 border border-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:brightness-110 text-black shadow-[0_0_20px_rgba(245,158,11,0.35)]'
                    }`}
                  >
                    <Users className="w-4 h-4" /> In Warteschlange einreihen
                  </button>
                </div>
              )}

              {queueState.status === 'queuing' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#00f0ff] animate-spin" />
                      <div>
                        <span className="font-serif font-bold text-xs text-[#00f0ff] block">
                          Suche Mitstreiter für {selectedDungeon.germanName}...
                        </span>
                        <span className="text-[10px] font-mono text-gray-400">
                          Wartezeit: {formatTime(queueState.elapsedSeconds)} (Durchschnitt: 00:08)
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleLeaveQueue}
                      className="px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-300 text-xs font-mono cursor-pointer"
                    >
                      Warteschlange verlassen
                    </button>
                  </div>

                  {/* Visual Party Slot Indicators */}
                  <div className="grid grid-cols-5 gap-2 p-2.5 rounded-lg bg-black/60 border border-gray-800 text-center text-[10px] font-mono">
                    <div className="p-1.5 rounded bg-blue-950/40 border border-blue-600/40 text-blue-300">
                      🛡️ Tank (1/1)
                    </div>
                    <div className="p-1.5 rounded bg-emerald-950/40 border border-emerald-600/40 text-emerald-300">
                      💚 Heiler (1/1)
                    </div>
                    <div className="p-1.5 rounded bg-red-950/40 border border-red-600/40 text-red-300">
                      ⚔️ DPS (1/3)
                    </div>
                    <div className="p-1.5 rounded bg-red-950/40 border border-red-600/40 text-red-300">
                      ⚔️ DPS (2/3)
                    </div>
                    <div className="p-1.5 rounded bg-black/40 border border-gray-800 text-gray-500">
                      ⚔️ Suche...
                    </div>
                  </div>
                </div>
              )}

              {queueState.status === 'group_found' && (
                <div className="space-y-3 animate-in zoom-in-95 duration-200">
                  <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/60 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <div>
                        <span className="font-serif font-bold text-sm text-emerald-200 block">
                          Gruppe gefunden! Alle Mitglieder bereit.
                        </span>
                        <span className="text-[10px] font-mono text-gray-300">
                          Instanz: {selectedDungeon.germanName} • 5/5 Helden
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleAcceptDungeon}
                      className="py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 text-black font-serif font-bold text-xs shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer"
                    >
                      Dungeon betreten!
                    </button>
                  </div>

                  {/* Matched Party Roster */}
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-[10px] font-mono">
                    <div className="p-2 rounded-lg bg-black/80 border border-blue-500/50 text-blue-300">
                      <div className="text-base">🛡️</div>
                      <div className="truncate font-bold">{queueState.matchedParty.tank}</div>
                      <div className="text-gray-500">Tank</div>
                    </div>
                    <div className="p-2 rounded-lg bg-black/80 border border-emerald-500/50 text-emerald-300">
                      <div className="text-base">💚</div>
                      <div className="truncate font-bold">{queueState.matchedParty.healer}</div>
                      <div className="text-gray-500">Heiler</div>
                    </div>
                    {queueState.matchedParty.dps.map((name, i) => (
                      <div key={i} className="p-2 rounded-lg bg-black/80 border border-red-500/50 text-red-300">
                        <div className="text-base">⚔️</div>
                        <div className="truncate font-bold">{name}</div>
                        <div className="text-gray-500">Schaden</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
