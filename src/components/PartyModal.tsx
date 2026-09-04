import React from 'react';
import { X, Users, UserPlus, Crown, ShieldAlert, Sparkles, UserMinus, LogOut, Swords, Heart, Zap, Coins } from 'lucide-react';
import { PartyMember, SimulatedPlayer } from '../types';
import { MMORPG_CLASSES } from '../data/mmorpgData';

interface PartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  partyMembers?: PartyMember[];
  availablePlayers?: SimulatedPlayer[];
  nearbyPlayers?: SimulatedPlayer[];
  lootRule?: string;
  onInvitePlayer: (player: SimulatedPlayer) => void;
  onRemoveMember?: (memberId: string) => void;
  onKickMember?: (memberId: string) => void;
  onLeaveParty: () => void;
  onPromoteLeader: (memberId: string) => void;
  onSetLootRule?: (rule: any) => void;
}

const DEFAULT_REALM_CHAMPIONS: SimulatedPlayer[] = [
  { id: 'champ_1', name: 'Valerius of Sun Spire', className: 'Sun Paladin', classId: 'knight', level: 12, guildTag: '<Aethelgard Custodians>', x: 0, y: 0, z: 0, action: 'patrolling' },
  { id: 'champ_2', name: 'Lyra Voidwhisper', className: 'Shadow Weaver', classId: 'mage', level: 11, guildTag: '<Echo Weavers>', x: 0, y: 0, z: 0, action: 'patrolling' },
  { id: 'champ_3', name: 'Thorn Stormcaller', className: 'Arc Warden', classId: 'ranger', level: 10, guildTag: '<Stormwatch>', x: 0, y: 0, z: 0, action: 'patrolling' },
  { id: 'champ_4', name: 'Kaelen Emberforge', className: 'Aether Mechanic', classId: 'engineer', level: 13, guildTag: '<Emberfall Smiths>', x: 0, y: 0, z: 0, action: 'patrolling' },
  { id: 'champ_5', name: 'Zephyr Windstride', className: 'Gale Scout', classId: 'ranger', level: 12, guildTag: '<Windhollow Scouts>', x: 0, y: 0, z: 0, action: 'patrolling' },
];

export const PartyModal: React.FC<PartyModalProps> = ({
  isOpen,
  onClose,
  partyMembers = [],
  availablePlayers,
  nearbyPlayers,
  lootRule = 'round_robin',
  onInvitePlayer,
  onRemoveMember,
  onKickMember,
  onLeaveParty,
  onPromoteLeader,
  onSetLootRule,
}) => {
  if (!isOpen) return null;

  const safePartyMembers = Array.isArray(partyMembers) ? partyMembers : [];
  const candidatePool: SimulatedPlayer[] = Array.isArray(availablePlayers) && availablePlayers.length > 0
    ? availablePlayers
    : Array.isArray(nearbyPlayers) && nearbyPlayers.length > 0
    ? nearbyPlayers
    : DEFAULT_REALM_CHAMPIONS;

  const maxPartySize = 5;
  const isFull = safePartyMembers.length >= maxPartySize;
  const inParty = safePartyMembers.length > 1;

  // Filter available players that aren't already in party
  const recruitCandidates = candidatePool.filter(
    (p) => p && !safePartyMembers.some((m) => m && (m.id === p.id || m.name === p.name))
  );

  const handleKick = (memberId: string) => {
    if (onKickMember) {
      onKickMember(memberId);
    } else if (onRemoveMember) {
      onRemoveMember(memberId);
    }
  };

  const isSelfLeader = safePartyMembers.find((m) => m.id === 'player_self')?.isLeader ?? true;

  return (
    <div
      id="party-modal-overlay"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
    >
      <div
        id="party-dialog"
        className="w-full max-w-4xl bg-[#11141a] border border-[#b8860b]/40 rounded-2xl p-5 sm:p-6 text-gray-200 shadow-[0_0_40px_rgba(184,134,11,0.15)] flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-black/80 border-2 border-[#b8860b] flex items-center justify-center text-[#b8860b] shadow-[0_0_12px_rgba(184,134,11,0.25)]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-serif font-bold text-white flex items-center gap-2">
                PARTY & ADVENTURING SQUAD
              </h3>
              <p className="text-xs text-gray-400 font-sans">
                Group up with fellow realm champions to share quest objectives, loot & combat buffs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-lg bg-black/60 border border-gray-800 text-amber-300 font-mono text-xs flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>
                {safePartyMembers.length} / {maxPartySize} Members
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-black/50 border border-gray-800 hover:border-[#b8860b] text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Party Perks & Loot Rule Banner */}
        <div className="my-3 p-3 rounded-xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-black border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-200 font-sans">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Active Party Synergy:</strong> +{Math.max(0, (safePartyMembers.length - 1) * 15)}% Bonus Exp &amp;
              Universal Quest Kill Sharing Active!
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onSetLootRule && isSelfLeader && (
              <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-lg border border-gray-800 text-[11px]">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-gray-400">Loot:</span>
                <select
                  value={lootRule}
                  onChange={(e) => onSetLootRule(e.target.value)}
                  className="bg-transparent text-amber-300 font-mono focus:outline-none cursor-pointer"
                >
                  <option value="round_robin" className="bg-[#11141a] text-white">Round Robin</option>
                  <option value="free_for_all" className="bg-[#11141a] text-white">Free For All</option>
                  <option value="need_before_greed" className="bg-[#11141a] text-white">Need / Greed</option>
                  <option value="master_looter" className="bg-[#11141a] text-white">Master Looter</option>
                </select>
              </div>
            )}

            {inParty && (
              <button
                onClick={onLeaveParty}
                className="px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-200 font-serif font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Leave Party
              </button>
            )}
          </div>
        </div>

        {/* 2-Column Layout: Active Party Members | Realm Adventurers to Invite */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 overflow-y-auto pr-1">
          {/* Column 1: Current Party Members (7 cols) */}
          <div className="lg:col-span-7 bg-black/50 rounded-xl border border-gray-800/90 p-4 flex flex-col space-y-3">
            <div className="text-[11px] font-serif font-bold text-[#b8860b] uppercase tracking-widest pb-1 border-b border-gray-800/80 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-[#b8860b]" /> Active Party Roster
              </span>
              <span className="text-gray-500 font-mono text-[10px]">
                {inParty ? 'Synchronized Group' : 'Solo Adventurer'}
              </span>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto">
              {safePartyMembers.map((member) => {
                const classDef = MMORPG_CLASSES[member.classId] || MMORPG_CLASSES['knight'];
                const isSelf = member.id === 'player_self';
                const hpPct = Math.round((member.hp / member.maxHp) * 100);
                const resPct = Math.round((member.resource / member.maxResource) * 100);

                return (
                  <div
                    key={member.id}
                    className={`p-3 rounded-xl border transition-all ${
                      member.isLeader
                        ? 'bg-gradient-to-r from-black/80 to-amber-950/20 border-amber-500/50'
                        : 'bg-black/60 border-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-lg border relative"
                          style={{
                            backgroundColor: `${classDef.color}20`,
                            borderColor: classDef.color,
                          }}
                        >
                          {member.avatarIcon || classDef.icon}
                          {member.isLeader && (
                            <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-black rounded-full p-0.5 shadow">
                              <Crown className="w-3 h-3 fill-black" />
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-serif font-bold text-white">
                              {member.name} {isSelf && <span className="text-gray-400 font-sans font-normal">(You)</span>}
                            </span>
                            <span
                              className="text-[10px] font-mono px-1.5 py-0.2 rounded border font-bold"
                              style={{
                                color: classDef.color,
                                borderColor: `${classDef.color}50`,
                                backgroundColor: `${classDef.color}15`,
                              }}
                            >
                              Lv.{member.level} {member.className}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono flex items-center gap-2 mt-0.5">
                            <span>Zone: {member.zone}</span>
                            <span>•</span>
                            <span className="text-amber-400 font-bold">⚔️ {member.dps} DPS</span>
                          </div>
                        </div>
                      </div>

                      {/* Management Controls */}
                      {!isSelf && (
                        <div className="flex items-center gap-1.5">
                          {!member.isLeader && (
                            <button
                              onClick={() => onPromoteLeader(member.id)}
                              title="Promote to Party Leader"
                              className="p-1.5 rounded-lg bg-black/60 border border-amber-500/40 hover:bg-amber-950 text-amber-300 transition-colors cursor-pointer text-xs"
                            >
                              <Crown className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleKick(member.id)}
                            title="Remove from Party"
                            className="p-1.5 rounded-lg bg-black/60 border border-red-500/40 hover:bg-red-950 text-red-400 transition-colors cursor-pointer text-xs"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Vitals Bars */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                      {/* Health */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-gray-400">
                          <span className="flex items-center gap-1 text-red-400">
                            <Heart className="w-3 h-3" /> HP
                          </span>
                          <span>
                            {member.hp} / {member.maxHp}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-black/80 rounded-full overflow-hidden border border-red-900/30">
                          <div
                            className="h-full bg-gradient-to-r from-red-600 to-rose-500 transition-all duration-300"
                            style={{ width: `${hpPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Resource */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-gray-400">
                          <span className="flex items-center gap-1" style={{ color: member.resourceColor }}>
                            <Zap className="w-3 h-3" /> {member.resourceName.split(' ')[0]}
                          </span>
                          <span>
                            {member.resource} / {member.maxResource}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-black/80 rounded-full overflow-hidden border border-blue-900/30">
                          <div
                            className="h-full transition-all duration-300"
                            style={{
                              width: `${resPct}%`,
                              backgroundColor: member.resourceColor,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 2: Recruit Realm Adventurers (5 cols) */}
          <div className="lg:col-span-5 bg-black/60 rounded-xl border border-gray-800/90 p-4 flex flex-col space-y-3">
            <div className="text-[11px] font-serif font-bold text-[#b8860b] uppercase tracking-widest pb-1 border-b border-gray-800/80 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-[#b8860b]" /> Available Realm Champions
              </span>
              <span className="text-gray-500 font-mono text-[10px]">Nearby in Sanctum</span>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto">
              {recruitCandidates.length === 0 ? (
                <div className="text-center py-10 text-gray-500 font-sans text-xs">
                  All known realm adventurers are currently in your party or on active quests!
                </div>
              ) : (
                recruitCandidates.map((player) => {
                  const classDef = MMORPG_CLASSES[player.classId] || MMORPG_CLASSES['knight'];

                  return (
                    <div
                      key={player.id}
                      className="p-3 rounded-xl bg-black/50 border border-gray-800/80 hover:border-gray-700 flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-lg border"
                          style={{
                            backgroundColor: `${classDef.color}20`,
                            borderColor: classDef.color,
                          }}
                        >
                          {classDef.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-serif font-bold text-white">{player.name}</span>
                            <span className="text-[10px] font-mono text-gray-400 font-bold">
                              Lv.{player.level}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5 mt-0.5">
                            <span style={{ color: classDef.color }}>{player.className}</span>
                            <span>•</span>
                            <span className="text-gray-500">{player.guildTag}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onInvitePlayer(player)}
                        disabled={isFull}
                        className={`px-3 py-1.5 rounded-lg font-serif font-bold text-xs uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                          isFull
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-[#b8860b] to-[#8a6508] hover:from-[#d4af37] hover:to-[#b8860b] text-black shadow-[0_0_10px_rgba(184,134,11,0.2)]'
                        }`}
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Invite
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
