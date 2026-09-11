import React, { useState, useEffect } from 'react';
import { X, MessageSquare, ShoppingBag, Award, Check, Sparkles, RefreshCw, Compass, Shield, Target, Scroll, CheckCircle2, Send, Zap, BookOpen } from 'lucide-react';
import { NPCCharacter, Quest, RPGItem } from '../types';
import { GenkitAdapter } from '../adapters/GenkitAdapter';
import { arelorianLingua, NPCDialogueOutput, PlayerUtteranceAnalysis } from '../engine/lingua/ArelorianLinguaGrammar';

interface NPCDialogueModalProps {
  isOpen: boolean;
  onClose: () => void;
  npc: NPCCharacter | null;
  activeQuests: Quest[];
  playerGold: number;
  playerLevel?: number;
  genkitAdapter?: GenkitAdapter | null;
  onAcceptQuest: (quest: Quest) => void;
  onBuyItem: (item: RPGItem) => void;
  onTriggerEvent?: (eventType: 'attack' | 'trade' | 'crime' | 'chat', data?: any) => void;
}

export const NPCDialogueModal: React.FC<NPCDialogueModalProps> = ({
  isOpen,
  onClose,
  npc,
  activeQuests,
  playerGold,
  playerLevel = 1,
  genkitAdapter,
  onAcceptQuest,
  onBuyItem,
  onTriggerEvent,
}) => {
  const [activeTab, setActiveTab] = useState<'dialogue' | 'quests' | 'questboard' | 'shop'>('dialogue');
  const [bounties, setBounties] = useState<Quest[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [filter, setFilter] = useState<'all' | 'available' | 'tracked' | 'completed'>('all');
  const [dynamicLore, setDynamicLore] = useState<string | null>(null);
  const [liveSpeechInput, setLiveSpeechInput] = useState('');
  const [liveConversation, setLiveConversation] = useState<Array<{ sender: 'player' | 'npc'; text: string; runic?: string; posture?: string }>>([]);
  const [currentNpcPosture, setCurrentNpcPosture] = useState<'DEFENSIVE' | 'FRIENDLY' | 'SUSPICIOUS' | 'NEUTRAL' | 'ALERT_GUARDS'>('NEUTRAL');
  const [priceModifier, setPriceModifier] = useState<number>(0);

  // Sync bounties from GenkitAdapter
  useEffect(() => {
    if (genkitAdapter) {
      setBounties([...genkitAdapter.availableBounties]);
      genkitAdapter.setCallbacks(
        (pool) => setBounties([...pool]),
        (lore) => setDynamicLore(lore)
      );
    }
  }, [genkitAdapter, isOpen]);

  if (!isOpen || !npc) return null;

  const handleGenerateFreshBounties = () => {
    if (!genkitAdapter) return;
    setIsGenerating(true);
    setTimeout(() => {
      const newPool = genkitAdapter.generateTaskPool(npc.zone, playerLevel, 4);
      setBounties([...newPool]);
      genkitAdapter.generateEmergentLore(npc.name, npc.zone);
      setIsGenerating(false);
    }, 450);
  };

  const handleAcceptBounty = (bounty: Quest) => {
    if (genkitAdapter) {
      genkitAdapter.acceptBounty(bounty.id);
    }
    onAcceptQuest(bounty);
  };

  // Filtered bounties
  const filteredBounties = bounties.filter((b) => {
    const isAccepted = activeQuests.some((q) => q.id === b.id);
    const activeQ = activeQuests.find((q) => q.id === b.id);
    const isCompleted = activeQ?.completed || b.completed;

    if (filter === 'available') return !isAccepted;
    if (filter === 'tracked') return isAccepted && !isCompleted;
    if (filter === 'completed') return isCompleted;
    return true;
  });

  return (
    <div id="npc-modal-overlay" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div
        id="npc-dialog"
        className="w-full max-w-3xl bg-[#11141a] border border-[#b8860b]/40 rounded-2xl p-5 sm:p-6 text-gray-200 shadow-[0_0_40px_rgba(184,134,11,0.15)] flex flex-col max-h-[88vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl shadow-[0_0_12px_rgba(184,134,11,0.25)]"
              style={{ borderColor: npc.color, backgroundColor: `${npc.color}20` }}
            >
              💬
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                {npc.name}
              </h3>
              <p className="text-xs text-[#b8860b] font-mono italic">
                {npc.title} · {npc.zone}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="px-3 py-1 rounded-lg bg-black/70 border border-[#b8860b]/40 text-[#fbbf24] font-mono text-xs font-bold">
              🪙 {playerGold.toLocaleString()} Gold
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-black/50 border border-gray-800 hover:border-[#b8860b] text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-gray-800/80 pt-3 pb-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('dialogue')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-serif font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'dialogue'
                ? 'bg-[#b8860b] text-black shadow-[0_0_10px_rgba(184,134,11,0.3)]'
                : 'bg-black/40 text-gray-400 hover:text-white border border-gray-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Conversation</span>
          </button>

          {npc.quests.length > 0 && (
            <button
              onClick={() => setActiveTab('quests')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-serif font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'quests'
                  ? 'bg-[#b8860b] text-black shadow-[0_0_10px_rgba(184,134,11,0.3)]'
                  : 'bg-black/40 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>NPC Quests ({npc.quests.length})</span>
            </button>
          )}

          {/* Dedicated Quest Board System (Genkit Adapter Driven) */}
          <button
            onClick={() => setActiveTab('questboard')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-serif font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap relative ${
              activeTab === 'questboard'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                : 'bg-black/50 text-amber-300 hover:text-amber-200 border border-amber-500/30'
            }`}
          >
            <Scroll className="w-3.5 h-3.5" />
            <span>Quest Board (Genkit AI)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-amber-950/80 border border-amber-500/60 text-[9px] font-mono text-amber-300 font-bold ml-0.5">
              {bounties.length}
            </span>
          </button>

          {npc.shopItems && npc.shopItems.length > 0 && (
            <button
              onClick={() => setActiveTab('shop')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-serif font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'shop'
                  ? 'bg-[#b8860b] text-black shadow-[0_0_10px_rgba(184,134,11,0.3)]'
                  : 'bg-black/40 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Merchant Shop</span>
            </button>
          )}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 py-4 overflow-y-auto min-h-0 space-y-4">
          {/* DIALOGUE TAB */}
          {activeTab === 'dialogue' && (
            <div className="space-y-3">
              <div className="bg-black/60 rounded-xl border border-gray-800 p-4 space-y-2.5 font-sans text-sm text-gray-300 leading-relaxed">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                  <span className="text-xs font-mono text-gray-400">Canonical Greeting:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      currentNpcPosture === 'DEFENSIVE' || currentNpcPosture === 'ALERT_GUARDS'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : currentNpcPosture === 'FRIENDLY'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : currentNpcPosture === 'SUSPICIOUS'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-stone-800 text-stone-300'
                    }`}
                  >
                    Posture: {currentNpcPosture} {priceModifier !== 0 && `(Price: ${priceModifier > 0 ? '+' : ''}${priceModifier}%)`}
                  </span>
                </div>

                {npc.dialogue.map((line, idx) => (
                  <p key={idx} className="border-l-2 border-[#b8860b] pl-3 py-0.5">
                    "{line}"
                  </p>
                ))}

                {dynamicLore && (
                  <div className="mt-2 p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-amber-200/90 text-xs italic">
                    ✨ Genkit Lore Dispatch: {dynamicLore}
                  </div>
                )}
              </div>

              {/* NPC Relationship Memory & Reaction Logic Panel */}
              <div className="bg-stone-950/90 rounded-xl border border-stone-800 p-3.5 space-y-3 shadow-inner">
                <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-200">Gedächtnis & Reaktionslogik</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-stone-800 text-stone-300 border border-stone-700">
                      Deterministisches Beziehungsnetz
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-stone-400">Stimmung:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        npc.mood === 'hostile'
                          ? 'bg-red-950 text-red-400 border border-red-500/60'
                          : npc.mood === 'suspicious'
                          ? 'bg-amber-950 text-amber-300 border border-amber-500/60'
                          : npc.mood === 'friendly'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/60'
                          : npc.mood === 'ecstatic'
                          ? 'bg-purple-950 text-purple-300 border border-purple-500/60'
                          : 'bg-stone-800 text-stone-300'
                      }`}
                    >
                      {npc.mood || 'neutral'}
                    </span>
                  </div>
                </div>

                {/* Reputation & Affection Bar Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Reputation Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono text-stone-400">
                      <span>Beziehungs-Ruf (Reputation)</span>
                      <span
                        className={`font-bold ${
                          (npc.memory?.reputation ?? 0) < 0
                            ? 'text-red-400'
                            : (npc.memory?.reputation ?? 0) > 30
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {npc.memory?.reputation ?? 0} / 100
                      </span>
                    </div>
                    <div className="w-full h-2 rounded bg-stone-900 border border-stone-800 overflow-hidden relative">
                      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-stone-600 z-10" />
                      <div
                        className={`h-full transition-all duration-300 ${
                          (npc.memory?.reputation ?? 0) < 0
                            ? 'bg-red-500'
                            : (npc.memory?.reputation ?? 0) >= 70
                            ? 'bg-purple-400'
                            : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.max(5, Math.min(100, ((npc.memory?.reputation ?? 0) + 100) / 2))}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Affection Rating Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono text-stone-400">
                      <span>Emotionales Zuneigungsverhältnis (Affection)</span>
                      <span
                        className={`font-bold ${
                          (npc.affectionRating ?? npc.memory?.affectionRating ?? 0) < 0
                            ? 'text-red-400'
                            : (npc.affectionRating ?? npc.memory?.affectionRating ?? 0) > 30
                            ? 'text-cyan-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {npc.affectionRating ?? npc.memory?.affectionRating ?? 0} / 100
                      </span>
                    </div>
                    <div className="w-full h-2 rounded bg-stone-900 border border-stone-800 overflow-hidden relative">
                      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-stone-600 z-10" />
                      <div
                        className={`h-full transition-all duration-300 ${
                          (npc.affectionRating ?? npc.memory?.affectionRating ?? 0) < 0
                            ? 'bg-rose-600'
                            : (npc.affectionRating ?? npc.memory?.affectionRating ?? 0) >= 50
                            ? 'bg-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.6)]'
                            : 'bg-teal-500'
                        }`}
                        style={{
                          width: `${Math.max(5, Math.min(100, (((npc.affectionRating ?? npc.memory?.affectionRating ?? 0) + 100) / 2)))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Posture & Price Modifier Badges */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-stone-800/80">
                  <span className="text-[10px] font-mono text-stone-400">Verhalten:</span>
                  <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 font-mono text-[10px] font-bold">
                    🛡️ Haltung: {npc.defensivePosture || npc.memory?.defensivePosture || 'GUARDED'}
                  </span>
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                    (npc.activeDiscountPercent ?? npc.memory?.activeDiscountPercent ?? 0) < 0
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/60'
                      : (npc.activeDiscountPercent ?? npc.memory?.activeDiscountPercent ?? 0) > 0
                      ? 'bg-red-950 text-red-300 border border-red-500/60'
                      : 'bg-stone-900 text-stone-300 border border-stone-700'
                  }`}>
                    🏷️ Preis-Anpassung: {(npc.activeDiscountPercent ?? npc.memory?.activeDiscountPercent ?? 0) < 0 
                      ? `Rabatt ${npc.activeDiscountPercent ?? npc.memory?.activeDiscountPercent}%`
                      : (npc.activeDiscountPercent ?? npc.memory?.activeDiscountPercent ?? 0) > 0
                      ? `Aufschlag +${npc.activeDiscountPercent ?? npc.memory?.activeDiscountPercent}%`
                      : 'Standardpreis (0%)'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-700 text-stone-300 font-mono text-[10px]">
                    🔥 Emotion: {npc.emotionalContext?.dominantTone || npc.memory?.emotionalContext?.dominantTone || 'neutral'}
                  </span>
                </div>

                {/* Memory Statistics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded-lg bg-stone-900/80 border border-stone-800 flex flex-col">
                    <span className="text-stone-500 text-[10px]">Handelsabschlüsse</span>
                    <span className="text-emerald-300 font-bold">{npc.memory?.tradesCompleted ?? 0}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-stone-900/80 border border-stone-800 flex flex-col">
                    <span className="text-stone-500 text-[10px]">Erlittene Angriffe</span>
                    <span className="text-red-400 font-bold">{npc.memory?.attacksSuffered ?? 0}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-stone-900/80 border border-stone-800 flex flex-col">
                    <span className="text-stone-500 text-[10px]">Interaktions-Frequenz</span>
                    <span className="text-cyan-300 font-bold">{npc.interactionFrequency?.velocityCategory || npc.memory?.interactionFrequency?.velocityCategory || 'first_contact'}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-stone-900/80 border border-stone-800 flex flex-col">
                    <span className="text-stone-500 text-[10px]">Gold Gehandelt</span>
                    <span className="text-[#fbbf24] font-bold">🪙 {npc.memory?.totalGoldTraded ?? 0}</span>
                  </div>
                </div>

                {/* Reaction Logic Archetype Traits */}
                {npc.reactionLogic && (
                  <div className="p-2.5 rounded-lg bg-stone-900/60 border border-stone-800 text-[11px] font-sans flex flex-wrap items-center gap-3 text-stone-300">
                    <span className="text-stone-400 font-mono text-[10px]">Reaktionslogik:</span>
                    <span className="px-2 py-0.5 rounded bg-black/50 border border-stone-700 font-mono text-[10px]">
                      Vergeltung: {npc.reactionLogic.retaliateOnAttack ? '⚔️ Aktiv' : '🛡️ Passiv'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-black/50 border border-stone-700 font-mono text-[10px]">
                      Handelsaffinität: {npc.reactionLogic.tradeAffinityMultiplier ?? 1.0}x
                    </span>
                    <span className="px-2 py-0.5 rounded bg-black/50 border border-stone-700 font-mono text-[10px]">
                      Verbrechenstoleranz: {npc.reactionLogic.crimeTolerance || 'standard'}
                    </span>
                  </div>
                )}

                {/* Dynamic Memory Dialogue Chronicle */}
                {npc.memory?.dynamicDialogueHistory && npc.memory.dynamicDialogueHistory.length > 0 && (
                  <div className="space-y-1 bg-stone-900/50 p-2.5 rounded-lg border border-stone-800">
                    <span className="text-[10px] font-mono text-amber-300/80">
                      Dynamischer Gedächtnis-Dialogverlauf:
                    </span>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {npc.memory.dynamicDialogueHistory.slice(0, 4).map((entry, idx) => (
                        <p key={idx} className="text-[11px] text-stone-300 font-sans italic pl-2 border-l border-amber-500/40">
                          {entry}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Event Simulation Controls */}
                {onTriggerEvent && (
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono text-stone-500 mr-1">Ereignis-Test:</span>
                    <button
                      onClick={() => onTriggerEvent('trade', { goldAmount: 50, itemName: 'Aurion Kristall' })}
                      className="px-2.5 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-mono text-[11px] cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <span>🤝 Handel (+50 Gold)</span>
                    </button>
                    <button
                      onClick={() => onTriggerEvent('attack', { damage: 45 })}
                      className="px-2.5 py-1 rounded bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-300 font-mono text-[11px] cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <span>⚔️ Angriff Provozieren</span>
                    </button>
                    <button
                      onClick={() => onTriggerEvent('crime')}
                      className="px-2.5 py-1 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-500/50 text-amber-300 font-mono text-[11px] cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <span>🚨 Verbrechen Zeuge</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Live Speech / Arelorian Lingua Conversation Feed */}
              <div className="bg-black/80 rounded-xl border border-stone-800 p-3 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-amber-200">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[#00f0ff]" />
                    Arelorian Lingua Semantic Dialogue
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">Deterministic Learning Engine</span>
                </div>

                {/* Conversation History */}
                {liveConversation.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-2 p-2 bg-stone-950/70 rounded-lg border border-stone-800/80">
                    {liveConversation.map((item, idx) => (
                      <div
                        key={idx}
                        className={`text-xs p-2 rounded-lg ${
                          item.sender === 'player'
                            ? 'bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-cyan-100 ml-4'
                            : 'bg-amber-950/30 border border-amber-500/30 text-amber-100 mr-4'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold opacity-80 mb-0.5">
                          <span>{item.sender === 'player' ? 'Du (Spieler)' : npc.name}</span>
                          {item.posture && <span className="font-mono text-[9px]">[{item.posture}]</span>}
                        </div>
                        <p>{item.text}</p>
                        {item.runic && (
                          <div className="mt-1 text-[10px] font-mono text-cyan-300/80 border-t border-cyan-500/20 pt-1">
                            {item.runic}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Speech Input Box */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!liveSpeechInput.trim()) return;
                    const text = liveSpeechInput.trim();
                    setLiveSpeechInput('');

                    // Evaluate with Lingua
                    const analysis = arelorianLingua.analyzeUtterance(text, 100);
                    
                    let role: 'guard' | 'merchant' | 'mystic' | 'citizen' = 'citizen';
                    const title = (npc.title || '').toLowerCase();
                    const name = (npc.name || '').toLowerCase();
                    if (title.includes('wache') || title.includes('guard') || title.includes('sentinel') || name.includes('wache')) {
                      role = 'guard';
                    } else if (title.includes('händler') || title.includes('merchant') || title.includes('schmied') || name.includes('händler')) {
                      role = 'merchant';
                    } else if (title.includes('mystik') || title.includes('magier') || title.includes('orakel')) {
                      role = 'mystic';
                    }

                    const reaction = arelorianLingua.generateNPCReaction(npc.name, role, analysis);
                    setCurrentNpcPosture(reaction.posture);
                    setPriceModifier(reaction.priceModifierPercent);

                    // If utterance indicates combat attack or commerce, trigger NPC event bridge
                    const lower = text.toLowerCase();
                    if (lower.includes('angriff') || lower.includes('attack') || lower.includes('schlag') || lower.includes('töten') || lower.includes('stirb')) {
                      onTriggerEvent?.('attack', { damage: 20 });
                    } else if (lower.includes('handel') || lower.includes('kauf') || lower.includes('gold') || lower.includes('waren')) {
                      onTriggerEvent?.('trade', { goldAmount: 25 });
                    }

                    setLiveConversation((prev) => [
                      ...prev,
                      { sender: 'player', text, runic: analysis.arelorianTranslation },
                      { sender: 'npc', text: reaction.dialogueText, runic: reaction.runicSubtext, posture: reaction.posture },
                    ]);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={liveSpeechInput}
                    onChange={(e) => setLiveSpeechInput(e.target.value)}
                    placeholder={`Sprich mit ${npc.name} (z.B. 'Handel', 'Danke', oder 'Angriff')...`}
                    className="flex-1 bg-stone-900/90 border border-stone-700 focus:border-[#00f0ff] rounded-lg px-3 py-1.5 text-xs text-white placeholder-stone-500 outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-[#00f0ff]/20 hover:bg-[#00f0ff]/30 text-cyan-200 border border-[#00f0ff]/50 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Send className="w-3 h-3" />
                    <span>Sprechen</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* NPC QUESTS TAB */}
          {activeTab === 'quests' && (
            <div className="space-y-3">
              {npc.quests.map((quest) => {
                const isAccepted = activeQuests.some((q) => q.id === quest.id);
                const activeQ = activeQuests.find((q) => q.id === quest.id);

                return (
                  <div
                    key={quest.id}
                    className="p-4 rounded-xl bg-black/60 border border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-bold text-sm text-white">{quest.title}</span>
                        {activeQ?.completed ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Completed!
                          </span>
                        ) : isAccepted ? (
                          <span className="px-2 py-0.5 rounded bg-blue-950/80 border border-blue-500/50 text-blue-400 text-[10px] font-mono font-bold">
                            In Progress ({activeQ?.currentCount} / {quest.targetCount})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/50 text-amber-400 text-[10px] font-mono font-bold">
                            Available
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 font-sans">{quest.objective}</p>
                      <div className="text-[11px] font-mono text-[#fbbf24] flex items-center gap-3 pt-1">
                        <span>Reward: 🪙 {quest.rewardGold} Gold</span>
                        <span>✨ +{quest.rewardXp} EXP</span>
                        {quest.rewardItem && <span className="text-purple-300">🎁 {quest.rewardItem.name}</span>}
                      </div>
                    </div>

                    {!isAccepted && (
                      <button
                        onClick={() => onAcceptQuest(quest)}
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#b8860b] to-[#8a6508] hover:from-[#d4af37] hover:to-[#b8860b] text-black font-serif font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex-shrink-0"
                      >
                        Accept Quest
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* QUEST BOARD TAB (Genkit AI Generated Task Matrix) */}
          {activeTab === 'questboard' && (
            <div className="space-y-4">
              {/* Quest Board Header Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#1c180a] to-[#121620] border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                    <h4 className="font-serif font-bold text-sm text-amber-200">
                      Sanctum Bounty Board · Genkit AI Task Matrix
                    </h4>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono">
                      Neural Feed Active
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-sans">
                    Real-time generated procedural missions for <span className="text-[#fbbf24] font-medium">{npc.zone}</span>. Accept multiple tasks to track simultaneous objectives.
                  </p>
                </div>

                <button
                  disabled={isGenerating}
                  onClick={handleGenerateFreshBounties}
                  className={`px-3.5 py-2 rounded-xl text-xs font-serif font-bold transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-md ${
                    isGenerating
                      ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                      : 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? 'Generating...' : '⚡ Generate New Bounties'}</span>
                </button>
              </div>

              {/* Filter Chips */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-mono mr-1">Filter:</span>
                {(['all', 'available', 'tracked', 'completed'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono capitalize transition-all cursor-pointer ${
                      filter === f
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 font-bold'
                        : 'bg-black/40 text-gray-400 hover:text-gray-200 border border-gray-800'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Task List */}
              <div className="space-y-3">
                {filteredBounties.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-black/40 border border-gray-800 text-gray-400 text-sm">
                    No bounties matching the selected filter. Click "Generate New Bounties" to pull fresh tasks!
                  </div>
                ) : (
                  filteredBounties.map((bounty) => {
                    const activeQ = activeQuests.find((q) => q.id === bounty.id);
                    const isAccepted = !!activeQ;
                    const isCompleted = activeQ?.completed || bounty.completed;
                    const currentCount = activeQ?.currentCount || bounty.currentCount || 0;
                    const progressPct = Math.min(100, Math.round((currentCount / bounty.targetCount) * 100));

                    const isBoss = bounty.type === 'kill_boss';
                    const isElite = bounty.title.toLowerCase().includes('elite');

                    return (
                      <div
                        key={bounty.id}
                        className={`p-4 rounded-xl bg-black/60 border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                          isCompleted
                            ? 'border-emerald-500/40 bg-emerald-950/10'
                            : isAccepted
                            ? 'border-blue-500/40 bg-blue-950/10'
                            : isBoss
                            ? 'border-purple-500/50 bg-purple-950/15'
                            : 'border-gray-800 hover:border-amber-500/40'
                        }`}
                      >
                        <div className="space-y-2 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-serif font-bold text-sm text-white">{bounty.title}</span>

                            {isBoss ? (
                              <span className="px-2 py-0.5 rounded bg-purple-950 border border-purple-500 text-purple-300 text-[10px] font-mono font-bold">
                                ☠️ WORLD BOSS
                              </span>
                            ) : isElite ? (
                              <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-500 text-amber-300 text-[10px] font-mono font-bold">
                                ⚔️ ELITE BOUNTY
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/60 text-cyan-300 text-[10px] font-mono">
                                🎯 STANDARD
                              </span>
                            )}

                            {isCompleted ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-500 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Objective Completed
                              </span>
                            ) : isAccepted ? (
                              <span className="px-2 py-0.5 rounded bg-blue-950/90 border border-blue-500 text-blue-400 text-[10px] font-mono font-bold">
                                Tracking ({currentCount} / {bounty.targetCount})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-gray-900 border border-gray-700 text-gray-300 text-[10px] font-mono">
                                Available on Board
                              </span>
                            )}
                          </div>

                          {/* Objective Description */}
                          <p className="text-xs text-gray-300 font-sans flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                            <span>{bounty.objective}</span>
                          </p>

                          {/* Lore chronicle */}
                          {bounty.lore && (
                            <p className="text-[11px] text-gray-400 italic bg-black/40 p-2 rounded-lg border border-gray-800/80">
                              "{bounty.lore}"
                            </p>
                          )}

                          {/* Progress Bar if accepted */}
                          {isAccepted && (
                            <div className="space-y-1 pt-1">
                              <div className="flex items-center justify-between text-[10px] font-mono text-gray-400">
                                <span>Simultaneous Objective Progress</span>
                                <span className="text-[#fbbf24] font-bold">
                                  {currentCount} / {bounty.targetCount} ({progressPct}%)
                                </span>
                              </div>
                              <div className="w-full h-2 rounded bg-black/80 border border-gray-800 overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    isCompleted
                                      ? 'bg-gradient-to-r from-emerald-600 to-teal-400'
                                      : 'bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-300'
                                  }`}
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Rewards */}
                          <div className="text-[11px] font-mono text-[#fbbf24] flex flex-wrap items-center gap-3 pt-1">
                            <span>🪙 {bounty.rewardGold} Gold</span>
                            <span>✨ +{bounty.rewardXp} EXP</span>
                            {bounty.rewardItem && (
                              <span className="text-purple-300 flex items-center gap-1">
                                🎁 {bounty.rewardItem.name}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex-shrink-0">
                          {isCompleted ? (
                            <div className="px-3.5 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-serif font-bold text-xs flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Claimed
                            </div>
                          ) : isAccepted ? (
                            <div className="px-3.5 py-1.5 rounded-lg bg-blue-950/80 border border-blue-500/50 text-blue-300 font-serif font-bold text-xs flex items-center gap-1.5">
                              <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
                              Tracking in HUD
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAcceptBounty(bounty)}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-serif font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_12px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95"
                            >
                              Track Objective
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

          {/* MERCHANT SHOP TAB */}
          {activeTab === 'shop' && npc.shopItems && (
            <div className="space-y-3">
              {(npc.activeDiscountPercent ?? npc.memory?.activeDiscountPercent ?? 0) !== 0 && (
                <div className={`p-2.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
                  (npc.activeDiscountPercent ?? npc.memory?.activeDiscountPercent ?? 0) < 0
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/60 border-red-500/40 text-red-300'
                }`}>
                  <span>
                    {(npc.activeDiscountPercent ?? npc.memory?.activeDiscountPercent ?? 0) < 0
                      ? `🏷️ Händler-Rabatt aktiv: ${npc.activeDiscountPercent ?? npc.memory?.activeDiscountPercent}% Rabatt dank hoher Zuneigung!`
                      : `⚠️ Preisaufschlag aktiv: +${npc.activeDiscountPercent ?? npc.memory?.activeDiscountPercent}% teurer wegen geringem Vertrauen.`}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {npc.shopItems.map((item) => {
                  const discountPct = npc.activeDiscountPercent ?? npc.memory?.activeDiscountPercent ?? 0;
                  const finalPrice = Math.max(1, Math.round(item.valueGold * (1 + discountPct / 100)));
                  const canAfford = playerGold >= finalPrice;
                  const itemWithPrice = { ...item, valueGold: finalPrice };

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-black/60 border border-gray-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-black/80 border border-gray-700 flex items-center justify-center text-xl flex-shrink-0">
                          {item.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="font-serif font-bold text-xs text-white truncate">{item.name}</div>
                          <div className="text-[10px] font-mono text-[#fbbf24] flex items-center gap-1.5">
                            <span>🪙 {finalPrice} Gold</span>
                            {discountPct !== 0 && (
                              <span className="line-through text-gray-500 text-[9px]">{item.valueGold}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        disabled={!canAfford}
                        onClick={() => onBuyItem(itemWithPrice)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold uppercase tracking-wider transition-all ${
                          canAfford
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        Buy
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
