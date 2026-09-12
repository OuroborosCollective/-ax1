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
  Award,
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
  Sprout,
  Hammer,
  TrendingUp,
  ChevronRight,
  Layers,
  Wand2,
  Cpu,
} from 'lucide-react';
import {
  CharacterAttributes,
  CharacterClassId,
  ClassSkill,
  MilestoneWeaponSkill,
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
import { LearningProgressionDisplay } from './LearningProgressionDisplay';
import { MasteryProgress } from './MasteryProgress';

export { MasteryProgress };

interface CharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: PlayerStats;
  currentClassId: CharacterClassId;
  professions?: Record<ProfessionId, ProfessionSkill>;
  onAllocateStatPoint?: (attribute: keyof CharacterAttributes) => { success: boolean; message: string };
  onUnlockMilestoneSkill?: (skillId: string) => { success: boolean; message: string; skill?: MilestoneWeaponSkill };
  onEquipSkill?: (slotIndex: number, skill: ClassSkill) => void;
}

type CharacterModalTab = 'mastery' | 'weapons' | 'spells' | 'armor' | 'professions' | 'overview';

interface WeaponMeta {
  type: WeaponType;
  name: string;
  germanName: string;
  icon: string;
  desc: string;
  learningDesc: string;
}

const ALL_WEAPONS: WeaponMeta[] = [
  {
    type: 'blade',
    name: 'Blade & Sword',
    germanName: 'Schwert- & Klingenkunst',
    icon: '⚔️',
    desc: 'Geschmeidige Klingenführung, präzise Hiebe und Konter.',
    learningDesc: 'Steigt durch Hiebe mit Einhandschwertern und Klingen.',
  },
  {
    type: 'greatsword',
    name: 'Greatsword',
    germanName: 'Zweihänder & Großschwert',
    icon: '🗡️',
    desc: 'Wuchtige Zweihänder-Schwünge mit hoher Cleave-Wucht und Niederschlag.',
    learningDesc: 'Steigt durch schwere Cleave-Hiebe mit Zweihändern.',
  },
  {
    type: 'daggers',
    name: 'Dual Daggers',
    germanName: 'Dolche & Schattenklingen',
    icon: '🗡️',
    desc: 'Blitzschnelle Stiche, Giftmischung und kritische Hinterhalte.',
    learningDesc: 'Steigt durch schnelle Nahkampf-Angriffe und kritische Treffer.',
  },
  {
    type: 'warhammer',
    name: 'Warhammer',
    germanName: 'Kriegshammer & Streitkolben',
    icon: '🔨',
    desc: 'Zerschmettert feindliche Panzerung mit massiver Erschütterungswucht.',
    learningDesc: 'Steigt durch schwere Erschütterungsschläge gegen Feinde.',
  },
  {
    type: 'bow',
    name: 'Bow & Crossbow',
    germanName: 'Bogen & Armbrust',
    icon: '🏹',
    desc: 'Präziser Fernkampf, Sperrfeuer und durchschlagende Pfeile.',
    learningDesc: 'Steigt durch jeden Fernkampftreffer mit Bogen oder Armbrust.',
  },
  {
    type: 'heavy_tech',
    name: 'Tech-Rifle & Cannon',
    germanName: 'Tech-Gewehr & Maschinerie',
    icon: '⚙️',
    desc: 'Aether-angetriebene Feuerstöße, Gatling-Burst und Geschütztürme.',
    learningDesc: 'Steigt durch Schusssalven mit Aether-Gewehren und Tech-Kanonen.',
  },
  {
    type: 'staff',
    name: 'Aether Staff',
    germanName: 'Aether-Stab & Fokus',
    icon: '🪄',
    desc: 'Kanalisierung uralter Aetherströme, arkane Projektile und Nova-Wellen.',
    learningDesc: 'Steigt durch Wirken von Zaubersprüchen und Stabsangriffen.',
  },
  {
    type: 'battleaxe',
    name: 'Battleaxe',
    germanName: 'Streitaxt & Spalter',
    icon: '🪓',
    desc: 'Unaufhaltsame Wirbelangriffe und tiefe Blutungswunden.',
    learningDesc: 'Steigt durch Treffer mit Streitäxten und Spaltern.',
  },
  {
    type: 'scythe',
    name: 'Death Scythe',
    germanName: 'Sense & Schnitter',
    icon: '🌾',
    desc: 'Großflächige Seelenernte und dunkle Schadenswellen.',
    learningDesc: 'Steigt durch Seelenhiebe und weite Schwünge mit Sensen.',
  },
  {
    type: 'spear',
    name: 'Polearm & Spear',
    germanName: 'Speer & Stangenwaffen',
    icon: '🔱',
    desc: 'Hohe Distanzkontrolle, Stoßserien und rüstungsbrechende Stiche.',
    learningDesc: 'Steigt durch Speerstöße auf mittlere Distanz.',
  },
  {
    type: 'knuckles',
    name: 'Brawler Knuckles',
    germanName: 'Faustkampf & Knöcheleisen',
    icon: '🥊',
    desc: 'Rasante Schlagkombinationen, Uppercuts und Ki-Entladungen.',
    learningDesc: 'Steigt durch Faustkampf und direkte Nahkampfschläge.',
  },
];

interface SpellSchoolMeta {
  id: string;
  name: string;
  germanName: string;
  icon: string;
  weaponRef: WeaponType;
  desc: string;
  learningDesc: string;
}

const SPELL_SCHOOLS: SpellSchoolMeta[] = [
  {
    id: 'aurion_aether',
    name: 'Aurion-Aether & Spacetime Chrono',
    germanName: 'Aurion-Aether-Attunement (Hauptmagie)',
    icon: '✨',
    weaponRef: 'arcane',
    desc: 'Reine magische Resonanz aller arkanen Leylinien Aurions, Chrono-Zeitschleifen und Raumverzerrung.',
    learningDesc: 'Steigt organisch durch jeden gewirkten Zauberspruch und jede arkane Leylinien-Kanalisierung.',
  },
  {
    id: 'elemental_staff',
    name: 'Elemental Evocation & Staff',
    germanName: 'Elementar-Evokation (Feuer, Eis, Blitz)',
    icon: '🔥',
    weaponRef: 'staff',
    desc: 'Fokussierte Elementargewalten durch Aether-Stäbe: Feuerstürme, Frostschock und Kettenblitze.',
    learningDesc: 'Steigt durch Auslösen von elementaren Zauberreaktionen und Stabs-Geschossen.',
  },
  {
    id: 'leyline_holy',
    name: 'Radiant Leylines & Restoration',
    germanName: 'Göttliche Leylinien & Heilung',
    icon: '🕊️',
    weaponRef: 'arcane',
    desc: 'Lichtwirbel, Auraschilde und heilige Regeneration zur Stärkung von Leben und Geist.',
    learningDesc: 'Steigt durch Heilzauber, Wundreinigung und unterstützende Schutzauren im Gefecht.',
  },
  {
    id: 'shadow_scythe',
    name: 'Shadow Reaping & Soul Magic',
    germanName: 'Schatten- & Seelenmagie',
    icon: '🌑',
    weaponRef: 'scythe',
    desc: 'Dunkle Aether-Entladungen, Lebensentzug und Flüche der Leere.',
    learningDesc: 'Steigt durch Seelenraub und dunkle Zauberimpulse gegen gefallene Seelen.',
  },
];

const ARMOR_SCHOOLS = [
  {
    slot: 'chest',
    name: 'Heavy Plate Armor',
    germanName: 'Plattenharnisch & Schwere Rüstung',
    icon: '🛡️',
    desc: 'Maximale Schadensabsorption und Standfestigkeit gegen schwere Hiebe.',
    learningDesc: 'Steigt durch Einstecken von physischen Treffern in schwerer Plattenrüstung.',
  },
  {
    slot: 'leather',
    name: 'Medium Leather Armor',
    germanName: 'Lederrüstung & Brigantine',
    icon: '🥋',
    desc: 'Ausgewogene Balance aus Schutz, Beweglichkeit und Ausdauerregeneration.',
    learningDesc: 'Steigt durch Trefferabsorption und geschicktes Ausweichen in Lederrüstung.',
  },
  {
    slot: 'cloth',
    name: 'Aether Cloth Robes',
    germanName: 'Stoffroben & Aether-Gewebe',
    icon: '👘',
    desc: 'Geringer physischer Schutz, jedoch maximale Manaregeneration und Zaubermacht.',
    learningDesc: 'Steigt durch magische Trefferabsorption beim Tragen von Seidenroben.',
  },
  {
    slot: 'shield',
    name: 'Shields & Aegis',
    germanName: 'Schilde & Bollwerke',
    icon: '🛡️',
    desc: 'Aktives Abblocken massiver Treffer und Schutz vor Geschossen.',
    learningDesc: 'Steigt durch aktives Blocken mit Schilden und Aegis-Abwehren.',
  },
];

const GATHERING_LIST = [
  { id: 'woodcutter', name: 'Holzfäller', icon: '🪓', desc: 'Fällen von Aether-Bäumen und Bauhölzern.' },
  { id: 'miner', name: 'Bergbau & Minenarbeit', icon: '⛏️', desc: 'Abbau von Erzen, Kristallen und Aetherit.' },
  { id: 'farmer', name: 'Ackerbau & Farming', icon: '🌾', desc: 'Anbau, Pflege und Ernte von Feldfrüchten.' },
  { id: 'herbalist', name: 'Kräuterkunde', icon: '🌿', desc: 'Sammeln von Heilkräutern und Magiepflanzen.' },
  { id: 'fisherman', name: 'Fischen', icon: '🐟', desc: 'Angeln in Flüssen, Seen und heiligen Quellen.' },
  { id: 'hunter', name: 'Jagd', icon: '🏹', desc: 'Spurenlesen und Erlegen von Wild und Aasfressern.' },
];

const CRAFTING_LIST = [
  { id: 'blacksmith', name: 'Schmiedekunst', icon: '⚒️', desc: 'Schmieden von Klingen, Platten und Hämmern.' },
  { id: 'alchemist', name: 'Alchemie & Tränke', icon: '🧪', desc: 'Brauen mächtiger Elixiere und Öle.' },
  { id: 'tailor', name: 'Schneiderei & Stoffe', icon: '🧵', desc: 'Weben von Seidenroben und Aether-Umhängen.' },
  { id: 'leatherworker', name: 'Lederverarbeitung', icon: '🥋', desc: 'Gerben von Häuten und Spannen von Brigantinen.' },
  { id: 'carpenter', name: 'Schreinerei & Bogenbau', icon: '🪵', desc: 'Schnitzen von Bögen, Stäben und Möbeln.' },
  { id: 'enchanter', name: 'Verzauberung', icon: '✨', desc: 'Runeninschriften und magische Verstärkungen.' },
];

export const CharacterModal: React.FC<CharacterModalProps> = ({
  isOpen,
  onClose,
  stats,
  currentClassId,
  professions = DEFAULT_PROFESSION_SKILLS,
  onAllocateStatPoint,
  onUnlockMilestoneSkill,
  onEquipSkill,
}) => {
  const [activeTab, setActiveTab] = useState<CharacterModalTab>('mastery');
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponType>(stats.activeWeaponType || 'blade');
  const [selectedSpellId, setSelectedSpellId] = useState<string>('aurion_aether');
  const [selectedArmorSlot, setSelectedArmorSlot] = useState<string>('chest');
  const [selectedProfCategory, setSelectedProfCategory] = useState<'gathering' | 'crafting'>('gathering');
  const [selectedProfId, setSelectedProfId] = useState<string>('woodcutter');
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; isError: boolean } | null>(null);

  if (!isOpen) return null;

  const weaponMasteries = stats.weaponMasteries || DEFAULT_WEAPON_MASTERIES;
  const unlockedSkills = stats.unlockedMilestoneSkills || [];
  const classDef = MMORPG_CLASSES[currentClassId] || Object.values(MMORPG_CLASSES)[0];
  const equippedSkills = stats.equippedSkills || classDef.skills;

  const handleAllocate = (attr: keyof CharacterAttributes) => {
    if (onAllocateStatPoint) {
      const res = onAllocateStatPoint(attr);
      setFeedbackMessage({ text: res.message, isError: !res.success });
      setTimeout(() => setFeedbackMessage(null), 3000);
    }
  };

  const handleUnlockSkill = (skillId: string) => {
    if (onUnlockMilestoneSkill) {
      const res = onUnlockMilestoneSkill(skillId);
      setFeedbackMessage({ text: res.message, isError: !res.success });
      setTimeout(() => setFeedbackMessage(null), 3000);
    }
  };

  const handleEquipToHotbar = (slotIndex: number, skill: ClassSkill) => {
    if (onEquipSkill) {
      onEquipSkill(slotIndex, skill);
      setFeedbackMessage({
        text: `✓ "${skill.name}" in Hotbar-Platz [${slotIndex + 1}] ausgerüstet!`,
        isError: false,
      });
      setTimeout(() => setFeedbackMessage(null), 3000);
    }
  };

  // Calculate overall learning progression stats
  const totalMasterySum =
    Object.values(weaponMasteries).reduce((acc, m) => acc + (m.level || 1), 0) +
    Object.values(professions).reduce((acc, p) => acc + (p.level || 1), 0);

  return (
    <div
      id="character-modal-overlay"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4"
    >
      <div
        id="character-dialog"
        className="w-full max-w-5xl bg-[#0d131f] border border-[#b8860b]/50 rounded-2xl p-4 sm:p-6 text-gray-200 shadow-[0_0_50px_rgba(0,240,255,0.15)] flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3 sm:pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-black/80 border-2 border-[#b8860b] flex items-center justify-center text-[#fbbf24] shadow-[0_0_15px_rgba(184,134,11,0.3)] shrink-0">
              <User className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-xl font-serif font-bold text-white uppercase tracking-wider truncate">
                  {stats.prestigeTitle || 'Aspirant von Aurion'}
                </h2>
                <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-[#00f0ff]/50 text-[#00f0ff] text-[10px] font-mono uppercase font-bold tracking-wider shrink-0">
                  KLASSENLOSES LEARNING-BY-DOING
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-400 font-mono truncate">
                Charakterstufe {stats.level} • Gesamt-Meisterschaft: {totalMasterySum} Ränge •{' '}
                <span className="text-[#00f0ff]">+0.1 (+10%) Bonus pro 10 Level</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-black/50 border border-gray-800 hover:border-[#b8860b] text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global 10-Level Milestone Rule Banner */}
        <div className="my-2.5 p-2 sm:p-2.5 rounded-xl bg-gradient-to-r from-cyan-950/70 via-black/80 to-amber-950/60 border border-[#00f0ff]/40 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-[#00f0ff] font-semibold">
            <TrendingUp className="w-4 h-4 text-[#00f0ff] shrink-0" />
            <span>
              ⚡ <strong className="text-white">Meilenstein-Regel:</strong> Jede Waffe, Zauberschule & Profession skaliert
              von <span className="text-white font-mono">0 bis 100</span>. Alle 10 Stufen erhöht sich der Bonus-Impact um{' '}
              <span className="text-[#00f0ff] font-mono font-bold">+0.1 (+10%)</span>!
            </span>
          </div>
          <span className="text-[11px] text-gray-400 font-mono bg-black/60 px-2 py-0.5 rounded border border-gray-800">
            Keine starren Klassen • Maximale Freiheit
          </span>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 border-b border-gray-800/80 pb-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('mastery')}
            className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'mastery'
                ? 'bg-gradient-to-r from-[#00f0ff]/20 to-transparent border border-[#00f0ff] text-white shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                : 'bg-black/40 border border-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span>Meisterschaft (MasteryProgress)</span>
          </button>

          <button
            onClick={() => setActiveTab('weapons')}
            className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'weapons'
                ? 'bg-gradient-to-r from-[#00f0ff]/20 to-transparent border border-[#00f0ff] text-white shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                : 'bg-black/40 border border-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sword className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span>Waffen (Combat 0–100)</span>
          </button>

          <button
            onClick={() => setActiveTab('spells')}
            className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'spells'
                ? 'bg-gradient-to-r from-cyan-500/20 to-transparent border border-cyan-400 text-white shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                : 'bg-black/40 border border-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Zauberschulen & Magie (0–100)</span>
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
            <span>Rüstungs-Schulen (0–100)</span>
          </button>

          <button
            onClick={() => setActiveTab('professions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'professions'
                ? 'bg-gradient-to-r from-emerald-500/20 to-transparent border border-emerald-400 text-white shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'bg-black/40 border border-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <Hammer className="w-3.5 h-3.5 text-emerald-400" />
            <span>Berufe & Handwerk (0–100)</span>
          </button>

          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-[#b8860b]/30 to-transparent border border-[#b8860b] text-white shadow-[0_0_12px_rgba(184,134,11,0.2)]'
                : 'bg-black/40 border border-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-[#fbbf24]" />
            <span>Attribute & Werte</span>
          </button>
        </div>

        {/* Feedback Message */}
        {feedbackMessage && (
          <div
            className={`mt-2 p-2 rounded-lg flex items-center gap-2 text-xs font-mono animate-in fade-in ${
              feedbackMessage.isError
                ? 'bg-red-950/80 border border-red-700/60 text-red-300'
                : 'bg-emerald-950/80 border border-emerald-500/60 text-emerald-200'
            }`}
          >
            {feedbackMessage.text}
          </div>
        )}

        {/* Tab Body */}
        <div className="flex-1 min-h-0 overflow-y-auto py-3">
          {/* TAB 0: MASTERY PROGRESS (UNCAPPED 0-UNLIMITED & 10-LEVEL THRESHOLD MARKERS) */}
          {activeTab === 'mastery' && (
            <MasteryProgress
              stats={stats}
              professions={professions}
              onSelectMastery={(id, category) => {
                if (category === 'weapon') {
                  const wepType = id.replace('weapon_', '') as WeaponType;
                  setSelectedWeapon(wepType);
                  setActiveTab('weapons');
                } else if (category === 'profession_crafting' || category === 'profession_gathering') {
                  setSelectedProfId(id);
                  setSelectedProfCategory(category === 'profession_crafting' ? 'crafting' : 'gathering');
                  setActiveTab('professions');
                } else if (category === 'magic') {
                  setSelectedSpellId(id);
                  setActiveTab('spells');
                } else if (category === 'armor') {
                  setSelectedArmorSlot(id.replace('armor_', ''));
                  setActiveTab('armor');
                }
              }}
            />
          )}

          {/* TAB 1: WEAPONS (COMBAT 0-100) */}
          {activeTab === 'weapons' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-full">
              {/* Left Column: Weapon List (5 cols) */}
              <div className="md:col-span-5 space-y-2 overflow-y-auto pr-1">
                <div className="text-[11px] font-mono uppercase text-gray-400 mb-1 px-1">
                  11 Waffengattungen (Learning-by-Doing):
                </div>
                {ALL_WEAPONS.map((wep) => {
                  const m = weaponMasteries[wep.type] || {
                    level: 1,
                    xp: 0,
                    maxXp: 100,
                  };
                  const isSelected = wep.type === selectedWeapon;
                  const milestone = getSkillMilestoneStats(m.level);

                  return (
                    <button
                      key={wep.type}
                      onClick={() => setSelectedWeapon(wep.type)}
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
                          <div className="font-serif font-bold text-xs text-white truncate">
                            {wep.germanName}
                          </div>
                          <div className="text-[10px] text-gray-400 truncate">{wep.name}</div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-[10px] text-gray-400 font-mono">Stufe</span>
                          <span className="font-mono font-bold text-cyan-300 text-sm">{m.level}</span>
                        </div>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/60 border border-[#00f0ff]/30 text-[#00f0ff] inline-block mt-0.5">
                          {milestone.percentString} (+{(milestone.bonusRate).toFixed(1)})
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Selected Weapon Detailed Progression Display (7 cols) */}
              <div className="md:col-span-7 bg-black/60 rounded-xl border border-gray-800 p-4 flex flex-col justify-between overflow-y-auto space-y-4">
                {(() => {
                  const wepMeta = ALL_WEAPONS.find((w) => w.type === selectedWeapon) || ALL_WEAPONS[0];
                  const currentMastery = weaponMasteries[selectedWeapon] || {
                    level: 1,
                    xp: 0,
                    maxXp: 100,
                    type: selectedWeapon,
                    name: wepMeta.name,
                    icon: wepMeta.icon,
                    skills: [],
                    milestoneSkills: [],
                  };
                  const combatMult = getCombatMasteryMultiplier(currentMastery.level);
                  const milestone = getSkillMilestoneStats(currentMastery.level);

                  return (
                    <div className="space-y-4">
                      {/* Interactive Learning Progression Display */}
                      <LearningProgressionDisplay
                        name={wepMeta.name}
                        germanName={wepMeta.germanName}
                        categoryName="Waffendisziplin"
                        icon={wepMeta.icon}
                        level={currentMastery.level}
                        currentXp={currentMastery.xp}
                        maxXp={currentMastery.maxXp}
                        theme="cyan"
                        bonusTypeLabel="Waffen- & Kampf-Impact"
                        learningByDoingDesc={wepMeta.learningDesc}
                      />

                      {/* Associated Skills and Hotbar Assignment Deck */}
                      <div className="space-y-2 pt-2 border-t border-gray-800">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-serif font-bold text-white uppercase tracking-wider">
                            Fertigkeiten dieser Waffe (Hotbar 1–5):
                          </span>
                          <span className="text-[10px] text-[#00f0ff] font-mono">
                            Multiplikator: x{combatMult.damageMultiplier.toFixed(2)}
                          </span>
                        </div>

                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {[
                            ...(currentMastery.skills || []),
                            ...(currentMastery.milestoneSkills || []),
                            ...(currentMastery.skills?.length === 0 && currentMastery.milestoneSkills?.length === 0
                              ? [
                                  {
                                    id: `${selectedWeapon}_strike`,
                                    name: `${wepMeta.germanName} Primärschlag`,
                                    description: `Führt einen kraftvollen Hieb aus (+${milestone.percentString} Impact).`,
                                    icon: wepMeta.icon,
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
                              !skill.requiredMasteryLevel || currentMastery.level >= skill.requiredMasteryLevel;

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
                                    {skill.icon || wepMeta.icon}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-serif font-bold text-xs text-white">{skill.name}</span>
                                      {!isUnlocked && (
                                        <span className="px-1.5 py-0.2 rounded bg-red-950/80 border border-red-800/60 text-red-300 text-[9px] font-mono">
                                          Ab Stufe {skill.requiredMasteryLevel}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-sans line-clamp-1">
                                      {skill.description}
                                    </p>
                                    <span className="text-[9px] font-mono text-cyan-400">
                                      Effektiver Schaden:{' '}
                                      {Math.round(skill.damage * combatMult.damageMultiplier)}{' '}
                                      <span className="text-gray-500">(Basis: {skill.damage})</span>
                                    </span>
                                  </div>
                                </div>

                                {/* Hotbar Equip Buttons 1-5 */}
                                {isUnlocked ? (
                                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                                    <span className="text-[9px] text-gray-400 font-mono mr-1">Rüste in:</span>
                                    {[0, 1, 2, 3, 4].map((slotIdx) => (
                                      <button
                                        key={slotIdx}
                                        onClick={() => handleEquipToHotbar(slotIdx, skill)}
                                        className="px-2 py-1 rounded bg-black/80 border border-gray-700 hover:border-[#00f0ff] hover:text-[#00f0ff] text-[10px] font-mono font-bold transition-all cursor-pointer"
                                        title={`In Hotbar-Slot [${slotIdx + 1}] ausrüsten`}
                                      >
                                        [{slotIdx + 1}]
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-mono text-red-400">
                                    Gesperrt (Stufe {skill.requiredMasteryLevel})
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB 2: SPELLS & MAGIC (0-100) */}
          {activeTab === 'spells' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-full">
              {/* Left Column: Spell Schools List */}
              <div className="md:col-span-5 space-y-2 overflow-y-auto pr-1">
                <div className="text-[11px] font-mono uppercase text-gray-400 mb-1 px-1">
                  Zauberschulen & Magie-Attunement:
                </div>
                {SPELL_SCHOOLS.map((school) => {
                  const m = weaponMasteries[school.weaponRef] || {
                    level: 1,
                    xp: 0,
                    maxXp: 100,
                  };
                  const isSelected = school.id === selectedSpellId;
                  const milestone = getSkillMilestoneStats(m.level);

                  return (
                    <button
                      key={school.id}
                      onClick={() => setSelectedSpellId(school.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-black/90 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                          : 'bg-black/40 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-black/80 border border-gray-700 flex items-center justify-center text-xl shrink-0">
                          {school.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="font-serif font-bold text-xs text-white truncate">
                            {school.germanName}
                          </div>
                          <div className="text-[10px] text-gray-400 truncate">{school.name}</div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-[10px] text-gray-400 font-mono">Stufe</span>
                          <span className="font-mono font-bold text-cyan-300 text-sm">{m.level}</span>
                        </div>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-400/30 text-cyan-300 inline-block mt-0.5">
                          {milestone.percentString} (+{(milestone.bonusRate).toFixed(1)})
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Spell Details */}
              <div className="md:col-span-7 bg-black/60 rounded-xl border border-gray-800 p-4 space-y-4 overflow-y-auto">
                {(() => {
                  const school = SPELL_SCHOOLS.find((s) => s.id === selectedSpellId) || SPELL_SCHOOLS[0];
                  const m = weaponMasteries[school.weaponRef] || {
                    level: 1,
                    xp: 0,
                    maxXp: 100,
                    skills: [],
                    milestoneSkills: [],
                  };
                  const combatMult = getCombatMasteryMultiplier(m.level);
                  const milestone = getSkillMilestoneStats(m.level);

                  return (
                    <div className="space-y-4">
                      <LearningProgressionDisplay
                        name={school.name}
                        germanName={school.germanName}
                        categoryName="Magieschule"
                        icon={school.icon}
                        level={m.level}
                        currentXp={m.xp}
                        maxXp={m.maxXp}
                        theme="blue"
                        bonusTypeLabel="Zaubermacht & Aether-Impact"
                        learningByDoingDesc={school.learningDesc}
                      />

                      {/* Spell Mechanics Breakdown */}
                      <div className="p-3 rounded-xl bg-black/80 border border-gray-800 text-xs space-y-2">
                        <span className="font-serif font-bold text-white flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                          Organisches Zauber-Learning:
                        </span>
                        <p className="text-gray-300 text-[11px] leading-relaxed">
                          Jeder Zauber, den du im Kampf oder zur Heilung wirkst, trainiert unmittelbar diese Schule.
                          Durch das <strong className="text-white">10-Stufen-Gesetz</strong> erhöht sich deine Zaubermacht
                          alle 10 Level um <strong className="text-cyan-300">+0.1 (+10%)</strong>.
                        </p>
                      </div>

                      {/* Available Spells */}
                      <div className="space-y-2 pt-2 border-t border-gray-800">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-serif font-bold text-white uppercase tracking-wider">
                            Zaubersprüche dieser Schule (In Hotbar ausrüsten):
                          </span>
                          <span className="text-[10px] text-cyan-400 font-mono">
                            Multiplikator: x{combatMult.damageMultiplier.toFixed(2)}
                          </span>
                        </div>

                        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                          {[
                            ...(m.skills || []),
                            ...(m.milestoneSkills || []),
                          ].map((spell, idx) => {
                            const isUnlocked = !spell.requiredMasteryLevel || m.level >= spell.requiredMasteryLevel;

                            return (
                              <div
                                key={spell.id || idx}
                                className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                  isUnlocked ? 'bg-black/70 border-gray-800' : 'bg-black/30 border-gray-900 opacity-60'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-lg bg-black/80 border border-gray-700 flex items-center justify-center text-lg shrink-0">
                                    {spell.icon || school.icon}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-serif font-bold text-xs text-white">{spell.name}</span>
                                      {!isUnlocked && (
                                        <span className="px-1.5 py-0.2 rounded bg-red-950/80 border border-red-800/60 text-red-300 text-[9px] font-mono">
                                          Ab Stufe {spell.requiredMasteryLevel}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-sans line-clamp-1">
                                      {spell.description}
                                    </p>
                                    <span className="text-[9px] font-mono text-cyan-400">
                                      Zauberkraft: {Math.round(spell.damage * combatMult.damageMultiplier)}{' '}
                                      <span className="text-gray-500">
                                        (Mana: {spell.resourceCost}, CD: {spell.cooldown}s)
                                      </span>
                                    </span>
                                  </div>
                                </div>

                                {isUnlocked && (
                                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                                    <span className="text-[9px] text-gray-400 font-mono mr-1">Rüste in:</span>
                                    {[0, 1, 2, 3, 4].map((slotIdx) => (
                                      <button
                                        key={slotIdx}
                                        onClick={() => handleEquipToHotbar(slotIdx, spell)}
                                        className="px-2 py-1 rounded bg-black/80 border border-gray-700 hover:border-cyan-400 hover:text-cyan-400 text-[10px] font-mono font-bold transition-all cursor-pointer"
                                        title={`In Hotbar-Slot [${slotIdx + 1}] ausrüsten`}
                                      >
                                        [{slotIdx + 1}]
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB 3: ARMOR SCHOOLS (0-100) */}
          {activeTab === 'armor' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-full">
              {/* Left Column: Armor List */}
              <div className="md:col-span-5 space-y-2">
                <div className="text-[11px] font-mono uppercase text-gray-400 mb-1 px-1">
                  Rüstungsgattungen (Learning-by-Doing):
                </div>
                {ARMOR_SCHOOLS.map((arm) => {
                  const isSelected = arm.slot === selectedArmorSlot;
                  const armorStats = stats.armorMasteries?.[arm.slot as any] || {
                    level: 1,
                    currentXp: 0,
                    maxXp: 100,
                  };
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
                        <div className="text-xs font-mono font-bold text-purple-300">
                          Stufe {armorStats.level}
                        </div>
                        <span className="text-[9px] font-mono text-purple-400">
                          {milestone.percentString} Absorpt.
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Armor Progression Display */}
              <div className="md:col-span-7 bg-black/60 rounded-xl border border-gray-800 p-4 space-y-4">
                {(() => {
                  const selArm = ARMOR_SCHOOLS.find((a) => a.slot === selectedArmorSlot) || ARMOR_SCHOOLS[0];
                  const armorStats = stats.armorMasteries?.[selArm.slot as any] || {
                    level: 1,
                    currentXp: 0,
                    maxXp: 100,
                  };
                  const eff = getArmorEfficiencyMultiplier(armorStats.level);

                  return (
                    <div className="space-y-4">
                      <LearningProgressionDisplay
                        name={selArm.name}
                        germanName={selArm.germanName}
                        categoryName="Rüstungsschule"
                        icon={selArm.icon}
                        level={armorStats.level}
                        currentXp={armorStats.currentXp}
                        maxXp={armorStats.maxXp}
                        theme="purple"
                        bonusTypeLabel="Schadensabsorption & Schutz"
                        learningByDoingDesc={selArm.learningDesc}
                      />

                      <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/40 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-serif font-bold text-white flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-purple-400" />
                            Defensiver Bonus (10-Stufen-Gesetz):
                          </span>
                          <span className="font-mono font-bold text-purple-300 text-sm">
                            +{eff.bonusPercent}% Schadensreduktion (+{(eff.reductionBonus).toFixed(1)})
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-300 font-sans">
                          {selArm.learningDesc}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-black/80 border border-gray-800 text-xs space-y-2">
                        <span className="font-serif font-bold text-white block">Keine Klassenbeschränkung:</span>
                        <p className="text-gray-300 text-[11px] leading-relaxed">
                          In Aurion kann jeder Charakter schwere Plattenrüstung, Lederrüstung oder Seidenroben
                          ohne Strafen tragen. Du kannst dich als Plattenharnisch-Zauberer oder federleichter
                          Kriegshammer-Kämpfer spezialisieren.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB 4: PROFESSIONS (GATHERING & CRAFTING 0-100) */}
          {activeTab === 'professions' && (
            <div className="space-y-3">
              {/* Category Subtabs: Gathering vs Crafting */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedProfCategory('gathering');
                    setSelectedProfId('woodcutter');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all cursor-pointer ${
                    selectedProfCategory === 'gathering'
                      ? 'bg-emerald-950/80 border border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                      : 'bg-black/50 border border-gray-800 text-gray-400'
                  }`}
                >
                  🌾 Sammeln & Farming (Ertrags-Bonus +0.1 pro 10 Lv)
                </button>
                <button
                  onClick={() => {
                    setSelectedProfCategory('crafting');
                    setSelectedProfId('blacksmith');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all cursor-pointer ${
                    selectedProfCategory === 'crafting'
                      ? 'bg-amber-950/80 border border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                      : 'bg-black/50 border border-gray-800 text-gray-400'
                  }`}
                >
                  ⚒️ Handwerks-Disziplinen (Doppel-Craft-Chance +0.1 pro 10 Lv)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Left Column: Profession Items */}
                <div className="md:col-span-5 space-y-2">
                  {(selectedProfCategory === 'gathering' ? GATHERING_LIST : CRAFTING_LIST).map((p) => {
                    const prof = professions[p.id as ProfessionId] || {
                      level: 1,
                      xp: 0,
                      maxXp: 100,
                    };
                    const isSelected = p.id === selectedProfId;
                    const milestone = getSkillMilestoneStats(prof.level);

                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProfId(p.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? selectedProfCategory === 'gathering'
                              ? 'bg-black/90 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                              : 'bg-black/90 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                            : 'bg-black/40 border-gray-800 hover:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-black/80 border border-gray-700 flex items-center justify-center text-xl shrink-0">
                            {p.icon}
                          </div>
                          <div>
                            <div className="font-serif font-bold text-xs text-white">{p.name}</div>
                            <div className="text-[10px] text-gray-400">{p.desc}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div
                            className={`text-xs font-mono font-bold ${
                              selectedProfCategory === 'gathering' ? 'text-emerald-300' : 'text-amber-300'
                            }`}
                          >
                            Stufe {prof.level}
                          </div>
                          <span
                            className={`text-[9px] font-mono ${
                              selectedProfCategory === 'gathering' ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {selectedProfCategory === 'gathering'
                              ? `${milestone.percentString} Ertrag`
                              : `${milestone.percentString} Doppel-Craft`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Right Column: Profession Progression Detail */}
                <div className="md:col-span-7 bg-black/60 rounded-xl border border-gray-800 p-4 space-y-4">
                  {(() => {
                    const profMeta =
                      (selectedProfCategory === 'gathering' ? GATHERING_LIST : CRAFTING_LIST).find(
                        (p) => p.id === selectedProfId
                      ) || GATHERING_LIST[0];
                    const prof = professions[selectedProfId as ProfessionId] || {
                      level: 1,
                      xp: 0,
                      maxXp: 100,
                    };
                    const milestone = getSkillMilestoneStats(prof.level);
                    const isGather = selectedProfCategory === 'gathering';

                    return (
                      <div className="space-y-4">
                        <LearningProgressionDisplay
                          name={profMeta.name}
                          germanName={profMeta.name}
                          categoryName={isGather ? 'Sammelberuf' : 'Handwerksdisziplin'}
                          icon={profMeta.icon}
                          level={prof.level}
                          currentXp={prof.xp}
                          maxXp={prof.maxXp}
                          theme={isGather ? 'emerald' : 'amber'}
                          bonusTypeLabel={isGather ? 'Sammelertrag-Ausbeute' : 'Doppelter Gegenstand (Chance)'}
                          learningByDoingDesc={
                            isGather
                              ? 'Steigt organisch durch jeden abgebauten Rohstoff, gefällten Baum und geernteten Strauch.'
                              : 'Steigt durch jedes am Amboss oder Alchemietisch hergestellte Werkstück.'
                          }
                        />

                        {/* Law explanation */}
                        <div
                          className={`p-3 rounded-xl border space-y-1.5 ${
                            isGather
                              ? 'bg-emerald-950/30 border-emerald-500/40'
                              : 'bg-amber-950/30 border-amber-500/40'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-serif font-bold text-white flex items-center gap-1.5">
                              <TrendingUp
                                className={`w-3.5 h-3.5 ${isGather ? 'text-emerald-400' : 'text-amber-400'}`}
                              />
                              {isGather ? 'Ertrags-Ausbeute (10-Stufen-Gesetz):' : 'Doppel-Craft (10-Stufen-Gesetz):'}
                            </span>
                            <span
                              className={`font-mono font-bold text-sm ${
                                isGather ? 'text-emerald-300' : 'text-amber-300'
                              }`}
                            >
                              {milestone.percentString} Bonus (+{(milestone.bonusRate).toFixed(1)})
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-300 font-sans">
                            {isGather
                              ? `Alle 10 Stufen erhältst du +0.1 (+10%) mehr Rohstoffe pro Sammelvorgang.`
                              : `Alle 10 Stufen erhältst du eine 0.1 (10%) Chance, ein zweites Exemplar ohne zusätzliche Materialien herzustellen.`}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: OVERVIEW & ATTRIBUTES */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Base Attributes Box */}
                <div className="bg-black/50 p-4 rounded-xl border border-[#b8860b]/40 space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                    <h3 className="text-sm font-serif font-bold text-[#fbbf24] uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-4 h-4 text-[#fbbf24]" />
                      Basis-Attribute
                    </h3>
                    {stats.statPoints > 0 && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400 text-amber-300 text-xs font-mono font-bold animate-pulse">
                        +{stats.statPoints} Punkte verfügbar
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {[
                      {
                        key: 'strength' as const,
                        name: 'Stärke (Strength)',
                        desc: 'Physischer Schaden & Schwere Wucht',
                        icon: '⚔️',
                        val: stats.attributes?.strength || 10,
                      },
                      {
                        key: 'agility' as const,
                        name: 'Geschicklichkeit (Agility)',
                        desc: 'Angriffstempo, Ausweichen & Krit-Chance',
                        icon: '🏹',
                        val: stats.attributes?.agility || 10,
                      },
                      {
                        key: 'intelligence' as const,
                        name: 'Intelligenz (Intelligence)',
                        desc: 'Maximales Mana & Zauberkraft',
                        icon: '✨',
                        val: stats.attributes?.intelligence || 10,
                      },
                      {
                        key: 'defense' as const,
                        name: 'Verteidigung (Defense)',
                        desc: 'Rüstungswert, Zähigkeit & Lebenspunkte',
                        icon: '🛡️',
                        val: stats.attributes?.defense || 10,
                      },
                    ].map((attr) => (
                      <div
                        key={attr.key}
                        className="p-2 rounded-lg bg-black/60 border border-gray-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{attr.icon}</span>
                          <div>
                            <div className="font-serif font-bold text-xs text-white">{attr.name}</div>
                            <div className="text-[10px] text-gray-400">{attr.desc}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-bold text-[#fbbf24]">{attr.val}</span>
                          {stats.statPoints > 0 && onAllocateStatPoint && (
                            <button
                              onClick={() => handleAllocate(attr.key)}
                              className="w-6 h-6 rounded bg-amber-500/30 hover:bg-amber-500/50 border border-amber-400 text-amber-200 flex items-center justify-center font-bold transition-all cursor-pointer"
                              title={`${attr.name} um 1 erhöhen`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vitals & Combat Statistics Box */}
                <div className="bg-black/50 p-4 rounded-xl border border-gray-800 space-y-3">
                  <h3 className="text-sm font-serif font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-800 pb-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    Kampfwerte & Resonanz
                  </h3>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-black/60 border border-gray-800">
                      <span className="text-[10px] text-gray-400 block">Lebenspunkte (HP)</span>
                      <span className="text-sm font-bold text-emerald-400">
                        {Math.round(stats.hp)} / {stats.maxHp}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-black/60 border border-gray-800">
                      <span className="text-[10px] text-gray-400 block">{stats.resourceName || 'Mana / Aether'}</span>
                      <span className="text-sm font-bold text-[#00f0ff]">
                        {Math.round(stats.resource)} / {stats.maxResource}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-black/60 border border-gray-800">
                      <span className="text-[10px] text-gray-400 block">Angriffskraft / Zaubermacht</span>
                      <span className="text-sm font-bold text-amber-400">
                        {stats.attackPower || 50} / {stats.spellPower || 50}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-black/60 border border-gray-800">
                      <span className="text-[10px] text-gray-400 block">Rüstungswert</span>
                      <span className="text-sm font-bold text-purple-300">{stats.armor || 20}</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-black/60 border border-gray-800">
                      <span className="text-[10px] text-gray-400 block">Kritische Trefferchance</span>
                      <span className="text-sm font-bold text-cyan-300">{stats.critChance || 5}%</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-black/60 border border-gray-800">
                      <span className="text-[10px] text-gray-400 block">Gesamt-Meisterschaft</span>
                      <span className="text-sm font-bold text-[#00f0ff]">{totalMasterySum} Ränge</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
