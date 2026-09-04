import React, { useState } from 'react';
import {
  X,
  User,
  Sword,
  Shield,
  Zap,
  Sparkles,
  Heart,
  Trophy,
  Skull,
  BookOpen,
  Plus,
  Lock,
  Unlock,
  Check,
  Flame,
  Crosshair,
  Compass,
  Coins,
  Activity,
  Wind,
} from 'lucide-react';
import {
  CharacterAttributes,
  CharacterClassId,
  ClassSkill,
  MilestoneWeaponSkill,
  PlayerStats,
  WeaponMastery,
  WeaponType,
} from '../types';
import { MMORPG_CLASSES } from '../data/mmorpgData';

interface CharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: PlayerStats;
  currentClassId: CharacterClassId;
  onAllocateStatPoint?: (attribute: keyof CharacterAttributes) => { success: boolean; message: string };
  onUnlockMilestoneSkill?: (skillId: string) => { success: boolean; message: string; skill?: MilestoneWeaponSkill };
  onEquipSkill?: (slotIndex: number, skill: ClassSkill) => void;
}

export const CharacterModal: React.FC<CharacterModalProps> = ({
  isOpen,
  onClose,
  stats,
  currentClassId,
  onAllocateStatPoint,
  onUnlockMilestoneSkill,
  onEquipSkill,
}) => {
  const [activeTab, setActiveTab] = useState<'attributes' | 'skillbook'>('attributes');
  const [selectedWeaponTab, setSelectedWeaponTab] = useState<WeaponType>('blade');
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  if (!isOpen) return null;

  const classDef = MMORPG_CLASSES[currentClassId];
  const xpPct = Math.min(100, Math.round((stats.xp / stats.maxXp) * 100));
  const availablePoints = stats.statPoints || 0;
  const attributes = stats.attributes || { strength: 10, agility: 10, intelligence: 10, defense: 10 };
  const unlockedSkills = stats.unlockedMilestoneSkills || [];

  const handleAllocate = (attr: keyof CharacterAttributes) => {
    if (!onAllocateStatPoint) return;
    const res = onAllocateStatPoint(attr);
    setFeedbackMessage({ text: res.message, isError: !res.success });
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const handleUnlockSkill = (skillId: string) => {
    if (!onUnlockMilestoneSkill) return;
    const res = onUnlockMilestoneSkill(skillId);
    setFeedbackMessage({ text: res.message, isError: !res.success });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleEquipToHotbar = (skill: MilestoneWeaponSkill) => {
    if (!onEquipSkill) return;
    // Map MilestoneWeaponSkill into ClassSkill
    const classSkill: ClassSkill = {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      icon: skill.icon,
      color: skill.color,
      resourceCost: skill.resourceCost,
      resourceType: 'mana',
      cooldown: skill.cooldown,
      currentCooldown: 0,
      damage: skill.damage,
      aoeRadius: skill.aoeRadius,
      range: skill.range,
      type: skill.type,
      keybind: '1',
    };
    onEquipSkill(0, classSkill); // Equip to primary slot 1
    setFeedbackMessage({ text: `Equipped "${skill.name}" to Hotbar Slot [1]!`, isError: false });
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const selectedMastery = stats.weaponMasteries?.[selectedWeaponTab] || stats.weaponMasteries?.blade;

  return (
    <div id="character-modal-overlay" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div
        id="character-dialog"
        className="w-full max-w-3xl bg-[#11141a] border border-[#b8860b]/40 rounded-2xl p-5 sm:p-6 text-gray-200 shadow-[0_0_40px_rgba(184,134,11,0.2)] flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl shadow-[0_0_12px_rgba(184,134,11,0.25)]"
              style={{ borderColor: classDef.color, backgroundColor: `${classDef.color}20` }}
            >
              {classDef.icon}
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                {classDef.name} — Hero of Aethelgard
              </h3>
              <p className="text-xs text-[#b8860b] font-mono italic">
                Level {stats.level} · {classDef.title} · 🪙 {stats.gold.toLocaleString()} Gold
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Unallocated Stat Points Notification Pill */}
            {availablePoints > 0 && (
              <div className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 font-mono text-xs font-bold animate-pulse flex items-center gap-1.5 shadow-[0_0_12px_rgba(251,191,36,0.3)]">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{availablePoints} Stat Point{availablePoints > 1 ? 's' : ''}</span>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-black/50 border border-gray-800 hover:border-[#b8860b] text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 pt-3 pb-2 border-b border-gray-800/80">
          <button
            onClick={() => setActiveTab('attributes')}
            className={`px-4 py-2 rounded-xl font-serif text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'attributes'
                ? 'bg-gradient-to-r from-[#b8860b]/30 to-amber-950/40 border border-[#fbbf24] text-[#fbbf24] shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                : 'bg-black/50 border border-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" /> Attributes & Character Stats
          </button>

          <button
            onClick={() => setActiveTab('skillbook')}
            className={`px-4 py-2 rounded-xl font-serif text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'skillbook'
                ? 'bg-gradient-to-r from-cyan-950/50 to-blue-950/40 border border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                : 'bg-black/50 border border-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Weapon Skill Book (Grimoire)
          </button>
        </div>

        {/* Feedback Banner */}
        {feedbackMessage && (
          <div
            className={`mt-2 py-1.5 px-3 rounded-xl border text-xs font-mono flex items-center gap-2 animate-in fade-in duration-150 ${
              feedbackMessage.isError
                ? 'bg-red-950/60 border-red-500/60 text-red-200'
                : 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Content Tabs */}
        <div className="flex-1 py-3 space-y-4 overflow-y-auto min-h-0">
          {activeTab === 'attributes' ? (
            <>
              {/* Level & XP Progression */}
              <div className="bg-black/60 rounded-xl border border-gray-800 p-3.5 space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-gray-400">Experience Progression (Hero Level {stats.level})</span>
                  <span className="text-[#fbbf24] font-bold">
                    {stats.xp} / {stats.maxXp} EXP ({xpPct}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-black/80 rounded-full border border-gray-700/80 overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-300 transition-all duration-300"
                    style={{ width: `${xpPct}%` }}
                  />
                </div>
              </div>

              {/* RuneScape-Style Stat Point Allocation Section */}
              <div className="bg-black/70 rounded-xl border border-[#b8860b]/30 p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#fbbf24]" />
                    <h4 className="text-xs font-serif font-bold text-white uppercase tracking-widest">
                      Character Attribute Allocation (RuneScape Progression)
                    </h4>
                  </div>
                  <div className="text-xs font-mono">
                    <span className="text-gray-400">Available Points: </span>
                    <strong className="text-[#fbbf24] text-sm">{availablePoints}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Strength */}
                  <div className="p-3 rounded-xl bg-black/60 border border-gray-800/90 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-950/60 border border-amber-500/40 flex items-center justify-center text-amber-400">
                        <Sword className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                          <span>Strength</span>
                          <span className="text-amber-400 font-mono text-sm">[{attributes.strength}]</span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-sans">
                          +3.5 Atk Power & +0.5% Crit Chance per pt
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAllocate('strength')}
                      disabled={availablePoints <= 0}
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
                        availablePoints > 0
                          ? 'bg-amber-500 hover:bg-amber-400 text-black border-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.4)] cursor-pointer active:scale-95'
                          : 'bg-black/40 border-gray-800 text-gray-600 cursor-not-allowed'
                      }`}
                      title="Allocate +1 Strength"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Agility */}
                  <div className="p-3 rounded-xl bg-black/60 border border-gray-800/90 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <Wind className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                          <span>Agility</span>
                          <span className="text-emerald-400 font-mono text-sm">[{attributes.agility}]</span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-sans">
                          +0.75% Dodge & Faster Attack Speed
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAllocate('agility')}
                      disabled={availablePoints <= 0}
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
                        availablePoints > 0
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-black border-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.4)] cursor-pointer active:scale-95'
                          : 'bg-black/40 border-gray-800 text-gray-600 cursor-not-allowed'
                      }`}
                      title="Allocate +1 Agility"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Intelligence */}
                  <div className="p-3 rounded-xl bg-black/60 border border-gray-800/90 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-purple-400">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                          <span>Intelligence</span>
                          <span className="text-purple-400 font-mono text-sm">[{attributes.intelligence}]</span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-sans">
                          +12 Max Mana & +3.5 Spell Power & Regen
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAllocate('intelligence')}
                      disabled={availablePoints <= 0}
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
                        availablePoints > 0
                          ? 'bg-purple-500 hover:bg-purple-400 text-black border-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.4)] cursor-pointer active:scale-95'
                          : 'bg-black/40 border-gray-800 text-gray-600 cursor-not-allowed'
                      }`}
                      title="Allocate +1 Intelligence"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Defense */}
                  <div className="p-3 rounded-xl bg-black/60 border border-gray-800/90 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                          <span>Defense</span>
                          <span className="text-cyan-400 font-mono text-sm">[{attributes.defense}]</span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-sans">
                          +4.5 Armor Rating & +22 Max HP per pt
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAllocate('defense')}
                      disabled={availablePoints <= 0}
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
                        availablePoints > 0
                          ? 'bg-cyan-500 hover:bg-cyan-400 text-black border-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.4)] cursor-pointer active:scale-95'
                          : 'bg-black/40 border-gray-800 text-gray-600 cursor-not-allowed'
                      }`}
                      title="Allocate +1 Defense"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Combat Attributes & Ratings Grid */}
              <div className="space-y-2">
                <span className="text-[11px] font-serif font-bold text-[#b8860b] uppercase tracking-widest block">
                  Active Combat Ratings & Vitals
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl bg-black/60 border border-gray-800 flex items-center gap-3">
                    <Heart className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] uppercase font-mono text-gray-400">Health Points</div>
                      <div className="text-sm font-bold font-mono text-white">
                        {Math.round(stats.hp)} / {stats.maxHp}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-black/60 border border-gray-800 flex items-center gap-3">
                    <Zap className="w-5 h-5 flex-shrink-0" style={{ color: classDef.resourceColor }} />
                    <div>
                      <div className="text-[10px] uppercase font-mono text-gray-400">{stats.resourceName}</div>
                      <div className="text-sm font-bold font-mono text-white">
                        {Math.round(stats.resource)} / {stats.maxResource}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-black/60 border border-gray-800 flex items-center gap-3">
                    <Sword className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] uppercase font-mono text-gray-400">Attack Power</div>
                      <div className="text-sm font-bold font-mono text-white">{stats.attackPower}</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-black/60 border border-gray-800 flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] uppercase font-mono text-gray-400">Spell Power</div>
                      <div className="text-sm font-bold font-mono text-white">{stats.spellPower}</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-black/60 border border-gray-800 flex items-center gap-3">
                    <Shield className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] uppercase font-mono text-gray-400">Armor Rating</div>
                      <div className="text-sm font-bold font-mono text-white">{stats.armor}</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-black/60 border border-gray-800 flex items-center gap-3">
                    <Trophy className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] uppercase font-mono text-gray-400">Critical Strike</div>
                      <div className="text-sm font-bold font-mono text-white">{stats.critChance}%</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-black/60 border border-gray-800 flex items-center gap-3">
                    <Wind className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] uppercase font-mono text-gray-400">Dodge Chance</div>
                      <div className="text-sm font-bold font-mono text-white">{stats.dodgeChance || 6}%</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-black/60 border border-gray-800 flex items-center gap-3">
                    <Activity className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] uppercase font-mono text-gray-400">Move Speed</div>
                      <div className="text-sm font-bold font-mono text-white">
                        {Math.round(stats.moveSpeedMultiplier * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* ================= SKILL LEVEL BOOK (WEAPON MASTERY GRIMOIRE) ================= */
            <div className="space-y-4">
              {/* Weapon Types Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { type: 'blade', name: 'Blade Mastery', icon: '⚔️', color: '#f59e0b' },
                    { type: 'arcane', name: 'Arcane Sorcery', icon: '🔮', color: '#a855f7' },
                    { type: 'marksmanship', name: 'Marksmanship', icon: '🏹', color: '#10b981' },
                    { type: 'heavy_tech', name: 'Heavy Ordnance', icon: '⚙️', color: '#06b6d4' },
                  ] as { type: WeaponType; name: string; icon: string; color: string }[]
                ).map((wep) => {
                  const isSelected = selectedWeaponTab === wep.type;
                  const mastery = stats.weaponMasteries?.[wep.type];
                  const rank = mastery?.level || 1;

                  return (
                    <button
                      key={wep.type}
                      onClick={() => setSelectedWeaponTab(wep.type)}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-black/90 border-[#fbbf24] shadow-[0_0_15px_rgba(251,191,36,0.25)] ring-1 ring-[#fbbf24]'
                          : 'bg-black/50 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <span className="text-2xl mb-1">{wep.icon}</span>
                      <span className="text-xs font-serif font-bold text-white">{wep.name}</span>
                      <span className="text-[10px] font-mono font-bold mt-0.5" style={{ color: wep.color }}>
                        Rank {rank}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Selected Weapon Overview & Progress */}
              {selectedMastery && (
                <div className="bg-black/70 rounded-xl border border-gray-800 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{selectedMastery.icon}</span>
                      <div>
                        <h4 className="text-sm font-serif font-bold text-white">{selectedMastery.name}</h4>
                        <p className="text-[11px] text-gray-400">{selectedMastery.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-serif font-bold" style={{ color: selectedMastery.color }}>
                        Rank {selectedMastery.level}
                      </div>
                      <div className="text-[10px] font-mono text-gray-400">
                        {selectedMastery.xp} / {selectedMastery.maxXp} XP
                      </div>
                    </div>
                  </div>

                  {/* XP Bar */}
                  <div className="w-full h-2 bg-black/90 rounded-full overflow-hidden border border-gray-800">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.round((selectedMastery.xp / selectedMastery.maxXp) * 100))}%`,
                        backgroundColor: selectedMastery.color,
                      }}
                    />
                  </div>

                  <div className="text-[10px] text-gray-400 font-mono flex items-center justify-between pt-1">
                    <span>Active Passive Scaling: {selectedMastery.scalingAttr}</span>
                    <span className="text-amber-300">Level up weapon type in combat to gain stat points!</span>
                  </div>
                </div>
              )}

              {/* Milestone Attack Skills (Every 10 Levels: 10, 20, 30, 40) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-serif font-bold text-[#b8860b] uppercase tracking-widest block flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-[#fbbf24]" /> Special Weapon Attack Skills (Unlocked Every 10 Levels)
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">
                    Skill Unlock Fee: <strong className="text-[#fbbf24]">🪙 10 Gold</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {selectedMastery?.milestoneSkills?.map((skill) => {
                    const isLevelMet = (selectedMastery.level || 1) >= skill.requiredMasteryLevel;
                    const isUnlocked = unlockedSkills.includes(skill.id);
                    const canAfford = stats.gold >= skill.unlockCostGold;

                    return (
                      <div
                        key={skill.id}
                        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                          isUnlocked
                            ? 'bg-black/80 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                            : isLevelMet
                            ? 'bg-black/80 border-[#fbbf24]/50 shadow-[0_0_12px_rgba(251,191,36,0.15)]'
                            : 'bg-black/40 border-gray-800/80 opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-12 h-12 rounded-xl border flex items-center justify-center text-2xl flex-shrink-0 ${
                              isUnlocked
                                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                                : isLevelMet
                                ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                                : 'bg-black/60 border-gray-800 text-gray-600'
                            }`}
                          >
                            {skill.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-xs font-serif font-bold text-white">{skill.name}</h5>
                              <span
                                className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold border uppercase ${
                                  isUnlocked
                                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                                    : isLevelMet
                                    ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                                    : 'bg-black/60 border-gray-800 text-gray-500'
                                }`}
                              >
                                Req. Rank {skill.requiredMasteryLevel}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-300 font-sans mt-0.5">{skill.description}</p>
                            <div className="flex items-center gap-3 text-[10px] font-mono text-gray-400 mt-1">
                              <span>Damage: <strong className="text-white">{skill.damage}</strong></span>
                              <span>Cooldown: <strong className="text-white">{skill.cooldown}s</strong></span>
                              <span>Cost: <strong className="text-cyan-300">{skill.resourceCost} Mana</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons: Unlock for 10 Gold or Equip */}
                        <div className="flex items-center gap-2 sm:self-center flex-shrink-0">
                          {isUnlocked ? (
                            <button
                              onClick={() => handleEquipToHotbar(skill)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-serif font-bold text-xs flex items-center gap-1.5 transition-all shadow cursor-pointer active:scale-95"
                            >
                              <Check className="w-3.5 h-3.5" /> Equip to Slot 1
                            </button>
                          ) : isLevelMet ? (
                            <button
                              onClick={() => handleUnlockSkill(skill.id)}
                              className={`px-3.5 py-1.5 rounded-lg font-serif font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-lg ${
                                canAfford
                                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black shadow-amber-500/20'
                                  : 'bg-black/60 border border-amber-500/40 text-amber-300/60'
                              }`}
                            >
                              <Unlock className="w-3.5 h-3.5" /> Unlock (🪙 {skill.unlockCostGold} Gold)
                            </button>
                          ) : (
                            <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-gray-800 text-gray-500 text-xs font-mono flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5" /> Locked (Rank {skill.requiredMasteryLevel})
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
