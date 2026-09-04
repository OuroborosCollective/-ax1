import React, { useState } from 'react';
import {
  Hammer,
  Sparkles,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  Award,
  BookOpen,
  ChevronRight,
  TrendingUp,
  X,
  Package,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  CraftingProfessionId,
  CraftingRecipe,
  GatheringProfessionId,
  ProfessionId,
  ProfessionSkill,
  RPGItem,
} from '../types';
import {
  CRAFTING_RECIPES,
  DEFAULT_PROFESSION_SKILLS,
  GATHERING_ACTIVITIES,
  addProfessionExperience,
} from '../data/professionsData';

interface CraftingModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: RPGItem[];
  playerGold: number;
  professions?: Record<ProfessionId, ProfessionSkill>;
  onCraftSuccess: (outputItem: RPGItem, consumedItems: { id: string; count: number }[], xpAward: number, professionId: CraftingProfessionId) => void;
  onGatherSuccess: (yieldItem: RPGItem, count: number, xpAward: number, professionId: GatheringProfessionId) => void;
  onUpdateProfessions: (updatedProfessions: Record<ProfessionId, ProfessionSkill>) => void;
}

export const CraftingModal: React.FC<CraftingModalProps> = ({
  isOpen,
  onClose,
  inventory,
  playerGold,
  professions = DEFAULT_PROFESSION_SKILLS,
  onCraftSuccess,
  onGatherSuccess,
  onUpdateProfessions,
}) => {
  const [activeTab, setActiveTab] = useState<'crafting' | 'progression'>('crafting');
  const [selectedCraftProfession, setSelectedCraftProfession] = useState<CraftingProfessionId>('carpenter');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(
    CRAFTING_RECIPES.find((r) => r.professionId === 'carpenter')?.id || CRAFTING_RECIPES[0].id
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isCrafting, setIsCrafting] = useState(false);
  const [craftProgress, setCraftProgress] = useState(0);
  const [activeGatheringId, setActiveGatheringId] = useState<GatheringProfessionId | null>(null);
  const [gatherProgress, setGatherProgress] = useState(0);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  // Helper: count how many items of specific ID or name exist in player's inventory
  const getIngredientCount = (ingredientItemId: string, ingredientName: string): number => {
    return inventory
      .filter((it) => it.id === ingredientItemId || it.name.toLowerCase() === ingredientName.toLowerCase())
      .reduce((sum, it) => sum + (it.quantity || 1), 0);
  };

  // Check if recipe can be crafted based on inventory & level
  const checkCanCraft = (recipe: CraftingRecipe): { canCraft: boolean; missingMaterials: string[]; levelTooLow: boolean } => {
    const profSkill = professions[recipe.professionId] || DEFAULT_PROFESSION_SKILLS[recipe.professionId];
    const levelTooLow = profSkill.level < recipe.requiredLevel;
    const missingMaterials: string[] = [];

    for (const ing of recipe.ingredients) {
      const have = getIngredientCount(ing.itemId, ing.name);
      if (have < ing.quantity) {
        missingMaterials.push(`${ing.name} (${have}/${ing.quantity})`);
      }
    }

    return {
      canCraft: !levelTooLow && missingMaterials.length === 0,
      missingMaterials,
      levelTooLow,
    };
  };

  // Filter recipes
  const filteredRecipes = CRAFTING_RECIPES.filter((recipe) => {
    const matchesProf = recipe.professionId === selectedCraftProfession;
    const matchesSearch =
      recipe.germanName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProf && matchesSearch;
  });

  const selectedRecipe = CRAFTING_RECIPES.find((r) => r.id === selectedRecipeId) || filteredRecipes[0] || CRAFTING_RECIPES[0];
  const { canCraft, missingMaterials, levelTooLow } = checkCanCraft(selectedRecipe);

  // Execute Crafting action with animated progress
  const handleStartCraft = () => {
    if (!canCraft || isCrafting) return;

    setIsCrafting(true);
    setCraftProgress(0);
    setFeedbackNotice(null);

    const duration = (selectedRecipe.craftTimeSeconds || 2) * 1000;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.floor((elapsed / duration) * 100));
      setCraftProgress(progress);

      if (progress >= 100) {
        clearInterval(interval);
        setIsCrafting(false);

        // Prepare consumed items
        const consumedItems: { id: string; count: number }[] = [];
        for (const ing of selectedRecipe.ingredients) {
          consumedItems.push({ id: ing.itemId, count: ing.quantity });
        }

        // Add profession XP
        const xpResult = addProfessionExperience(professions, selectedRecipe.professionId, selectedRecipe.xpReward);
        onUpdateProfessions(xpResult.updatedProfessions);

        // Call success callback
        onCraftSuccess(selectedRecipe.outputItem, consumedItems, selectedRecipe.xpReward, selectedRecipe.professionId);

        setFeedbackNotice(`✨ Erfolgreich hergestellt: ${selectedRecipe.germanName} (+${selectedRecipe.xpReward} ${professions[selectedRecipe.professionId]?.germanName || ''} XP)!`);
        setTimeout(() => setFeedbackNotice(null), 4500);
      }
    }, 50);
  };

  // Execute Gathering / Skill-by-doing action
  const handleStartGathering = (professionId: GatheringProfessionId) => {
    if (activeGatheringId) return;

    const activity = GATHERING_ACTIVITIES[professionId];
    if (!activity) return;

    setActiveGatheringId(professionId);
    setGatherProgress(0);
    setFeedbackNotice(null);

    const startTime = Date.now();
    const duration = activity.actionDurationMs;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.floor((elapsed / duration) * 100));
      setGatherProgress(progress);

      if (progress >= 100) {
        clearInterval(interval);
        setActiveGatheringId(null);

        // Calculate yield
        const count = Math.floor(Math.random() * (activity.maxYield - activity.minYield + 1)) + activity.minYield;
        const yieldItem: RPGItem = {
          id: `${activity.yieldItem.id}_${Date.now()}`,
          name: activity.yieldItem.name,
          description: activity.yieldItem.description,
          icon: activity.yieldItem.icon,
          rarity: activity.yieldItem.rarity,
          slot: activity.yieldItem.slot,
          stats: activity.yieldItem.stats,
          valueGold: activity.yieldItem.valueGold,
          quantity: count,
          levelReq: 1,
        };

        // Add profession XP
        const xpResult = addProfessionExperience(professions, professionId, activity.xpGain);
        onUpdateProfessions(xpResult.updatedProfessions);

        // Call callback
        onGatherSuccess(yieldItem, count, activity.xpGain, professionId);

        setFeedbackNotice(`🌿 ${activity.germanName} beendet: +${count}x ${yieldItem.name} erhalten (+${activity.xpGain} XP)!`);
        setTimeout(() => setFeedbackNotice(null), 4500);
      }
    }, 50);
  };

  const craftingProfessionsList: CraftingProfessionId[] = ['carpenter', 'blacksmith', 'alchemist', 'tailor', 'leatherworker'];
  const gatheringProfessionsList: GatheringProfessionId[] = [
    'woodcutter',
    'miner',
    'farmer',
    'herbalist',
    'enchanter',
    'fisherman',
    'hunter',
    'democrat',
    'steward',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-5xl h-[92vh] sm:h-[88vh] bg-[#081a2e] border-2 border-amber-500/50 rounded-2xl flex flex-col text-gray-200 shadow-[0_0_50px_rgba(0,240,255,0.2)] overflow-hidden">
        
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-[#040d1a] via-[#081a2e] to-[#040d1a] border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 text-lg shadow-inner">
              <Hammer className="w-5 h-5 text-[#00f0ff]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-serif font-bold text-amber-100 tracking-wide flex items-center gap-2">
                Handwerk & Berufe von Aurion
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30">
                  Vollversion
                </span>
              </h2>
              <p className="text-[11px] text-gray-400">
                Meistere Berufe, sammle Rohstoffe und zimmere Möbel, Waffen & Relikte.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switchers */}
            <div className="flex bg-black/50 p-1 rounded-xl border border-gray-800">
              <button
                onClick={() => setActiveTab('crafting')}
                className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'crafting'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Hammer className="w-3.5 h-3.5" /> Rezepte & Schmiede
              </button>
              <button
                onClick={() => setActiveTab('progression')}
                className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'progression'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" /> Berufe & Sammeln
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-black/40 border border-gray-800 hover:border-amber-500/60 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feedback Alert Bar */}
        {feedbackNotice && (
          <div className="px-4 py-2 bg-gradient-to-r from-emerald-950/90 to-[#081a2e] border-b border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00f0ff] animate-spin" />
              <span className="font-serif">{feedbackNotice}</span>
            </div>
            <button onClick={() => setFeedbackNotice(null)} className="text-emerald-400 hover:text-white text-xs">
              ✕
            </button>
          </div>
        )}

        {/* TAB 1: CRAFTING RECIPES */}
        {activeTab === 'crafting' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left: Profession Selector & Recipe List */}
            <div className="w-full md:w-5/12 border-b md:border-b-0 md:border-r border-gray-800 flex flex-col bg-[#040d1a]/60">
              {/* Profession Selector Buttons */}
              <div className="p-3 border-b border-gray-800/80 bg-black/40">
                <div className="grid grid-cols-5 gap-1.5">
                  {craftingProfessionsList.map((profId) => {
                    const prof = professions[profId] || DEFAULT_PROFESSION_SKILLS[profId];
                    const isSelected = selectedCraftProfession === profId;
                    return (
                      <button
                        key={profId}
                        onClick={() => {
                          setSelectedCraftProfession(profId);
                          const firstRec = CRAFTING_RECIPES.find((r) => r.professionId === profId);
                          if (firstRec) setSelectedRecipeId(firstRec.id);
                        }}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer text-center ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                            : 'bg-black/30 border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700'
                        }`}
                      >
                        <span className="text-xl">{prof.icon}</span>
                        <span className="text-[10px] font-serif font-bold leading-tight truncate w-full">
                          {prof.germanName}
                        </span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-black/60 text-[#00f0ff]">
                          Lvl {prof.level}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Search Bar */}
                <div className="mt-2 relative">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rezepte filtern (z.B. Holzkiste, Haustür)..."
                    className="w-full bg-black/60 border border-gray-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#00f0ff]/60"
                  />
                </div>
              </div>

              {/* Recipe List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                {filteredRecipes.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-500">
                    Keine Rezepte gefunden für diese Auswahl.
                  </div>
                ) : (
                  filteredRecipes.map((recipe) => {
                    const isSelected = selectedRecipe.id === recipe.id;
                    const { canCraft: craftable, levelTooLow: lvlReq } = checkCanCraft(recipe);
                    return (
                      <button
                        key={recipe.id}
                        onClick={() => setSelectedRecipeId(recipe.id)}
                        className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#081a2e] border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                            : 'bg-black/30 border-gray-800/80 hover:bg-black/50 hover:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-black/60 border border-gray-700 flex items-center justify-center text-lg shrink-0">
                            {recipe.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-serif font-bold text-gray-100 truncate">
                                {recipe.germanName}
                              </span>
                              <span className="text-[10px] font-mono text-gray-500">
                                Lvl {recipe.requiredLevel}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 truncate">{recipe.category}</p>
                          </div>
                        </div>

                        {/* Status tag */}
                        <div className="shrink-0 flex items-center gap-1">
                          {craftable ? (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 flex items-center gap-1">
                              <CheckCircle className="w-2.5 h-2.5" /> Bereit
                            </span>
                          ) : lvlReq ? (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-950/80 text-red-300 border border-red-500/40">
                              Lvl {recipe.requiredLevel}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300/80 border border-amber-500/30">
                              Materialien fehlen
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Recipe Inspector & Craft Station */}
            <div className="w-full md:w-7/12 flex flex-col p-4 sm:p-6 overflow-y-auto custom-scrollbar bg-gradient-to-b from-[#081a2e] to-[#040d1a]">
              {selectedRecipe ? (
                <div className="space-y-4 max-w-xl mx-auto w-full">
                  {/* Selected Item Overview Card */}
                  <div className="p-4 rounded-2xl bg-black/50 border border-amber-500/40 shadow-xl flex items-start gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-black border-2 border-amber-500/60 flex items-center justify-center text-3xl shrink-0 shadow-inner">
                      {selectedRecipe.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-serif font-bold text-amber-200">
                          {selectedRecipe.germanName}
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 uppercase">
                          {selectedRecipe.category}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                        {selectedRecipe.description}
                      </p>

                      {/* Stat summary pills */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedRecipe.outputItem.stats?.attack && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950/60 text-red-300 border border-red-800/40">
                            +{selectedRecipe.outputItem.stats.attack} Angriff
                          </span>
                        )}
                        {selectedRecipe.outputItem.stats?.armor && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40">
                            +{selectedRecipe.outputItem.stats.armor} Rüstung
                          </span>
                        )}
                        {selectedRecipe.outputItem.stats?.maxHp && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                            +{selectedRecipe.outputItem.stats.maxHp} Max HP
                          </span>
                        )}
                        {selectedRecipe.outputItem.effectDescription && (
                          <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-yellow-950/60 text-yellow-300 border border-yellow-800/40">
                            {selectedRecipe.outputItem.effectDescription}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Required Materials Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-serif font-bold text-gray-300">
                      <span className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-[#00f0ff]" /> Benötigte Materialien:
                      </span>
                      <span className="text-[11px] font-mono text-gray-400">
                        {selectedRecipe.ingredients.length} Komponenten
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedRecipe.ingredients.map((ing) => {
                        const currentCount = getIngredientCount(ing.itemId, ing.name);
                        const hasEnough = currentCount >= ing.quantity;
                        return (
                          <div
                            key={ing.itemId}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 bg-black/40 ${
                              hasEnough ? 'border-emerald-500/40' : 'border-red-500/40'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{ing.icon}</span>
                              <div>
                                <div className="text-xs font-medium text-gray-200">{ing.name}</div>
                                <div className="text-[10px] text-gray-500 font-mono">Bedarf: {ing.quantity}x</div>
                              </div>
                            </div>

                            <div
                              className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                                hasEnough
                                  ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-600/40'
                                  : 'bg-red-950/70 text-red-300 border border-red-600/40'
                              }`}
                            >
                              {currentCount} / {ing.quantity}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Crafting Requirements & Rewards Info */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-black/40 border border-gray-800 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 block">Benötigte Stufe</span>
                      <span
                        className={`font-mono font-bold ${
                          levelTooLow ? 'text-red-400' : 'text-emerald-300'
                        }`}
                      >
                        Stufe {selectedRecipe.requiredLevel}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block">Handwerks-XP</span>
                      <span className="font-mono font-bold text-amber-300">
                        +{selectedRecipe.xpReward} XP
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block">Dauer</span>
                      <span className="font-mono font-bold text-gray-300">
                        {selectedRecipe.craftTimeSeconds}s
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar when crafting */}
                  {isCrafting && (
                    <div className="space-y-1.5 p-3 rounded-xl bg-amber-950/30 border border-amber-500/50">
                      <div className="flex justify-between text-xs font-serif text-amber-200">
                        <span className="flex items-center gap-1.5 animate-pulse">
                          <Hammer className="w-3.5 h-3.5" /> Handwerk wird ausgeführt...
                        </span>
                        <span className="font-mono">{craftProgress}%</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-black/60 overflow-hidden border border-amber-900/50">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-[#00f0ff] transition-all duration-75"
                          style={{ width: `${craftProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Missing warnings */}
                  {!canCraft && (
                    <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/40 text-xs text-red-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        {levelTooLow && (
                          <p>
                            Deine {professions[selectedRecipe.professionId]?.germanName}-Stufe ist zu niedrig (Aktuell:{' '}
                            {professions[selectedRecipe.professionId]?.level}, Benötigt: {selectedRecipe.requiredLevel}).
                          </p>
                        )}
                        {missingMaterials.length > 0 && (
                          <p>
                            Es fehlen Materialien: {missingMaterials.join(', ')}.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="pt-2">
                    <button
                      onClick={handleStartCraft}
                      disabled={!canCraft || isCrafting}
                      className={`w-full py-3.5 px-4 rounded-xl font-serif font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        canCraft && !isCrafting
                          ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:brightness-110 text-black shadow-[0_0_25px_rgba(245,158,11,0.4)] active:scale-98'
                          : 'bg-gray-800/60 border border-gray-700 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <Hammer className="w-4 h-4" />
                      {isCrafting ? 'Wird gefertigt...' : `${selectedRecipe.germanName} herstellen`}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* TAB 2: PROFESSIONS & SKILL LEVELING BY DOING */}
        {activeTab === 'progression' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-6">
            
            {/* Section: Crafting Professions */}
            <div>
              <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-3">
                <Hammer className="w-4 h-4 text-amber-400" />
                <h3 className="font-serif font-bold text-sm text-amber-200 tracking-wide uppercase">
                  Handwerks-Meisterschaften (5 Disziplinen)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {craftingProfessionsList.map((profId) => {
                  const prof = professions[profId] || DEFAULT_PROFESSION_SKILLS[profId];
                  const progressPct = Math.min(100, Math.floor((prof.xp / prof.maxXp) * 100));
                  return (
                    <div
                      key={profId}
                      className="p-3.5 rounded-xl bg-black/40 border border-gray-800 hover:border-amber-500/50 transition-all flex flex-col justify-between space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-black/60 border border-gray-700 flex items-center justify-center text-xl">
                            {prof.icon}
                          </div>
                          <div>
                            <div className="font-serif font-bold text-sm text-gray-100">
                              {prof.germanName}
                            </div>
                            <span className="text-[10px] font-mono text-[#00f0ff]">
                              Stufe {prof.level} / 100
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40">
                          {prof.totalCraftedOrGathered}x gefertigt
                        </span>
                      </div>

                      <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                        {prof.description}
                      </p>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono text-gray-400">
                          <span>Fortschritt</span>
                          <span>{prof.xp} / {prof.maxXp} XP ({progressPct}%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-black/80 overflow-hidden border border-gray-800">
                          <div
                            className="h-full bg-amber-500 transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-[10px] font-mono text-gray-300 bg-black/50 p-1.5 rounded border border-gray-800/60">
                        <span className="text-amber-400 font-bold">Passiv:</span> {prof.passiveBonus}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section: Gathering & Civic Professions (Leveling by Doing with Action Buttons) */}
            <div>
              <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-3">
                <Sparkles className="w-4 h-4 text-[#00f0ff]" />
                <h3 className="font-serif font-bold text-sm text-[#00f0ff] tracking-wide uppercase">
                  Sammel- & Staatsberufe (Leveling by Doing — 9 Disziplinen)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {gatheringProfessionsList.map((profId) => {
                  const prof = professions[profId] || DEFAULT_PROFESSION_SKILLS[profId];
                  const activity = GATHERING_ACTIVITIES[profId];
                  const progressPct = Math.min(100, Math.floor((prof.xp / prof.maxXp) * 100));
                  const isThisGathering = activeGatheringId === profId;

                  return (
                    <div
                      key={profId}
                      className="p-3.5 rounded-xl bg-black/40 border border-gray-800 hover:border-[#00f0ff]/50 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-black/60 border border-gray-700 flex items-center justify-center text-xl">
                            {prof.icon}
                          </div>
                          <div>
                            <div className="font-serif font-bold text-sm text-gray-100">
                              {prof.germanName}
                            </div>
                            <span className="text-[10px] font-mono text-[#00f0ff]">
                              Stufe {prof.level} / 100
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-[#00f0ff] border border-cyan-800/40">
                          {prof.category === 'civic' ? 'Bürgerkunst' : 'Sammeln'}
                        </span>
                      </div>

                      <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                        {prof.description}
                      </p>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono text-gray-400">
                          <span>Erfahrung</span>
                          <span>{prof.xp} / {prof.maxXp} XP ({progressPct}%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-black/80 overflow-hidden border border-gray-800">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-[#00f0ff] transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Interactive Skill Practice Action Button */}
                      {activity && (
                        <div className="pt-1">
                          {isThisGathering ? (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-mono text-[#00f0ff]">
                                <span>{activity.germanName}...</span>
                                <span>{gatherProgress}%</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-black/80 overflow-hidden border border-[#00f0ff]/50">
                                <div
                                  className="h-full bg-[#00f0ff] transition-all duration-75"
                                  style={{ width: `${gatherProgress}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartGathering(profId)}
                              disabled={!!activeGatheringId}
                              className={`w-full py-2 px-3 rounded-lg text-xs font-serif font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                activeGatheringId
                                  ? 'bg-black/40 border border-gray-800 text-gray-600 cursor-not-allowed'
                                  : 'bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 border border-[#00f0ff]/40 text-[#00f0ff] active:scale-95 shadow-sm'
                              }`}
                            >
                              <span>{activity.yieldItem.icon}</span> {activity.germanName} ausüben
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
