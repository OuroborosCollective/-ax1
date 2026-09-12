import React from 'react';
import { Sparkles, TrendingUp, Award, CheckCircle2, ChevronRight, Zap } from 'lucide-react';
import { getSkillMilestoneStats } from '../data/classlessProgression';

export type ProgressionTheme = 'cyan' | 'amber' | 'emerald' | 'purple' | 'blue';

interface LearningProgressionDisplayProps {
  name: string;
  germanName?: string;
  categoryName?: string;
  icon: string;
  level: number;
  currentXp: number;
  maxXp: number;
  theme?: ProgressionTheme;
  bonusTypeLabel?: string; // e.g. "Schadens- & Wucht-Multiplikator", "Doppel-Craft-Chance", "Ertrags-Ausbeute", "Schadensabsorption"
  bonusCustomNote?: string;
  learningByDoingDesc: string;
  compact?: boolean;
  onInspectTier?: (tier: number) => void;
}

const THEME_STYLES: Record<
  ProgressionTheme,
  {
    primary: string;
    border: string;
    borderActive: string;
    bgGlow: string;
    text: string;
    barGradient: string;
    nodeActiveBg: string;
  }
> = {
  cyan: {
    primary: '#00f0ff',
    border: 'border-[#00f0ff]/30',
    borderActive: 'border-[#00f0ff]',
    bgGlow: 'from-cyan-950/40 via-black/80 to-black/60',
    text: 'text-[#00f0ff]',
    barGradient: 'from-cyan-500 to-[#00f0ff]',
    nodeActiveBg: 'bg-[#00f0ff] text-black shadow-[0_0_8px_#00f0ff]',
  },
  amber: {
    primary: '#fbbf24',
    border: 'border-amber-500/30',
    borderActive: 'border-amber-400',
    bgGlow: 'from-amber-950/40 via-black/80 to-black/60',
    text: 'text-amber-400',
    barGradient: 'from-amber-600 to-amber-400',
    nodeActiveBg: 'bg-amber-400 text-black shadow-[0_0_8px_#fbbf24]',
  },
  emerald: {
    primary: '#10b981',
    border: 'border-emerald-500/30',
    borderActive: 'border-emerald-400',
    bgGlow: 'from-emerald-950/40 via-black/80 to-black/60',
    text: 'text-emerald-400',
    barGradient: 'from-emerald-600 to-emerald-400',
    nodeActiveBg: 'bg-emerald-400 text-black shadow-[0_0_8px_#10b981]',
  },
  purple: {
    primary: '#c084fc',
    border: 'border-purple-500/30',
    borderActive: 'border-purple-400',
    bgGlow: 'from-purple-950/40 via-black/80 to-black/60',
    text: 'text-purple-300',
    barGradient: 'from-purple-600 to-purple-400',
    nodeActiveBg: 'bg-purple-400 text-black shadow-[0_0_8px_#c084fc]',
  },
  blue: {
    primary: '#38bdf8',
    border: 'border-sky-500/30',
    borderActive: 'border-sky-400',
    bgGlow: 'from-sky-950/40 via-black/80 to-black/60',
    text: 'text-sky-300',
    barGradient: 'from-sky-600 to-sky-400',
    nodeActiveBg: 'bg-sky-400 text-black shadow-[0_0_8px_#38bdf8]',
  },
};

export const LearningProgressionDisplay: React.FC<LearningProgressionDisplayProps> = ({
  name,
  germanName,
  categoryName,
  icon,
  level,
  currentXp,
  maxXp,
  theme = 'cyan',
  bonusTypeLabel = 'Schadens- & Wucht-Multiplikator',
  bonusCustomNote,
  learningByDoingDesc,
  compact = false,
  onInspectTier,
}) => {
  const safeLevel = Math.max(1, Math.min(100, level || 1));
  const milestone = getSkillMilestoneStats(safeLevel);
  const currentTier = Math.floor(safeLevel / 10);
  const xpPercent = Math.min(100, Math.max(0, Math.floor((currentXp / Math.max(1, maxXp)) * 100)));

  const st = THEME_STYLES[theme];

  // 10 threshold nodes: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
  const thresholds = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  return (
    <div
      className={`rounded-xl border ${st.border} bg-gradient-to-br ${st.bgGlow} p-3 sm:p-4 text-gray-200 transition-all shadow-md`}
    >
      {/* Header Info */}
      <div className="flex items-start justify-between gap-3 border-b border-gray-800/80 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-black/80 border ${st.borderActive} flex items-center justify-center text-2xl shrink-0 shadow-sm`}
          >
            <span>{icon}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm sm:text-base font-serif font-bold text-white truncate">
                {germanName || name}
              </h4>
              {categoryName && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/60 border border-gray-700 text-gray-400">
                  {categoryName}
                </span>
              )}
            </div>
            {germanName && name !== germanName && (
              <p className={`text-xs ${st.text} font-mono truncate`}>{name}</p>
            )}
            <p className="text-[11px] text-gray-400 font-sans line-clamp-1 mt-0.5">
              {learningByDoingDesc}
            </p>
          </div>
        </div>

        {/* Level & Tier Badge */}
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1.5 justify-end">
            <span className="text-[10px] font-mono uppercase text-gray-400">Stufe</span>
            <span className={`text-lg sm:text-xl font-mono font-bold ${st.text}`}>
              {safeLevel}
              <span className="text-xs text-gray-500 font-normal"> / 100</span>
            </span>
          </div>
          <div className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-black/80 border border-gray-700 text-gray-300 inline-flex items-center gap-1">
            <Award className="w-3 h-3 text-amber-400" />
            <span>Tier {currentTier} von 10</span>
          </div>
        </div>
      </div>

      {/* Main XP Progress Bar (0-100 Level) */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-xs font-mono text-gray-300">
          <span className="flex items-center gap-1">
            <span>Fortschritt zu Stufe {Math.min(100, safeLevel + 1)}</span>
            <span className="text-gray-500">({xpPercent}%)</span>
          </span>
          <span>
            {currentXp} / {maxXp} XP
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-black/90 overflow-hidden border border-gray-800 p-0.5">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${st.barGradient} transition-all duration-300`}
            style={{ width: `${xpPercent}%` }}
          />
        </div>
      </div>

      {/* 10-Level Threshold Step Track (10, 20, 30... 100) */}
      <div className="mt-3 pt-3 border-t border-gray-800/60">
        <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 mb-1.5">
          <span className="flex items-center gap-1 text-gray-300 font-semibold">
            <TrendingUp className={`w-3.5 h-3.5 ${st.text}`} />
            <span>10-Stufen-Meilensteine (0.1 / +10% pro Stufe):</span>
          </span>
          <span className={`${st.text} font-bold`}>
            {milestone.percentString} (+{(milestone.bonusRate).toFixed(1)}) Bonus-Impact
          </span>
        </div>

        {/* Visual Threshold Track */}
        <div className="relative py-1">
          {/* Background Track Line */}
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-gray-800 rounded-full" />
          {/* Active Track Line */}
          <div
            className={`absolute top-1/2 left-0 -translate-y-1/2 h-1 bg-gradient-to-r ${st.barGradient} rounded-full transition-all`}
            style={{ width: `${Math.min(100, (safeLevel / 100) * 100)}%` }}
          />

          {/* 10 Threshold Nodes */}
          <div className="relative flex items-center justify-between">
            {thresholds.map((tierLevel, idx) => {
              const isAchieved = safeLevel >= tierLevel;
              const isNext = !isAchieved && (idx === 0 || safeLevel >= thresholds[idx - 1]);
              const tierImpactBonus = `+${idx + 1}0% (+0.${idx + 1})`;

              return (
                <div
                  key={tierLevel}
                  onClick={() => onInspectTier && onInspectTier(idx + 1)}
                  className="flex flex-col items-center group cursor-pointer"
                  title={`Meilenstein Stufe ${tierLevel}: +0.${idx + 1} (+${(idx + 1) * 10}%) ${bonusTypeLabel}`}
                >
                  <div
                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-mono font-bold transition-all border ${
                      isAchieved
                        ? `${st.nodeActiveBg} border-white/80`
                        : isNext
                        ? 'bg-black/90 border-[#00f0ff] text-cyan-300 shadow-[0_0_6px_rgba(0,240,255,0.4)] animate-pulse'
                        : 'bg-black/80 border-gray-800 text-gray-600'
                    }`}
                  >
                    {isAchieved ? '✓' : tierLevel}
                  </div>
                  <span
                    className={`text-[8px] font-mono mt-0.5 hidden sm:block ${
                      isAchieved ? st.text : 'text-gray-600'
                    }`}
                  >
                    +{idx + 1}0%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Current Bonus Breakdown Callout Box */}
      <div className="mt-3 p-2.5 rounded-lg bg-black/60 border border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 font-sans">
            <span className="text-gray-400">Aktueller Bonus:</span>
            <span className={`font-mono font-bold ${st.text}`}>
              {milestone.percentString} (+{(milestone.bonusRate).toFixed(1)})
            </span>
            <span className="text-gray-300 font-semibold truncate">
              {bonusTypeLabel}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 font-mono">
            {bonusCustomNote || (
              <>
                10-Level-Threshold: Tier {currentTier} erreicht (+0.1 pro 10 Level).{' '}
                {milestone.levelsToNext > 0 ? (
                  <span className="text-amber-300">
                    Noch {milestone.levelsToNext} Level bis Stufe {milestone.nextMilestone} (+0.1 / +10% mehr)!
                  </span>
                ) : (
                  <span className="text-[#00f0ff] font-bold">Maximaler Meilenstein-Rang erreicht (Tier 10)!</span>
                )}
              </>
            )}
          </p>
        </div>

        {/* Learning by Doing Badge */}
        <div className="shrink-0 px-2 py-1 rounded bg-black/80 border border-gray-700 text-[10px] font-mono text-gray-300 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Learning-by-Doing</span>
        </div>
      </div>
    </div>
  );
};
