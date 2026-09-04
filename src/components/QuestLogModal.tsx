import React, { useState } from 'react';
import { X, Award, CheckCircle2, Clock, Gift, Shield } from 'lucide-react';
import { Quest } from '../types';

interface QuestLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  quests: Quest[];
}

export const QuestLogModal: React.FC<QuestLogModalProps> = ({ isOpen, onClose, quests }) => {
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(quests[0] || null);

  if (!isOpen) return null;

  return (
    <div id="questlog-modal-overlay" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div
        id="questlog-dialog"
        className="w-full max-w-4xl bg-[#11141a] border border-[#b8860b]/40 rounded-2xl p-5 sm:p-6 text-gray-200 shadow-[0_0_40px_rgba(184,134,11,0.15)] flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-black/80 border-2 border-[#b8860b] flex items-center justify-center text-[#b8860b]">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                AETHELGARD QUEST CHRONICLES
              </h3>
              <p className="text-xs text-gray-400 font-sans">
                Track your active campaign objectives, bounties, and campaign lore
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

        {/* 2-Column Split: Quest List & Quest Narrative Details */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-5 py-4 min-h-0 overflow-y-auto">
          {/* Quest List (5 cols) */}
          <div className="md:col-span-5 space-y-2">
            {quests.map((q) => {
              const isSelected = selectedQuest?.id === q.id;

              return (
                <button
                  key={q.id}
                  onClick={() => setSelectedQuest(q)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-black/90 border-[#fbbf24] shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                      : 'bg-black/40 border-gray-800/80 hover:border-gray-700'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-xs text-white truncate">{q.title}</span>
                      {q.completed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 font-sans truncate mt-0.5">{q.objective}</div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#fbbf24] whitespace-nowrap">
                    {q.currentCount} / {q.targetCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quest Details (7 cols) */}
          <div className="md:col-span-7 bg-black/60 rounded-xl border border-gray-800/90 p-4.5 flex flex-col justify-between overflow-y-auto">
            {selectedQuest ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-serif font-bold text-white">{selectedQuest.title}</h4>
                  {selectedQuest.completed ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 text-xs font-mono font-bold">
                      Completed
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/50 text-amber-400 text-xs font-mono font-bold">
                      In Progress ({selectedQuest.currentCount} / {selectedQuest.targetCount})
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase text-gray-400 tracking-wider">Objective</span>
                  <p className="text-sm font-sans text-amber-200/90 bg-black/40 p-3 rounded-lg border border-gray-800">
                    🎯 {selectedQuest.objective}
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase text-gray-400 tracking-wider">Lore & Background</span>
                  <p className="text-xs font-sans text-gray-300 italic leading-relaxed">
                    "{selectedQuest.description}"
                  </p>
                </div>

                {/* Rewards Panel */}
                <div className="space-y-2 pt-2 border-t border-gray-800">
                  <span className="text-[10px] font-mono uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5 text-[#b8860b]" /> Quest Rewards
                  </span>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-black/70 border border-gray-800 text-[#fbbf24] font-bold">
                      🪙 {selectedQuest.rewardGold} Gold
                    </div>
                    <div className="p-2.5 rounded-lg bg-black/70 border border-gray-800 text-emerald-400 font-bold">
                      ✨ +{selectedQuest.rewardXp} Experience Points
                    </div>
                  </div>

                  {selectedQuest.rewardItem && (
                    <div className="p-2.5 rounded-lg bg-purple-950/40 border border-purple-500/40 text-purple-300 text-xs font-mono flex items-center gap-2">
                      <span className="text-base">{selectedQuest.rewardItem.icon}</span>
                      <span>{selectedQuest.rewardItem.name} ({selectedQuest.rewardItem.rarity.toUpperCase()})</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 text-xs font-serif">
                Select a quest to view details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
