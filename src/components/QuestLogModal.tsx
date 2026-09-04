import React, { useState } from 'react';
import {
  X,
  Award,
  CheckCircle2,
  Clock,
  Gift,
  Shield,
  BookOpen,
  Scroll,
  Sparkles,
  ChevronRight,
  Flame,
  Sun,
  Wind,
  Compass,
} from 'lucide-react';
import { LoreChapter, LoreEntry, Quest } from '../types';
import { LORE_CHAPTERS, LORE_ENTRIES } from '../data/professionsData';

interface QuestLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  quests: Quest[];
}

export const QuestLogModal: React.FC<QuestLogModalProps> = ({ isOpen, onClose, quests }) => {
  const [activeTab, setActiveTab] = useState<'quests' | 'chronicle'>('quests');
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(quests[0] || null);
  const [selectedChapterId, setSelectedChapterId] = useState<string>('sonnen_spitze');
  const [selectedLoreEntry, setSelectedLoreEntry] = useState<LoreEntry | null>(LORE_ENTRIES[0] || null);
  const [questFilter, setQuestFilter] = useState<'all' | 'active' | 'completed'>('all');

  if (!isOpen) return null;

  // Filtered active quests
  const filteredQuests = quests.filter((q) => {
    if (questFilter === 'active') return !q.completed;
    if (questFilter === 'completed') return q.completed;
    return true;
  });

  // Selected chapter for lore chronicle
  const currentChapter = LORE_CHAPTERS.find((ch) => ch.id === selectedChapterId) || LORE_CHAPTERS[0];
  const chapterEntries = LORE_ENTRIES.filter((e) => e.chapterId === selectedChapterId);

  // Completed quests count
  const completedCount = quests.filter((q) => q.completed).length;

  return (
    <div id="questlog-modal-overlay" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div
        id="questlog-dialog"
        className="w-full max-w-5xl bg-[#081a2e] border-2 border-amber-500/50 rounded-2xl p-4 sm:p-5 text-gray-200 shadow-[0_0_50px_rgba(0,240,255,0.2)] flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
              <Scroll className="w-5 h-5 text-[#00f0ff]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-serif font-bold text-white flex items-center gap-2 tracking-wide">
                QUEST-BUCH & LORE-CHRONIKEN VON AURION
              </h3>
              <p className="text-[11px] text-gray-400 font-sans">
                Verfolge Kampagnen-Ziele, Kopfgelder und lies freigeschaltete Weltgeschichte
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switchers */}
            <div className="flex bg-black/50 p-1 rounded-xl border border-gray-800">
              <button
                onClick={() => setActiveTab('quests')}
                className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'quests'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Award className="w-3.5 h-3.5" /> Quests ({quests.length})
              </button>
              <button
                onClick={() => setActiveTab('chronicle')}
                className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'chronicle'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" /> Lore-Chronik ({LORE_CHAPTERS.length} Kapitel)
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-black/50 border border-gray-800 hover:border-amber-500 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TAB 1: QUEST LOG */}
        {activeTab === 'quests' && (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 py-3 min-h-0 overflow-y-auto custom-scrollbar">
            {/* Left: Quest List with Filters (5 cols) */}
            <div className="md:col-span-5 flex flex-col space-y-2 bg-black/40 p-3 rounded-2xl border border-gray-800">
              <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                <span className="text-[11px] font-serif font-bold text-amber-300 uppercase tracking-widest">
                  Aktive Aufträge
                </span>

                <div className="flex gap-1 text-[10px] font-mono">
                  {(['all', 'active', 'completed'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setQuestFilter(f)}
                      className={`px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                        questFilter === f
                          ? 'bg-[#00f0ff]/20 border-[#00f0ff] text-[#00f0ff]'
                          : 'bg-black/50 border-gray-800 text-gray-400'
                      }`}
                    >
                      {f === 'all' ? 'Alle' : f === 'active' ? 'Offen' : 'Erledigt'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredQuests.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-500">
                    Keine Quests in dieser Ansicht vorhanden.
                  </div>
                ) : (
                  filteredQuests.map((q) => {
                    const isSelected = selectedQuest?.id === q.id;
                    return (
                      <button
                        key={q.id}
                        onClick={() => setSelectedQuest(q)}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-[#081a2e] border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                            : 'bg-black/50 border-gray-800/80 hover:border-gray-700'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-xs text-white truncate">{q.title}</span>
                            {q.completed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400 font-sans truncate mt-0.5">
                            {q.objective}
                          </div>
                          <div className="text-[10px] font-mono text-[#00f0ff] mt-1">
                            Geber: {q.giverName} ({q.giverZone})
                          </div>
                        </div>

                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-black/60 text-amber-300 border border-gray-800 shrink-0">
                          {q.currentCount} / {q.targetCount}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Quest Narrative & Rewards Details (7 cols) */}
            <div className="md:col-span-7 bg-black/60 rounded-2xl border border-gray-800 p-4.5 flex flex-col justify-between overflow-y-auto custom-scrollbar">
              {selectedQuest ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2 border-b border-gray-800 pb-3">
                    <div>
                      <h4 className="text-base font-serif font-bold text-amber-200 leading-tight">
                        {selectedQuest.title}
                      </h4>
                      <span className="text-[11px] font-mono text-gray-400">
                        Auftraggeber: {selectedQuest.giverName} • {selectedQuest.giverZone}
                      </span>
                    </div>

                    {selectedQuest.completed ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Abgeschlossen
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-500/50 text-amber-300 text-xs font-mono font-bold shrink-0">
                        Fortschritt: {selectedQuest.currentCount} / {selectedQuest.targetCount}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-[#00f0ff] tracking-wider">
                      Aktuelles Missionsziel
                    </span>
                    <p className="text-xs font-sans text-amber-100 bg-black/50 p-3 rounded-xl border border-gray-800 leading-relaxed">
                      🎯 {selectedQuest.objective}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-gray-400 tracking-wider">
                      Hintergrund & Überlieferung
                    </span>
                    <p className="text-xs font-sans text-gray-300 italic leading-relaxed bg-black/30 p-3 rounded-xl border border-gray-800/80">
                      "{selectedQuest.description || selectedQuest.lore}"
                    </p>
                  </div>

                  {/* Rewards Panel */}
                  <div className="space-y-2 pt-2 border-t border-gray-800">
                    <span className="text-[10px] font-mono uppercase text-amber-300 tracking-wider flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-amber-400" /> Auslobung & Belohnungen
                    </span>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2.5 rounded-xl bg-black/70 border border-gray-800 text-amber-300 font-bold flex items-center gap-2">
                        <span>🪙</span> {selectedQuest.rewardGold} Gold
                      </div>
                      <div className="p-2.5 rounded-xl bg-black/70 border border-gray-800 text-emerald-400 font-bold flex items-center gap-2">
                        <span>✨</span> +{selectedQuest.rewardXp} Charakter-XP
                      </div>
                    </div>

                    {selectedQuest.rewardItem && (
                      <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/40 text-purple-300 text-xs font-mono flex items-center gap-2">
                        <span className="text-xl">{selectedQuest.rewardItem.icon}</span>
                        <div>
                          <div className="font-serif font-bold text-gray-100">{selectedQuest.rewardItem.name}</div>
                          <div className="text-[10px] text-purple-400">Seltenheit: {selectedQuest.rewardItem.rarity.toUpperCase()}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-gray-500 text-xs font-serif">
                  Wähle eine Quest aus der linken Liste, um Details und Belohnungen einzusehen.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: LORE CHRONICLE & STORYLINE ARCHIVES */}
        {activeTab === 'chronicle' && (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 py-3 min-h-0 overflow-y-auto custom-scrollbar">
            {/* Left: Lore Chapters Selection (4 cols) */}
            <div className="md:col-span-4 space-y-2 bg-black/40 p-3 rounded-2xl border border-gray-800 flex flex-col">
              <div className="text-[11px] font-serif font-bold text-amber-300 uppercase tracking-widest pb-2 border-b border-gray-800">
                Hauptlore-Epochen ({LORE_CHAPTERS.length} Kapitel)
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {LORE_CHAPTERS.map((ch) => {
                  const isSelected = selectedChapterId === ch.id;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => {
                        setSelectedChapterId(ch.id);
                        const first = LORE_ENTRIES.find((e) => e.chapterId === ch.id);
                        if (first) setSelectedLoreEntry(first);
                      }}
                      className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                        isSelected
                          ? 'bg-[#081a2e] border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : 'bg-black/50 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <span className="text-2xl shrink-0">{ch.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-serif font-bold text-xs text-white truncate">
                          {ch.germanTitle}
                        </div>
                        <div className="text-[10px] font-mono text-gray-400 truncate mt-0.5">
                          {ch.era}
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          {ch.unlocked ? (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                              Freigeschaltet
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-red-950/80 text-red-300 border border-red-500/40">
                              Gesperrt
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Chapter Detail & Codex Inscriptions (8 cols) */}
            <div className="md:col-span-8 bg-black/60 rounded-2xl border border-gray-800 p-4.5 flex flex-col space-y-4 overflow-y-auto custom-scrollbar">
              {/* Chapter Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-black to-[#081a2e] border border-amber-500/40 flex items-start gap-3">
                <span className="text-3xl">{currentChapter.icon}</span>
                <div>
                  <h4 className="font-serif font-bold text-base text-amber-200">
                    {currentChapter.germanTitle}
                  </h4>
                  <p className="text-[11px] font-mono text-[#00f0ff]">{currentChapter.era}</p>
                  <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                    {currentChapter.description}
                  </p>
                </div>
              </div>

              {/* Inscriptions / Codex List */}
              <div className="space-y-3">
                <div className="text-xs font-serif font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#00f0ff]" /> Überlieferungen & Chroniken dieses Kapitels:
                </div>

                {chapterEntries.length === 0 ? (
                  <div className="p-6 rounded-xl bg-black/40 border border-gray-800 text-center text-xs text-gray-500">
                    Für dieses Kapitel wurden noch keine Schriftrollen geborgen.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {chapterEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-4 rounded-xl bg-black/50 border border-gray-800 space-y-2 shadow-inner"
                      >
                        <div className="flex items-center justify-between border-b border-gray-800/80 pb-1.5">
                          <h5 className="font-serif font-bold text-sm text-amber-100 flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-[#00f0ff]" />
                            {entry.title}
                          </h5>
                          <span className="text-[10px] font-mono text-gray-400">Verfasser: {entry.author}</span>
                        </div>

                        <p className="text-xs text-amber-200/80 italic">"{entry.excerpt}"</p>

                        <p className="text-xs text-gray-300 font-sans leading-relaxed pt-1">
                          {entry.fullText}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lore Historical Accomplishments */}
              <div className="p-3 rounded-xl bg-black/40 border border-gray-800 text-[11px] font-mono text-gray-400 flex items-center justify-between">
                <span>Erledigte Kampagnen-Quests: <strong className="text-emerald-300">{completedCount}</strong></span>
                <span className="text-amber-300">Aurion-Bibliotheks-Zugang: Stufe I</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
