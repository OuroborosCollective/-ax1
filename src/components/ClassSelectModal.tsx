import React, { useState } from 'react';
import {
  X,
  Shield,
  Sparkles,
  Check,
  Sword,
  Axe,
  Crosshair,
  Flame,
  Zap,
  Hammer,
  Pickaxe,
  Sprout,
  Compass,
  Fish,
  Layers,
  Award,
  ChevronRight,
  TrendingUp,
  RotateCcw,
} from 'lucide-react';
import {
  CharacterClassId,
  ClassSkill,
  PlayerStats,
  ProfessionId,
  ProfessionSkill,
  WeaponMastery,
  WeaponType,
} from '../types';
import { MMORPG_CLASSES, DEFAULT_WEAPON_MASTERIES } from '../data/mmorpgData';
import { DEFAULT_PROFESSION_SKILLS } from '../data/professionsData';
import {
  getSkillMilestoneStats,
  getCraftingDuplicateChance,
  getGatheringYieldMultiplier,
  getCombatMasteryMultiplier,
  getArmorEfficiencyMultiplier,
} from '../data/classlessProgression';

interface ClassSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentClassId: CharacterClassId;
  onSelectClass: (classId: CharacterClassId) => void;
  stats?: PlayerStats;
  professions?: Record<ProfessionId, ProfessionSkill>;
  onEquipSkill?: (slotIndex: number, skill: ClassSkill) => void;
  onUnlockMilestoneSkill?: (weaponType: WeaponType, skillId: string) => void;
}

type TabCategory = 'weapons' | 'armor' | 'gathering' | 'crafting' | 'classes';

interface WeaponInfoDef {
  type: WeaponType;
  name: string;
  germanName: string;
  icon: string;
  desc: string;
  learningByDoing: string;
}

const WEAPON_REGISTRY: WeaponInfoDef[] = [
  {
    type: 'blade',
    name: 'Blade & Sword',
    germanName: 'Schwert- & Klingenkunst',
    icon: '⚔️',
    desc: 'Geschmeidige Klingenführung, schnelle Hiebe und präzise Paraden.',
    learningByDoing: 'Steigt durch jeden Hieb mit Einhandschwertern und Klingen.',
  },
  {
    type: 'greatsword',
    name: 'Greatsword',
    germanName: 'Zweihänder & Großschwert',
    icon: '🗡️',
    desc: 'Wuchtige Zweihänder-Schwünge mit hoher Cleave-Reichweite und Niederschlag.',
    learningByDoing: 'Wer mit einem Zweihänder kämpft, steigert kontinuierlich diese Meisterschaft.',
  },
  {
    type: 'daggers',
    name: 'Dual Daggers',
    germanName: 'Dolche & Schattenklingen',
    icon: '🗡️',
    desc: 'Tödlich schnelle Stiche, Giftmischung und kritische Hinterhalte.',
    learningByDoing: 'Steigt durch schnelle Nahkampf-Angriffe und kritische Treffer.',
  },
  {
    type: 'warhammer',
    name: 'Warhammer',
    germanName: 'Kriegshammer & Streitkolben',
    icon: '🔨',
    desc: 'Zerschmettert feindliche Rüstungen mit massiver Erschütterungswucht.',
    learningByDoing: 'Steigt durch schwere Erschütterungsschläge gegen gepanzerte Ziele.',
  },
  {
    type: 'bow',
    name: 'Bow & Crossbow',
    germanName: 'Bogen & Armbrust',
    icon: '🏹',
    desc: 'Präziser Fernkampf, Sperrfeuer und durchschlagende Pfeile.',
    learningByDoing: 'Steigt durch jeden Treffer aus der Ferne mit Bogen oder Armbrust.',
  },
  {
    type: 'heavy_tech',
    name: 'Tech-Rifle & Cannon',
    germanName: 'Tech-Gewehr & Schwere Maschinerie',
    icon: '⚙️',
    desc: 'Aether-angetriebene Schusswaffen, Gatling-Burst und Geschütztürme.',
    learningByDoing: 'Steigt durch Salven mit Aether-Gewehren und Tech-Apparaten.',
  },
  {
    type: 'staff',
    name: 'Aether Staff',
    germanName: 'Aether-Stab & Fokus',
    icon: '🪄',
    desc: 'Kanalisierung uralter Aetherströme, arkane Geschosse und Nova-Explosionen.',
    learningByDoing: 'Steigt durch Wirken von Zaubersprüchen und Stabsangriffen.',
  },
  {
    type: 'arcane',
    name: 'Aurion-Aether-Attunement',
    germanName: 'Aurion-Aether-Attunement (Magie)',
    icon: '✨',
    desc: 'Reine magische Resonanz aller arkanen Leylinien von Aurion.',
    learningByDoing: 'Wer magische Projektile wirkt, steigert die Aurion-Aether-Attunement.',
  },
  {
    type: 'battleaxe',
    name: 'Battleaxe',
    germanName: 'Streitaxt & Spalter',
    icon: '🪓',
    desc: 'Unaufhaltsame Wirbelangriffe und Blutungswunden.',
    learningByDoing: 'Steigt durch Treffer mit Streitäxten und Spaltern.',
  },
  {
    type: 'scythe',
    name: 'Death Scythe',
    germanName: 'Sense & Schnitter',
    icon: '🌾',
    desc: 'Großflächige Seelenernte und Dunkelheits-Schadenswellen.',
    learningByDoing: 'Steigt durch Seelenhiebe und weite Schwünge mit Sensen.',
  },
  {
    type: 'spear',
    name: 'Polearm & Spear',
    germanName: 'Speer & Stangenwaffen',
    icon: '🔱',
    desc: 'Hohe Distanzkontrolle, Stoßserien und rüstungsbrechende Stiche.',
    learningByDoing: 'Steigt durch präzise Speerstöße auf mittlere Distanz.',
  },
  {
    type: 'knuckles',
    name: 'Brawler Knuckles',
    germanName: 'Faustkampf & Knöcheleisen',
    icon: '🥊',
    desc: 'Rasante Schlagkombinationen, Uppercuts und Ki-Entladungen.',
    learningByDoing: 'Steigt durch Faustkampf und direkte Nahkampfschläge.',
  },
];

interface ArmorInfoDef {
  slot: string;
  name: string;
  germanName: string;
  icon: string;
  desc: string;
}

const ARMOR_REGISTRY: ArmorInfoDef[] = [
  {
    slot: 'chest',
    name: 'Heavy Plate Armor',
    germanName: 'Plattenharnisch & Schwere Rüstung',
    icon: '🛡️',
    desc: 'Maximale physische Schadensabsorption und Standfestigkeit im Gefecht.',
  },
  {
    slot: 'leather',
    name: 'Medium Leather Armor',
    germanName: 'Lederrüstung & Brigantine',
    icon: '🥋',
    desc: 'Ausgewogene Balance aus Schutz, Beweglichkeit und Ausdauerregeneration.',
  },
  {
    slot: 'cloth',
    name: 'Aether Cloth Robes',
    germanName: 'Stoffroben & Aether-Gewebe',
    icon: '👘',
    desc: 'Geringer physischer Schutz, jedoch maximale Manaregeneration und Zauberkraft.',
  },
  {
    slot: 'shield',
    name: 'Shields & Aegis',
    germanName: 'Schilde & Bollwerke',
    icon: '🛡️',
    desc: 'Aktives Abblocken massiver Treffer und Schutz vor Projektilen.',
  },
];

export const ClassSelectModal: React.FC<ClassSelectModalProps> = ({
  isOpen,
  onClose,
  currentClassId,
  onSelectClass,
  stats,
  professions = DEFAULT_PROFESSION_SKILLS,
  onEquipSkill,
  onUnlockMilestoneSkill,
}) => {
  const [activeTab, setActiveTab] = useState<TabCategory>('weapons');
  const [selectedWeaponType, setSelectedWeaponType] = useState<WeaponType>('blade');
  const [selectedArmorSlot, setSelectedArmorSlot] = useState<string>('chest');
  const [selectedGatherId, setSelectedGatherId] = useState<string>('woodcutter');
  const [selectedCraftId, setSelectedCraftId] = useState<string>('blacksmith');
  const [selectedClassId, setSelectedClassId] = useState<CharacterClassId>(currentClassId);
  const [equipNotice, setEquipNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const weaponMasteries = stats?.weaponMasteries || DEFAULT_WEAPON_MASTERIES;
  const currentWeaponDef = WEAPON_REGISTRY.find((w) => w.type === selectedWeaponType) || WEAPON_REGISTRY[0];
  const currentWeaponMastery = weaponMasteries[selectedWeaponType] || {
    type: selectedWeaponType,
    name: currentWeaponDef.name,
    level: 1,
    xp: 0,
    maxXp: 100,
    icon: currentWeaponDef.icon,
    skills: [],
    milestoneSkills: [],
  };

  const currentWeaponMilestone = getSkillMilestoneStats(currentWeaponMastery.level);
  const currentWeaponCombatMult = getCombatMasteryMultiplier(currentWeaponMastery.level);

  // Equipped skills in hotbar
  const equippedSkills = stats?.equippedSkills || MMORPG_CLASSES[currentClassId].skills;

  const handleAssignSkill = (slotIndex: number, skill: ClassSkill) => {
    if (onEquipSkill) {
      onEquipSkill(slotIndex, skill);
      setEquipNotice(`✓ "${skill.name}" in Hotbar-Slot [${slotIndex + 1}] ausgerüstet!`);
      setTimeout(() => setEquipNotice(null), 3000);
    }
  };

  return (
    <div
      id="class-modal-overlay"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4"
    >
      <div
        id="class-dialog"
        className="w-full max-w-5xl bg-[#0d131f] border border-[#b8860b]/50 rounded-2xl p-4 sm:p-6 text-gray-200 shadow-[0_0_50px_rgba(0,240,255,0.15)] flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3 sm:pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/80 border-2 border-[#00f0ff] flex items-center justify-center text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.3)]">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-serif font-bold text-white tracking-wide">
                  AURION MEISTERSCHAFTS-SANCTUM
                </h3>
                <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-[#00f0ff]/50 text-[#00f0ff] text-[10px] font-mono uppercase font-bold tracking-wider">
                  KLASSENLOSES SYSTEM
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-400 font-sans">
                RuneScape-inspiriertes Learning-by-Doing: Steigere jede Waffe, Magieschule, Rüstung & Handwerk durch Nutzung.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-black/50 border border-gray-800 hover:border-[#b8860b] text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Milestone Law Banner */}
        <div className="my-2.5 p-2.5 rounded-xl bg-gradient-to-r from-cyan-950/70 via-black/80 to-amber-950/60 border border-[#00f0ff]/40 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-[#00f0ff] font-semibold">
            <TrendingUp className="w-4 h-4 text-[#00f0ff] shrink-0" />
            <span>
              ⚡ <strong className="text-white">10-Stufen-Gesetz:</strong> Alle 10 Level verbessert sich der Output / Impact um{' '}
              <span className="text-[#00f0ff] font-mono font-bold">+10% (+0.1)</span> & Handwerks-Doppelchance um{' '}
              <span className="text-amber-400 font-mono font-bold">+10% (+0.1)</span>!
            </span>
          </div>
          <span className="text-[11px] text-gray-400 font-mono bg-black/60 px-2 py-0.5 rounded border border-gray-800">
            Freie Hybridisierung: Platten-Heiler, Dolch-Magier oder Bogen-Ingenieur
          </span>
        </div>

        {/* Top Category Tabs */}
        <div className="flex items-center gap-1.5 border-b border-gray-800/80 pb-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('weapons')}
            className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'weapons'
                ? 'bg-gradient-to-r from-[#00f0ff]/20 to-transparent border border-[#00f0ff] text-white shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                : 'bg-black/40 border border-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sword className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span>Waffen & Magie (Combat)</span>
          </button>

          <button
            onClick={() => setActiveTab('armor')}
            className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'armor'
                ? 'bg-gradient-to-r from-purple-500/20 to-transparent border border-purple-400 text-white shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                : 'bg-black/40 border border-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>Rüstungs-Schulen</span>
          </button>

          <button
            onClick={() => setActiveTab('gathering')}
            className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'gathering'
                ? 'bg-gradient-to-r from-emerald-500/20 to-transparent border border-emerald-400 text-white shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'bg-black/40 border border-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sprout className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sammeln & Farming</span>
          </button>

          <button
            onClick={() => setActiveTab('crafting')}
            className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'crafting'
                ? 'bg-gradient-to-r from-amber-500/20 to-transparent border border-amber-400 text-white shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'bg-black/40 border border-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <Hammer className="w-3.5 h-3.5 text-amber-400" />
            <span>Handwerks-Disziplinen</span>
          </button>

          <button
            onClick={() => setActiveTab('classes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'classes'
                ? 'bg-gradient-to-r from-[#b8860b]/30 to-transparent border border-[#b8860b] text-white shadow-[0_0_12px_rgba(184,134,11,0.2)]'
                : 'bg-black/40 border border-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#b8860b]" />
            <span>Basis-Archetypen</span>
          </button>
        </div>

        {equipNotice && (
          <div className="mt-2 p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs font-mono text-center animate-in fade-in">
            {equipNotice}
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 py-3 min-h-0 overflow-y-auto">
          {/* TAB 1: WEAPONS & MAGIC */}
          {activeTab === 'weapons' && (
            <>
              {/* Left Column: Weapon Mastery List (5 cols) */}
              <div className="md:col-span-5 space-y-1.5 overflow-y-auto pr-1">
                {WEAPON_REGISTRY.map((wep) => {
                  const m = weaponMasteries[wep.type] || { level: 1, currentXp: 0, maxXp: 100 };
                  const isSelected = wep.type === selectedWeaponType;
                  const milestone = getSkillMilestoneStats(m.level);

                  return (
                    <button
                      key={wep.type}
                      onClick={() => setSelectedWeaponType(wep.type)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-black/90 border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                          : 'bg-black/40 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-black/80 border border-gray-700 flex items-center justify-center text-xl shrink-0">
                          {wep.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="font-serif font-bold text-xs text-white truncate">{wep.germanName}</div>
                          <div className="text-[10px] text-gray-400 truncate">{wep.name}</div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-[10px] text-gray-400 font-mono">Stufe</span>
                          <span className="font-mono font-bold text-cyan-300 text-sm">{m.level}</span>
                        </div>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/60 border border-[#00f0ff]/30 text-[#00f0ff]">
                          {milestone.percentString} Impact
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Selected Mastery Details & Skill Deck (7 cols) */}
              <div className="md:col-span-7 bg-black/60 rounded-xl border border-gray-800 p-4 flex flex-col justify-between overflow-y-auto space-y-4">
                <div className="space-y-3">
                  {/* Title & Level Header */}
                  <div className="flex items-start justify-between border-b border-gray-800 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-cyan-950/40 border-2 border-[#00f0ff] flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(0,240,255,0.3)]">
                        {currentWeaponDef.icon}
                      </div>
                      <div>
                        <h4 className="text-base font-serif font-bold text-white flex items-center gap-2">
                          {currentWeaponDef.germanName}
                        </h4>
                        <span className="text-xs text-[#00f0ff] font-mono">{currentWeaponDef.name}</span>
                      </div>
                    </div>

                    <div className="text-right bg-cyan-950/30 p-2 rounded-xl border border-[#00f0ff]/30">
                      <span className="text-[10px] font-mono uppercase text-gray-400 block">Meisterschaftsstufe</span>
                      <span className="text-xl font-mono font-bold text-[#00f0ff]">
                        Lv. {currentWeaponMastery.level} <span className="text-xs text-gray-400">/ 100</span>
                      </span>
                    </div>
                  </div>

                  {/* XP Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono text-gray-300">
                      <span>Fortschritt zu Stufe {Math.min(100, currentWeaponMastery.level + 1)}</span>
                      <span>
                        {currentWeaponMastery.xp} / {currentWeaponMastery.maxXp} XP
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-black/80 overflow-hidden border border-gray-800">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-[#00f0ff] transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.floor((currentWeaponMastery.xp / Math.max(1, currentWeaponMastery.maxXp)) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* 10-Level Milestone Impact Box */}
                  <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-950/40 to-black/80 border border-[#00f0ff]/40 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-serif font-bold text-white flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-[#00f0ff]" />
                        Aktiver Meisterschafts-Impact:
                      </span>
                      <span className="font-mono font-bold text-[#00f0ff] text-sm">
                        {currentWeaponMilestone.percentString} Schadens- & Wucht-Multiplikator (+{(currentWeaponMilestone.bonusRate).toFixed(1)})
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-300 font-sans">
                      {currentWeaponDef.learningByDoing}
                    </p>
                    <div className="text-[10px] font-mono text-gray-400 pt-1 flex items-center justify-between border-t border-cyan-900/40">
                      <span>Nächster 10er-Meilenstein: Stufe {currentWeaponMilestone.nextMilestone}</span>
                      <span>Noch {currentWeaponMilestone.levelsToNext} Level</span>
                    </div>
                  </div>

                  {/* Associated Skills & Hotbar Assign */}
                  <div className="space-y-2 pt-2 border-t border-gray-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-serif font-bold text-white uppercase tracking-wider">
                        Fertigkeiten dieser Meisterschaft (In Hotbar 1–5 ausrüsten)
                      </span>
                      <span className="text-[10px] text-[#00f0ff] font-mono">Klassenlos frei wählbar</span>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {/* Combine standard weapon skills & milestone skills */}
                      {[
                        ...(currentWeaponMastery.skills || []),
                        ...(currentWeaponMastery.milestoneSkills || []),
                        // Fallback generic skills if none defined
                        ...(currentWeaponMastery.skills?.length === 0 && currentWeaponMastery.milestoneSkills?.length === 0
                          ? [
                              {
                                id: `${selectedWeaponType}_strike`,
                                name: `${currentWeaponDef.germanName} Primärschlag`,
                                description: `Führt einen kraftvollen Hieb aus (+${currentWeaponMilestone.percentString} Impact).`,
                                icon: currentWeaponDef.icon,
                                cooldown: 1.5,
                                resourceCost: 15,
                                resourceType: 'stamina',
                                type: 'melee' as const,
                                damage: 120,
                                currentCooldown: 0,
                                color: '#00f0ff',
                              },
                            ]
                          : []),
                      ].map((skill, index) => {
                        const isUnlocked =
                          !skill.requiredMasteryLevel || currentWeaponMastery.level >= skill.requiredMasteryLevel;

                        return (
                          <div
                            key={skill.id || index}
                            className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isUnlocked
                                ? 'bg-black/70 border-gray-800'
                                : 'bg-black/30 border-gray-900 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-black/80 border border-gray-700 flex items-center justify-center text-lg shrink-0">
                                {skill.icon || currentWeaponDef.icon}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-serif font-bold text-xs text-white">{skill.name}</span>
                                  {!isUnlocked && (
                                    <span className="px-1.5 py-0.2 rounded bg-red-950/80 border border-red-800/60 text-red-300 text-[9px] font-mono">
                                      Freischaltung ab Lv. {skill.requiredMasteryLevel}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-400 font-sans line-clamp-1">{skill.description}</p>
                                <span className="text-[9px] font-mono text-cyan-400">
                                  Basis-Schaden: {Math.round(skill.damage * currentWeaponCombatMult.damageMultiplier)} (inkl. Meisterschaft)
                                </span>
                              </div>
                            </div>

                            {/* Hotbar Slot Assign Buttons 1-5 */}
                            {isUnlocked ? (
                              <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                                <span className="text-[9px] text-gray-400 font-mono mr-1">Rüste in:</span>
                                {[0, 1, 2, 3, 4].map((slotIdx) => (
                                  <button
                                    key={slotIdx}
                                    onClick={() => handleAssignSkill(slotIdx, skill)}
                                    className="px-2 py-1 rounded bg-black/80 border border-gray-700 hover:border-[#00f0ff] hover:text-[#00f0ff] text-[10px] font-mono font-bold transition-all cursor-pointer"
                                    title={`In Hotbar-Slot [${slotIdx + 1}] ausrüsten`}
                                  >
                                    [{slotIdx + 1}]
                                  </button>
                                ))}
                              </div>
                            ) : (
                              onUnlockMilestoneSkill &&
                              currentWeaponMastery.level >= (skill.requiredMasteryLevel || 0) && (
                                <button
                                  onClick={() => onUnlockMilestoneSkill(selectedWeaponType, skill.id)}
                                  className="px-3 py-1 rounded bg-cyan-950 border border-[#00f0ff] text-[#00f0ff] text-[10px] font-mono font-bold hover:bg-cyan-900 transition-all cursor-pointer"
                                >
                                  Freischalten
                                </button>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Hotbar Current Summary */}
                <div className="pt-3 border-t border-gray-800">
                  <span className="text-[10px] font-mono uppercase text-gray-400 block mb-1">
                    Aktuelle Hotbar-Belegung (Tasten [1] bis [5]):
                  </span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[0, 1, 2, 3, 4].map((idx) => {
                      const sk = equippedSkills[idx];
                      return (
                        <div
                          key={idx}
                          className="p-1.5 rounded-lg bg-black/80 border border-gray-800 text-center flex flex-col items-center"
                        >
                          <span className="text-[9px] font-mono text-[#00f0ff] font-bold">[{idx + 1}]</span>
                          <span className="text-sm my-0.5">{sk?.icon || '—'}</span>
                          <span className="text-[9px] font-sans text-gray-300 truncate w-full">
                            {sk?.name?.split(' ')[0] || 'Leer'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: ARMOR SCHOOLS */}
          {activeTab === 'armor' && (
            <>
              {/* Left Column: Armor Categories */}
              <div className="md:col-span-5 space-y-2">
                {ARMOR_REGISTRY.map((arm) => {
                  const isSelected = arm.slot === selectedArmorSlot;
                  const armorStats = stats?.armorMasteries?.[arm.slot as any] || { level: 1, currentXp: 0, maxXp: 100 };
                  const milestone = getSkillMilestoneStats(armorStats.level);

                  return (
                    <button
                      key={arm.slot}
                      onClick={() => setSelectedArmorSlot(arm.slot)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-black/90 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                          : 'bg-black/40 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-black/80 border border-gray-700 flex items-center justify-center text-xl shrink-0">
                          {arm.icon}
                        </div>
                        <div>
                          <div className="font-serif font-bold text-xs text-white">{arm.germanName}</div>
                          <div className="text-[10px] text-gray-400">{arm.name}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-purple-300">Stufe {armorStats.level}</div>
                        <span className="text-[9px] font-mono text-purple-400">{milestone.percentString} Absorpt.</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Armor Details */}
              <div className="md:col-span-7 bg-black/60 rounded-xl border border-gray-800 p-4 space-y-4">
                {(() => {
                  const selArm = ARMOR_REGISTRY.find((a) => a.slot === selectedArmorSlot) || ARMOR_REGISTRY[0];
                  const armorStats = stats?.armorMasteries?.[selArm.slot as any] || {
                    level: 1,
                    currentXp: 0,
                    maxXp: 100,
                  };
                  const milestone = getSkillMilestoneStats(armorStats.level);
                  const eff = getArmorEfficiencyMultiplier(armorStats.level);

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-purple-950/40 border-2 border-purple-400 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                            {selArm.icon}
                          </div>
                          <div>
                            <h4 className="text-base font-serif font-bold text-white">{selArm.germanName}</h4>
                            <span className="text-xs text-purple-300 font-mono">{selArm.name}</span>
                          </div>
                        </div>

                        <div className="text-right bg-purple-950/30 p-2 rounded-xl border border-purple-400/30">
                          <span className="text-[10px] font-mono text-gray-400 block">Rüstungs-Stufe</span>
                          <span className="text-xl font-mono font-bold text-purple-300">Lv. {armorStats.level}</span>
                        </div>
                      </div>

                      <p className="text-xs text-gray-300 font-sans leading-relaxed">{selArm.desc}</p>

                      {/* 10-Level Milestone Absorption Box */}
                      <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/40 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-serif font-bold text-white flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                            Rüstungs-Effizienz (10-Stufen-Gesetz):
                          </span>
                          <span className="font-mono font-bold text-purple-300 text-sm">
                            +{eff.bonusPercent}% Schadensabsorption (+{(milestone.bonusRate).toFixed(1)})
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 font-sans">
                          Wird automatisch durch Schläge und erlittene Treffer beim Tragen gesteigert (Learning-by-Doing).
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-black/80 border border-gray-800 text-xs space-y-2">
                        <span className="font-serif font-bold text-white block">Hybridisierung ohne Malus:</span>
                        <p className="text-gray-300 text-[11px] leading-relaxed">
                          In Aurion gibt es keine Rüstungsklassen-Sperren. Du kannst eine schwere Plattenrüstung tragen
                          und gleichzeitig arkane Geschosse zaubern, oder in Seidenroben mit einem Kriegshammer kämpfen.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {/* TAB 3: GATHERING & FARMING */}
          {activeTab === 'gathering' && (
            <>
              {/* Left Column: Gathering List */}
              <div className="md:col-span-5 space-y-2">
                {[
                  { id: 'woodcutter', name: 'Holzfäller', icon: '🪓', desc: 'Fällen alter Bäume und Gewinnung von Hölzern.' },
                  { id: 'miner', name: 'Bergbau & Minenarbeit', icon: '⛏️', desc: 'Abbau von Erzen, Kristallen und Aetherit.' },
                  { id: 'farmer', name: 'Ackerbau & Farming', icon: '🌾', desc: 'Anbau, Pflege und Ernte von Feldfrüchten.' },
                  { id: 'herbalist', name: 'Kräuterkunde', icon: '🌿', desc: 'Sammeln von Heilkräutern und Magiepflanzen.' },
                  { id: 'fisherman', name: 'Fischen', icon: '🐟', desc: 'Angeln in Flüssen, Seen und heiligen Quellen.' },
                  { id: 'hunter', name: 'Jagd', icon: '🏹', desc: 'Spurenlesen und Erlegen von Wild und Aasfressern.' },
                ].map((g) => {
                  const prof = professions[g.id as ProfessionId] || { level: 1, xp: 0, maxXp: 100 };
                  const isSelected = g.id === selectedGatherId;
                  const yieldData = getGatheringYieldMultiplier(prof.level);

                  return (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGatherId(g.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-black/90 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                          : 'bg-black/40 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-black/80 border border-gray-700 flex items-center justify-center text-xl shrink-0">
                          {g.icon}
                        </div>
                        <div>
                          <div className="font-serif font-bold text-xs text-white">{g.name}</div>
                          <div className="text-[10px] text-gray-400">{g.desc}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-emerald-300">Stufe {prof.level}</div>
                        <span className="text-[9px] font-mono text-emerald-400">+{yieldData.extraPercent}% Ertrag</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Gathering Details */}
              <div className="md:col-span-7 bg-black/60 rounded-xl border border-gray-800 p-4 space-y-4">
                {(() => {
                  const prof = professions[selectedGatherId as ProfessionId] || {
                    level: 1,
                    xp: 0,
                    maxXp: 100,
                  };
                  const milestone = getSkillMilestoneStats(prof.level);
                  const yieldData = getGatheringYieldMultiplier(prof.level);

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                        <div>
                          <h4 className="text-base font-serif font-bold text-white">
                            {professions[selectedGatherId as ProfessionId]?.germanName || selectedGatherId}
                          </h4>
                          <span className="text-xs text-emerald-400 font-mono">Sammel- & Farming-Beruf</span>
                        </div>
                        <div className="text-right bg-emerald-950/30 p-2 rounded-xl border border-emerald-400/30">
                          <span className="text-[10px] font-mono text-gray-400 block">Berufsstufe</span>
                          <span className="text-xl font-mono font-bold text-emerald-300">Lv. {prof.level}</span>
                        </div>
                      </div>

                      {/* XP Progress */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-mono text-gray-300">
                          <span>Fortschritt</span>
                          <span>
                            {prof.xp} / {prof.maxXp} XP
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-black/80 overflow-hidden border border-gray-800">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                            style={{
                              width: `${Math.min(100, Math.floor((prof.xp / Math.max(1, prof.maxXp)) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* 10-Level Milestone Yield Box */}
                      <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-serif font-bold text-white flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                            Ressourcen-Ertrag (10-Stufen-Gesetz):
                          </span>
                          <span className="font-mono font-bold text-emerald-300 text-sm">
                            +{yieldData.extraPercent}% Ausbeute pro Sammelaktion (+{(milestone.bonusRate).toFixed(1)})
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-300 font-sans">
                          Steigt durch jede Ernte, jeden Holzschlag und jeden abgebauten Erzblock in der Spielwelt.
                        </p>
                        <div className="text-[10px] font-mono text-gray-400 pt-1 flex items-center justify-between border-t border-emerald-900/40">
                          <span>Nächste Ertragsstufe bei Level {milestone.nextMilestone}</span>
                          <span>Noch {milestone.levelsToNext} Level</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {/* TAB 4: CRAFTING DISCIPLINES */}
          {activeTab === 'crafting' && (
            <>
              {/* Left Column: Crafting List */}
              <div className="md:col-span-5 space-y-2">
                {[
                  { id: 'blacksmith', name: 'Schmiedekunst', icon: '⚒️', desc: 'Schmieden von Klingen, Platten und Hämmern.' },
                  { id: 'alchemist', name: 'Alchemie & Tränke', icon: '🧪', desc: 'Brauen mächtiger Elixiere und Öle.' },
                  { id: 'tailor', name: 'Schneiderei & Stoffe', icon: '🧵', desc: 'Weben von Seidenroben und Aether-Umhängen.' },
                  { id: 'leatherworker', name: 'Lederverarbeitung', icon: '🥋', desc: 'Gerben von Häuten und Spannen von Brigantinen.' },
                  { id: 'carpenter', name: 'Schreinerei & Bogenbau', icon: '🪵', desc: 'Schnitzen von Bögen, Stäben und Möbeln.' },
                  { id: 'enchanter', name: 'Verzauberung', icon: '✨', desc: 'Runeninschriften und magische Verstärkungen.' },
                ].map((c) => {
                  const prof = professions[c.id as ProfessionId] || { level: 1, xp: 0, maxXp: 100 };
                  const isSelected = c.id === selectedCraftId;
                  const dupData = getCraftingDuplicateChance(prof.level);

                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCraftId(c.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-black/90 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : 'bg-black/40 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-black/80 border border-gray-700 flex items-center justify-center text-xl shrink-0">
                          {c.icon}
                        </div>
                        <div>
                          <div className="font-serif font-bold text-xs text-white">{c.name}</div>
                          <div className="text-[10px] text-gray-400">{c.desc}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-amber-300">Stufe {prof.level}</div>
                        <span className="text-[9px] font-mono text-amber-400">{dupData.percentString} Doppel-Craft</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Crafting Details */}
              <div className="md:col-span-7 bg-black/60 rounded-xl border border-gray-800 p-4 space-y-4">
                {(() => {
                  const prof = professions[selectedCraftId as ProfessionId] || {
                    level: 1,
                    xp: 0,
                    maxXp: 100,
                  };
                  const dupData = getCraftingDuplicateChance(prof.level);
                  const milestone = getSkillMilestoneStats(prof.level);

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                        <div>
                          <h4 className="text-base font-serif font-bold text-white">
                            {professions[selectedCraftId as ProfessionId]?.germanName || selectedCraftId}
                          </h4>
                          <span className="text-xs text-amber-400 font-mono">Handwerks-Disziplin</span>
                        </div>
                        <div className="text-right bg-amber-950/30 p-2 rounded-xl border border-amber-400/30">
                          <span className="text-[10px] font-mono text-gray-400 block">Handwerksstufe</span>
                          <span className="text-xl font-mono font-bold text-amber-300">Lv. {prof.level}</span>
                        </div>
                      </div>

                      {/* XP Progress */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-mono text-gray-300">
                          <span>Fortschritt</span>
                          <span>
                            {prof.xp} / {prof.maxXp} XP
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-black/80 overflow-hidden border border-gray-800">
                          <div
                            className="h-full bg-gradient-to-r from-amber-600 to-amber-400"
                            style={{
                              width: `${Math.min(100, Math.floor((prof.xp / Math.max(1, prof.maxXp)) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* 10-Level Duplicate Crafting Box */}
                      <div className="p-3 rounded-xl bg-gradient-to-br from-amber-950/40 to-black/80 border border-amber-500/40 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-serif font-bold text-white flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            Doppelter Gegenstand (10-Stufen-Gesetz):
                          </span>
                          <span className="font-mono font-bold text-amber-300 text-sm">
                            {dupData.percentString} Chance auf 2. Item (+{(milestone.bonusRate).toFixed(1)})
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-300 font-sans">
                          Bei jedem Herstellungsvorgang besteht eine{' '}
                          <strong className="text-amber-300">{dupData.percentString}</strong> Chance, ein zweites Exemplar
                          des Items ohne zusätzlichen Materialverbrauch zu erhalten!
                        </p>
                        <div className="text-[10px] font-mono text-gray-400 pt-1 flex items-center justify-between border-t border-amber-900/40">
                          <span>Nächste Stufe bei Level {dupData.nextTierLevel} (+10% Chance)</span>
                          <span>Noch {dupData.nextTierLevel - prof.level} Level</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-black/80 border border-gray-800 text-xs space-y-1.5">
                        <span className="font-serif font-bold text-white block">Learning-by-Doing:</span>
                        <p className="text-gray-300 text-[11px] leading-relaxed">
                          Öffne das Handwerksmenü [Taste C] und stelle Waffen, Rüstungen oder Tränke her, um diese
                          Disziplin organisch auf Stufe 100 zu leveln.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {/* TAB 5: OPTIONAL BASE ARCHETYPES (CLASS FLAVORS) */}
          {activeTab === 'classes' && (
            <>
              {/* Archetypes List */}
              <div className="md:col-span-5 space-y-2">
                {Object.values(MMORPG_CLASSES).map((cls) => {
                  const isSelected = cls.id === selectedClassId;
                  const isCurrentActive = cls.id === currentClassId;

                  return (
                    <button
                      key={cls.id}
                      onClick={() => setSelectedClassId(cls.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-black/90 border-[#b8860b] shadow-[0_0_15px_rgba(184,134,11,0.2)]'
                          : 'bg-black/40 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl border shrink-0"
                        style={{
                          borderColor: `${cls.color}60`,
                          backgroundColor: `${cls.color}15`,
                          color: cls.color,
                        }}
                      >
                        {cls.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-serif font-bold text-xs text-white">{cls.name}</span>
                          {isCurrentActive && (
                            <span className="px-1.5 py-0.2 rounded bg-[#b8860b]/20 border border-[#b8860b]/40 text-[#fbbf24] text-[9px] font-mono uppercase font-bold">
                              Aktiv
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-sans text-gray-400 truncate">{cls.primaryRole}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Archetype Details */}
              <div className="md:col-span-7 bg-black/60 rounded-xl border border-gray-800 p-4 space-y-3">
                {(() => {
                  const cls = MMORPG_CLASSES[selectedClassId];
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                        <div>
                          <h4 className="text-base font-serif font-bold text-white flex items-center gap-2">
                            <span style={{ color: cls.color }}>{cls.icon}</span>
                            <span>{cls.name}</span>
                          </h4>
                          <span className="text-xs text-[#b8860b] font-mono">{cls.title}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-mono uppercase text-gray-400 block">Basis-Ressource</span>
                          <span className="text-xs font-mono font-bold" style={{ color: cls.resourceColor }}>
                            {cls.resourceName}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-gray-300 font-sans leading-relaxed">{cls.description}</p>

                      <div className="p-3 rounded-xl bg-black/80 border border-gray-800 text-xs">
                        <span className="font-serif font-bold text-[#b8860b] block mb-1">
                          Klassenlose Ausrichtungs-Aura:
                        </span>
                        <p className="text-gray-400 text-[11px]">
                          Das Umschalten des Basis-Archetyps ändert lediglich deine visuelle Identität und Standard-Ressourcenregeneration.
                          Alle Fertigkeiten, Waffen und Rüstungen bleiben vollkommen frei zugänglich!
                        </p>
                      </div>

                      <div className="pt-2 flex justify-end">
                        {currentClassId === selectedClassId ? (
                          <div className="px-4 py-2 rounded-lg bg-black/80 border border-gray-700 text-gray-400 font-serif font-bold text-xs flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>Aktive Basis-Aura</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              onSelectClass(selectedClassId);
                              onClose();
                            }}
                            className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#b8860b] to-[#8a6508] hover:from-[#d4af37] text-black font-serif font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                          >
                            Als Basis-Aura wählen
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
