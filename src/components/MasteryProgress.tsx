import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  TrendingUp,
  Award,
  Search,
  Zap,
  Hammer,
  Sword,
  Shield,
  Wand2,
  CheckCircle2,
  Target,
  Infinity as InfinityIcon,
  ChevronRight,
  ArrowUpRight,
  Layers,
  Flame,
} from 'lucide-react';
import {
  PlayerStats,
  ProfessionId,
  ProfessionSkill,
  WeaponMastery,
  WeaponType,
  ArmorMastery,
  ArmorType,
} from '../types';
import { DEFAULT_PROFESSION_SKILLS } from '../data/professionsData';
import { DEFAULT_WEAPON_MASTERIES } from '../data/mmorpgData';
import { getUncappedThresholdData, ThresholdProgressData } from '../data/classlessProgression';

export type MasteryCategory = 'all' | 'professions' | 'weapons' | 'spells' | 'armor';

export interface MasteryItem {
  id: string;
  name: string;
  germanName: string;
  category: 'profession_crafting' | 'profession_gathering' | 'weapon' | 'magic' | 'armor';
  icon: string;
  color: string;
  level: number;
  xp: number;
  maxXp: number;
  description: string;
  impactNote: string;
  thresholdData: ThresholdProgressData;
}

export interface MasteryProgressProps {
  stats: PlayerStats;
  professions?: Record<ProfessionId, ProfessionSkill>;
  onSelectMastery?: (id: string, category: string) => void;
  className?: string;
}

export const MasteryProgress: React.FC<MasteryProgressProps> = ({
  stats,
  professions = DEFAULT_PROFESSION_SKILLS,
  onSelectMastery,
  className = '',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<MasteryCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'level' | 'threshold' | 'name'>('level');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Compile all uncapped skill levels across weapons, spells, armor, and professions
  const allMasteryItems = useMemo<MasteryItem[]>(() => {
    const items: MasteryItem[] = [];

    // 1. Professions (Crafting & Gathering)
    const profs = { ...DEFAULT_PROFESSION_SKILLS, ...(stats.professions || {}), ...professions };
    Object.values(profs).forEach((p) => {
      const isCrafting = p.category === 'crafting';
      const lvl = Math.max(0, p.level || 1);
      const thresholdData = getUncappedThresholdData(lvl);

      items.push({
        id: p.id,
        name: p.name,
        germanName: p.germanName || p.name,
        category: isCrafting ? 'profession_crafting' : 'profession_gathering',
        icon: p.icon,
        color: p.color || (isCrafting ? '#f59e0b' : '#10b981'),
        level: lvl,
        xp: p.xp || 0,
        maxXp: p.maxXp || 100,
        description: p.description,
        impactNote: isCrafting
          ? `+0.1% (+10%) Chance auf ein zweites/dupliziertes Handwerksstück pro 10-Level-Schwelle.`
          : `+0.1% (+10%) Rohstoff-Ernte & Ausbeute seltener Materialien pro 10-Level-Schwelle.`,
        thresholdData,
      });
    });

    // 2. Weapon Masteries
    const wepMasteries = { ...DEFAULT_WEAPON_MASTERIES, ...(stats.weaponMasteries || {}) };
    Object.values(wepMasteries).forEach((w) => {
      const lvl = Math.max(0, w.level || 1);
      const thresholdData = getUncappedThresholdData(lvl);

      items.push({
        id: `weapon_${w.type}`,
        name: w.name,
        germanName: getWeaponGermanName(w.type, w.name),
        category: 'weapon',
        icon: w.icon,
        color: w.color || '#00f0ff',
        level: lvl,
        xp: w.xp || 0,
        maxXp: w.maxXp || 100,
        description: w.description || 'Waffenmeisterschaft mit spezialisierten Hieben und Kontern.',
        impactNote: `+0.1% Angriffskraft & Skalierung auf alle Waffenfertigkeiten pro 10-Level-Schwelle.`,
        thresholdData,
      });
    });

    // 3. Magic & Spell Schools
    const spellSchools = [
      {
        id: 'spell_aether',
        name: 'Aurion-Aether-Attunement',
        germanName: 'Aether-Einklang',
        icon: '✨',
        color: '#00f0ff',
        level: Math.max(0, stats.weaponMasteries?.arcane?.level || Math.floor((stats.spellPower || 50) / 5)),
        xp: stats.weaponMasteries?.arcane?.xp || 45,
        maxXp: 100,
        desc: 'Reinste Aether-Kanalisierung, Leylinien-Resonanz und Mana-Regeneration.',
        impact: '+0.1% Zauberkraft und verringerte Aether-Kosten pro 10-Level-Schwelle.',
      },
      {
        id: 'spell_elemental',
        name: 'Elemental Evocation',
        germanName: 'Elementar-Evokation',
        icon: '🔥',
        color: '#f97316',
        level: Math.max(0, Math.floor((stats.level || 1) * 2)),
        xp: 60,
        maxXp: 120,
        desc: 'Feuerbälle, Blitzketten und Frost-Nova-Synergien.',
        impact: '+0.1% Elementarschaden und Synergie-Detonationsschaden pro 10-Level-Schwelle.',
      },
      {
        id: 'spell_radiant',
        name: 'Radiant Leylines',
        germanName: 'Strahlende Leylinien',
        icon: '☀️',
        color: '#fbbf24',
        level: Math.max(0, Math.floor((stats.level || 1) * 1.5)),
        xp: 30,
        maxXp: 100,
        desc: 'Heilende Aurion-Impulse, Schutzschilde und Reinigungsrituale.',
        impact: '+0.1% Heilungseffizienz und Barrieren-Stärke pro 10-Level-Schwelle.',
      },
      {
        id: 'spell_shadow',
        name: 'Void & Chrono Magic',
        germanName: 'Leere & Chrono-Magie',
        icon: '🔮',
        color: '#a855f7',
        level: Math.max(0, Math.floor((stats.level || 1) * 1.2)),
        xp: 20,
        maxXp: 100,
        desc: 'Zeitverzerrung, Gravitationsfelder und Entropie.',
        impact: '+0.1% Zeiteffekte und Debuff-Dauer pro 10-Level-Schwelle.',
      },
    ];

    spellSchools.forEach((s) => {
      const thresholdData = getUncappedThresholdData(s.level);
      items.push({
        id: s.id,
        name: s.name,
        germanName: s.germanName,
        category: 'magic',
        icon: s.icon,
        color: s.color,
        level: s.level,
        xp: s.xp,
        maxXp: s.maxXp,
        description: s.desc,
        impactNote: s.impact,
        thresholdData,
      });
    });

    // 4. Armor Disciplines
    const armorSchools: {
      id: string;
      name: string;
      germanName: string;
      icon: string;
      color: string;
      desc: string;
    }[] = [
      {
        id: 'plate',
        name: 'Heavy Plate Armor',
        germanName: 'Schwere Plattenrüstung',
        icon: '🛡️',
        color: '#e2e8f0',
        desc: 'Schwere Bronze- und Stahlpanzerung gegen physische Wuchtangriffe.',
      },
      {
        id: 'leather',
        name: 'Medium Leather Armor',
        germanName: 'Mittlere Lederrüstung',
        icon: '🥋',
        color: '#b45309',
        desc: 'Bewegliche Tierhäute mit Ausdauer- und Ausweich-Boni.',
      },
      {
        id: 'cloth',
        name: 'Light Cloth & Robes',
        germanName: 'Arkane Stoffgewänder',
        icon: '👘',
        color: '#c084fc',
        desc: 'Gewebte Seidenroben mit erhöhtem Manafluss und Magieschutz.',
      },
      {
        id: 'shield',
        name: 'Shield Mastery',
        germanName: 'Schild- & Blockkunst',
        icon: '🛡️',
        color: '#fbbf24',
        desc: 'Paraden, Schildstöße und projektilabwehrende Phalanx.',
      },
    ];

    armorSchools.forEach((a) => {
      const currentMastery = (stats.armorMasteries as any)?.[a.id];
      const lvl = Math.max(0, currentMastery?.level || Math.floor((stats.armor || 20) / 4));
      const thresholdData = getUncappedThresholdData(lvl);

      items.push({
        id: `armor_${a.id}`,
        name: a.name,
        germanName: a.germanName,
        category: 'armor',
        icon: a.icon,
        color: a.color,
        level: lvl,
        xp: currentMastery?.xp || 20,
        maxXp: currentMastery?.maxXp || 100,
        description: a.desc,
        impactNote: `+0.1% Rüstungseffizienz und Schadensabsorption pro 10-Level-Schwelle.`,
        thresholdData,
      });
    });

    return items;
  }, [stats, professions]);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    return allMasteryItems
      .filter((item) => {
        // Category filter
        if (selectedCategory === 'professions') {
          if (item.category !== 'profession_crafting' && item.category !== 'profession_gathering') {
            return false;
          }
        } else if (selectedCategory === 'weapons' && item.category !== 'weapon') {
          return false;
        } else if (selectedCategory === 'spells' && item.category !== 'magic') {
          return false;
        } else if (selectedCategory === 'armor' && item.category !== 'armor') {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesName =
            item.name.toLowerCase().includes(q) ||
            item.germanName.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q);
          if (!matchesName) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'level') {
          return b.level - a.level;
        }
        if (sortBy === 'threshold') {
          return a.thresholdData.levelsToNextThreshold - b.thresholdData.levelsToNextThreshold;
        }
        return a.germanName.localeCompare(b.germanName);
      });
  }, [allMasteryItems, selectedCategory, searchQuery, sortBy]);

  // High-level macro statistics
  const totalMasteryRanks = useMemo(
    () => allMasteryItems.reduce((acc, item) => acc + item.level, 0),
    [allMasteryItems]
  );
  const totalThresholdsReached = useMemo(
    () => allMasteryItems.reduce((acc, item) => acc + item.thresholdData.completedThresholds, 0),
    [allMasteryItems]
  );
  const totalAccumulatedBonusPercent = (totalThresholdsReached * 0.1).toFixed(1);

  return (
    <div className={`space-y-4 ${className}`} id="mastery-progress-root">
      {/* 1. Global Macro Summary Card */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#04101e] via-black/80 to-[#120d04] border border-[#00f0ff]/40 shadow-[0_0_30px_rgba(0,240,255,0.12)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-cyan-950/80 border border-[#00f0ff] flex items-center justify-center text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.3)] shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-serif font-bold text-white tracking-wide">
                  Meisterschafts-Fortschritt & Schwellenwerte
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-[#00f0ff]/60 text-[#00f0ff] text-[10px] font-mono font-bold flex items-center gap-1">
                  <InfinityIcon className="w-3 h-3" />
                  0 – Unbegrenzt (Uncapped)
                </span>
              </div>
              <p className="text-xs text-gray-400 font-sans mt-0.5">
                RuneScape-inspiriertes Learning-by-Doing: Jede erreichte 10-Stufen-Schwelle verleiht dauerhaft{' '}
                <strong className="text-[#00f0ff] font-mono">+0.1% (+10%) Impact-Bonus</strong>.
              </p>
            </div>
          </div>

          {/* Key Metric Chips */}
          <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
            <div className="px-3 py-1.5 rounded-xl bg-black/80 border border-gray-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <div>
                <span className="text-[10px] text-gray-500 block leading-none">Ränge Gesamt</span>
                <span className="text-white font-bold text-sm">{totalMasteryRanks}</span>
              </div>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-black/80 border border-amber-500/40 flex items-center gap-2 shadow-[0_0_12px_rgba(251,191,36,0.15)]">
              <Award className="w-4 h-4 text-[#fbbf24]" />
              <div>
                <span className="text-[10px] text-gray-500 block leading-none">Schwellen (10er)</span>
                <span className="text-[#fbbf24] font-bold text-sm">{totalThresholdsReached}</span>
              </div>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-black/80 border border-emerald-500/40 flex items-center gap-2 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-[10px] text-gray-500 block leading-none">Kumulierter Bonus</span>
                <span className="text-emerald-400 font-bold text-sm">+{totalAccumulatedBonusPercent}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Category Selector Tabs & Filter Bar */}
        <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            <CategoryFilterButton
              active={selectedCategory === 'all'}
              onClick={() => setSelectedCategory('all')}
              label="Alle Fertigkeiten"
              count={allMasteryItems.length}
              icon={<Layers className="w-3.5 h-3.5" />}
            />
            <CategoryFilterButton
              active={selectedCategory === 'professions'}
              onClick={() => setSelectedCategory('professions')}
              label="Berufe (Handwerk & Ernte)"
              count={allMasteryItems.filter((i) => i.category.startsWith('profession')).length}
              icon={<Hammer className="w-3.5 h-3.5" />}
              color="emerald"
            />
            <CategoryFilterButton
              active={selectedCategory === 'weapons'}
              onClick={() => setSelectedCategory('weapons')}
              label="Waffen"
              count={allMasteryItems.filter((i) => i.category === 'weapon').length}
              icon={<Sword className="w-3.5 h-3.5" />}
              color="amber"
            />
            <CategoryFilterButton
              active={selectedCategory === 'spells'}
              onClick={() => setSelectedCategory('spells')}
              label="Magie & Zauber"
              count={allMasteryItems.filter((i) => i.category === 'magic').length}
              icon={<Wand2 className="w-3.5 h-3.5" />}
              color="cyan"
            />
            <CategoryFilterButton
              active={selectedCategory === 'armor'}
              onClick={() => setSelectedCategory('armor')}
              label="Rüstung"
              count={allMasteryItems.filter((i) => i.category === 'armor').length}
              icon={<Shield className="w-3.5 h-3.5" />}
              color="purple"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Fertigkeit suchen..."
                className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg bg-black/70 border border-gray-800 text-white placeholder-gray-500 focus:outline-none focus:border-[#00f0ff]"
              />
            </div>

            {/* Sort Toggle */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="py-1 px-2 text-xs rounded-lg bg-black/70 border border-gray-800 text-gray-300 focus:outline-none focus:border-[#00f0ff]"
            >
              <option value="level">Stufe (Hoch → Tief)</option>
              <option value="threshold">Nächste Schwelle</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. List of Uncapped Mastery Progress Bars */}
      <div className="space-y-3">
        {filteredItems.map((item) => (
          <MasteryItemProgressBarCard
            key={item.id}
            item={item}
            isExpanded={expandedItem === item.id}
            onToggleExpand={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
            onSelect={() => onSelectMastery?.(item.id, item.category)}
          />
        ))}

        {filteredItems.length === 0 && (
          <div className="p-8 text-center rounded-xl bg-black/40 border border-gray-800 text-gray-400">
            <p className="text-sm font-serif">Keine Meisterschaften oder Berufe gefunden.</p>
            <p className="text-xs text-gray-500 mt-1">Überprüfe deine Suchfilter oder wähle eine andere Kategorie.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Single Mastery Item Progress Bar Card with 10-Level Threshold Markers
// ============================================================================

interface MasteryItemProgressBarCardProps {
  item: MasteryItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
}

const MasteryItemProgressBarCard: React.FC<MasteryItemProgressBarCardProps> = ({
  item,
  isExpanded,
  onToggleExpand,
  onSelect,
}) => {
  const { level, xp, maxXp, thresholdData } = item;
  const {
    completedThresholds,
    impactBonusString,
    nextThresholdLevel,
    nextImpactBonusString,
    levelsToNextThreshold,
    cycleProgressPercent,
  } = thresholdData;

  // Uncapped scale: Determine visible ceiling for markers.
  // At minimum 100, or extends to the next multiple of 50/100 beyond current level.
  const visibleMaxThreshold = Math.max(100, Math.ceil((level + 10) / 10) * 10);
  const totalThresholdPoints = visibleMaxThreshold / 10;

  // Generate 10-level threshold markers: [10, 20, 30, ... visibleMaxThreshold]
  const thresholdMarkers = useMemo(() => {
    const markers: {
      thresholdLevel: number;
      isReached: boolean;
      isNextTarget: boolean;
      bonusPercentString: string;
      positionPercent: number;
    }[] = [];

    for (let t = 10; t <= visibleMaxThreshold; t += 10) {
      const isReached = level >= t;
      const isNextTarget = t === nextThresholdLevel;
      const bonus = (t / 10 * 0.1).toFixed(1);
      const positionPercent = (t / visibleMaxThreshold) * 100;

      markers.push({
        thresholdLevel: t,
        isReached,
        isNextTarget,
        bonusPercentString: `+${bonus}%`,
        positionPercent,
      });
    }

    return markers;
  }, [level, visibleMaxThreshold, nextThresholdLevel]);

  // Overall bar percentage (uncapped relative to visible track)
  const trackFillPercent = Math.min(100, Math.max(0, (level / visibleMaxThreshold) * 100));

  // XP to next level percentage
  const levelXpPercent = Math.min(100, Math.max(0, Math.floor((xp / Math.max(1, maxXp)) * 100)));

  return (
    <div
      id={`mastery-card-${item.id}`}
      className="p-3 sm:p-4 rounded-xl bg-[#090e17]/90 border border-gray-800 hover:border-gray-700 transition-all shadow-md group"
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-black/80 border flex items-center justify-center text-xl shrink-0 shadow-inner"
            style={{ borderColor: item.color }}
          >
            {item.icon}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-serif font-bold text-white truncate">
                {item.germanName}
              </h4>
              <span className="text-[10px] text-gray-400 font-sans hidden sm:inline truncate">
                ({item.name})
              </span>
              <span
                className="px-2 py-0.2 rounded text-[9px] font-mono uppercase font-bold tracking-wider"
                style={{
                  backgroundColor: `${item.color}15`,
                  borderColor: `${item.color}40`,
                  borderWidth: 1,
                  color: item.color,
                }}
              >
                {getCategoryLabel(item.category)}
              </span>
            </div>

            <p className="text-[11px] text-gray-400 font-sans line-clamp-1 mt-0.5">
              {item.description}
            </p>
          </div>
        </div>

        {/* Level & Current Impact Bonus Badges */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {/* Level Badge */}
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <span className="text-[10px] text-gray-400 font-mono">Stufe</span>
              <span className="font-mono font-bold text-white text-base leading-none">
                {level}
              </span>
              <span className="text-[10px] text-cyan-400 font-mono" title="Unbegrenzt / Uncapped">
                ∞
              </span>
            </div>
            <span className="text-[9px] font-mono text-gray-400 block">
              {xp} / {maxXp} XP ({levelXpPercent}%)
            </span>
          </div>

          {/* 10-Level Threshold Active Impact Bonus Pill */}
          <div className="px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-[#00f0ff]/50 text-right shadow-[0_0_12px_rgba(0,240,255,0.15)]">
            <div className="flex items-center gap-1 justify-end text-[#00f0ff] font-mono font-bold text-xs">
              <Sparkles className="w-3 h-3 text-[#00f0ff]" />
              <span>{impactBonusString}</span>
            </div>
            <span className="text-[8.5px] font-mono text-cyan-300 block leading-tight">
              {completedThresholds} {completedThresholds === 1 ? 'Schwelle' : 'Schwellen'}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. VISUAL PROGRESS BAR WITH 10-LEVEL THRESHOLD MARKERS */}
      {/* ========================================================================= */}
      <div className="mt-3.5 pt-2 border-t border-gray-800/80 space-y-2">
        {/* Threshold Track Info Callout */}
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-gray-400 flex items-center gap-1">
            <Target className="w-3 h-3 text-cyan-400" />
            <span>
              Aktueller Zyklus: Noch <strong className="text-white font-bold">{levelsToNextThreshold} Level</strong> bis{' '}
              <strong className="text-[#00f0ff]">Stufe {nextThresholdLevel}</strong>
            </span>
          </span>

          <span className="text-amber-300 font-semibold flex items-center gap-1">
            <span>Nächster Meilenstein:</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 font-bold">
              {nextImpactBonusString} Impact (+0.1%)
            </span>
          </span>
        </div>

        {/* Visual Multi-Threshold Track Bar */}
        <div className="relative pt-1 pb-6">
          {/* Background Track */}
          <div className="w-full h-4 sm:h-4.5 bg-black/95 rounded-full border border-gray-800 relative overflow-hidden shadow-inner">
            {/* Filled Progress Bar (Uncapped 0 -> visibleMaxThreshold) */}
            <div
              className="h-full rounded-full transition-all duration-300 relative overflow-hidden"
              style={{
                width: `${trackFillPercent}%`,
                background: `linear-gradient(90deg, #083344 0%, ${item.color} 100%)`,
                boxShadow: `0 0 12px ${item.color}60`,
              }}
            >
              {/* Subtle animated sheen */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
            </div>
          </div>

          {/* 10-Level Threshold Pins & Badges along the track */}
          <div className="absolute inset-x-0 top-1 h-4 sm:h-4.5 pointer-events-none">
            {thresholdMarkers.map((marker) => {
              return (
                <div
                  key={marker.thresholdLevel}
                  className="absolute top-0 -translate-x-1/2 flex flex-col items-center pointer-events-auto group/marker"
                  style={{ left: `${marker.positionPercent}%` }}
                >
                  {/* Vertical Pin Line through track */}
                  <div
                    className={`w-0.5 h-4 sm:h-4.5 transition-colors ${
                      marker.isReached
                        ? 'bg-amber-300 shadow-[0_0_6px_#fbbf24]'
                        : marker.isNextTarget
                        ? 'bg-[#00f0ff] animate-pulse'
                        : 'bg-gray-700/80'
                    }`}
                  />

                  {/* Marker Pin Node Indicator */}
                  <div
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 -mt-2 rounded-full border flex items-center justify-center transition-all ${
                      marker.isReached
                        ? 'bg-amber-400 border-amber-200 text-black shadow-[0_0_8px_#fbbf24]'
                        : marker.isNextTarget
                        ? 'bg-cyan-950 border-[#00f0ff] text-[#00f0ff] shadow-[0_0_10px_#00f0ff] scale-110'
                        : 'bg-black/90 border-gray-700 text-gray-600'
                    }`}
                    title={`Schwellenwert Stufe ${marker.thresholdLevel}: ${marker.bonusPercentString} Impact-Bonus (${
                      marker.isReached ? 'Erreicht ✓' : 'Ausstehend'
                    })`}
                  >
                    {marker.isReached ? (
                      <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
                    ) : (
                      <span className="text-[7.5px] font-mono font-bold leading-none">
                        {marker.thresholdLevel}
                      </span>
                    )}
                  </div>

                  {/* Threshold Callout Label Below Pin */}
                  <div className="mt-1 flex flex-col items-center whitespace-nowrap">
                    <span
                      className={`text-[8px] sm:text-[9px] font-mono font-bold leading-none ${
                        marker.isReached
                          ? 'text-amber-300'
                          : marker.isNextTarget
                          ? 'text-[#00f0ff]'
                          : 'text-gray-500'
                      }`}
                    >
                      Lv.{marker.thresholdLevel}
                    </span>
                    <span
                      className={`text-[7px] sm:text-[8px] font-mono leading-none mt-0.5 px-0.5 rounded ${
                        marker.isReached
                          ? 'text-amber-200 bg-amber-950/40 border border-amber-400/30'
                          : marker.isNextTarget
                          ? 'text-[#00f0ff] bg-cyan-950/60 border border-[#00f0ff]/40'
                          : 'text-gray-600'
                      }`}
                    >
                      {marker.bonusPercentString}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sub-Cycle Micro-Bar (Levels within the current 10-level threshold bracket) */}
        <div className="p-2 rounded-lg bg-black/60 border border-gray-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-[10px] font-mono">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Zyklus-Schritt (0–10):</span>
            <div className="w-24 sm:w-32 h-2 bg-gray-900 rounded-full border border-gray-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-600 to-[#00f0ff] rounded-full transition-all duration-200"
                style={{ width: `${cycleProgressPercent}%` }}
              />
            </div>
            <span className="text-white font-bold">{level % 10} / 10 Stufen</span>
          </div>

          <div className="flex items-center gap-2 justify-between sm:justify-end">
            <span className="text-gray-400">Nächster Schwellen-Sprung:</span>
            <span className="text-[#00f0ff] font-bold">
              +{nextImpactBonusString} (+0.1% Bonus)
            </span>
            <button
              onClick={onToggleExpand}
              className="text-gray-400 hover:text-white transition-colors ml-1 p-0.5 cursor-pointer"
              title="Details einblenden"
            >
              <ChevronRight
                className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Expanded Details Section */}
        {isExpanded && (
          <div className="p-3 rounded-xl bg-black/80 border border-cyan-900/40 space-y-2 text-xs animate-in fade-in duration-150">
            <div className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold text-white text-xs">Spezifischer Bonus-Nutzen:</h5>
                <p className="text-gray-300 text-[11px] font-sans mt-0.5 leading-relaxed">
                  {item.impactNote}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-800 text-[10px] font-mono">
              <div className="p-1.5 rounded bg-black/60 border border-gray-800">
                <span className="text-gray-400 block">Stufe (Uncapped):</span>
                <span className="text-white font-bold text-xs">{level} / ∞</span>
              </div>

              <div className="p-1.5 rounded bg-black/60 border border-gray-800">
                <span className="text-gray-400 block">Aktiver Bonus:</span>
                <span className="text-[#00f0ff] font-bold text-xs">{impactBonusString}</span>
              </div>

              <div className="p-1.5 rounded bg-black/60 border border-gray-800">
                <span className="text-gray-400 block">Schwellen erreicht:</span>
                <span className="text-amber-300 font-bold text-xs">
                  {completedThresholds} von {totalThresholdPoints}
                </span>
              </div>

              <div className="p-1.5 rounded bg-black/60 border border-gray-800">
                <span className="text-gray-400 block">Nächste Schwelle:</span>
                <span className="text-emerald-400 font-bold text-xs">
                  Stufe {nextThresholdLevel} (+{nextImpactBonusString})
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Helper Components & Functions
// ============================================================================

interface CategoryFilterButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon: React.ReactNode;
  color?: 'cyan' | 'amber' | 'emerald' | 'purple';
}

const CategoryFilterButton: React.FC<CategoryFilterButtonProps> = ({
  active,
  onClick,
  label,
  count,
  icon,
  color = 'cyan',
}) => {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
        active
          ? 'bg-gradient-to-r from-[#00f0ff]/20 to-transparent border border-[#00f0ff] text-white shadow-[0_0_12px_rgba(0,240,255,0.2)]'
          : 'bg-black/50 border border-gray-800 text-gray-400 hover:text-gray-200'
      }`}
    >
      <span className={active ? 'text-[#00f0ff]' : 'text-gray-400'}>{icon}</span>
      <span>{label}</span>
      <span className="px-1.5 py-0.2 rounded-full bg-black/80 border border-gray-800 text-[10px] font-mono text-gray-300">
        {count}
      </span>
    </button>
  );
};

function getCategoryLabel(category: MasteryItem['category']): string {
  switch (category) {
    case 'profession_crafting':
      return 'Handwerk (Crafting)';
    case 'profession_gathering':
      return 'Sammeln (Gathering)';
    case 'weapon':
      return 'Waffe (Combat)';
    case 'magic':
      return 'Zauberschule';
    case 'armor':
      return 'Rüstung';
    default:
      return 'Fertigkeit';
  }
}

function getWeaponGermanName(type: WeaponType, fallback: string): string {
  const map: Record<string, string> = {
    blade: 'Schwert- & Klingenkunst',
    greatsword: 'Zweihänder & Großschwert',
    daggers: 'Dolche & Schattenklingen',
    warhammer: 'Kriegshammer & Streitkolben',
    bow: 'Bogen & Armbrust',
    heavy_tech: 'Tech-Gewehr & Maschinerie',
    staff: 'Aether-Stab & Fokus',
    battleaxe: 'Streitaxt & Barbarenklinge',
    scythe: 'Kriegssense & Seelenschnitter',
    spear: 'Lanze & Stangenwaffe',
    knuckles: 'Schlagringe & Faustkampf',
    arcane: 'Aurion-Aether-Kanalisierung',
  };
  return map[type] || fallback;
}
