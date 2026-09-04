import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle, RefreshCw, MonitorOff, ShieldCheck } from 'lucide-react';
import { MMOEngine } from './core/MMOEngine';
import {
  ActiveBuffSummary,
  CharacterClassId,
  ChatMessage,
  DayNightInfo,
  EnginePerformanceMetrics,
  EquipmentState,
  FloatingCombatText,
  LootDropEntity,
  MultiplayerNetStats,
  NPCCharacter,
  PartyMember,
  PlayerStats,
  Quest,
  RPGItem,
  SimulatedPlayer,
  WorldMobEntity,
} from './types';
import { GameHUD } from './components/GameHUD';
import { InventoryModal } from './components/InventoryModal';
import { CharacterModal } from './components/CharacterModal';
import { ClassSelectModal } from './components/ClassSelectModal';
import { NPCDialogueModal } from './components/NPCDialogueModal';
import { QuestLogModal } from './components/QuestLogModal';
import { WorldMapModal } from './components/WorldMapModal';
import { PartyModal } from './components/PartyModal';
import { MariaDbAndGlbConsole } from './components/MariaDbAndGlbConsole';
import { TerritoryPoliticsModal } from './components/TerritoryPoliticsModal';
import { NPCEconomyModal } from './components/NPCEconomyModal';
import { DeterminismDebugOverlay } from './components/DeterminismDebugOverlay';
import { syncManager } from './core/SyncManager';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MMOEngine | null>(null);

  // WebGL Diagnostics & Error Fallback
  const [webglError, setWebglError] = useState<string | null>(null);
  const [initAttempt, setInitAttempt] = useState<number>(0);

  // Core RPG Reactive States
  const [currentClassId, setCurrentClassId] = useState<CharacterClassId>('knight');
  const [stats, setStats] = useState<PlayerStats>({
    hp: 450,
    maxHp: 450,
    resource: 100,
    maxResource: 100,
    resourceName: 'Steam Pressure',
    level: 1,
    xp: 0,
    maxXp: 180,
    attackPower: 45,
    spellPower: 15,
    armor: 35,
    critChance: 12,
    moveSpeed: 100,
    gold: 250,
    kills: 0,
    bossKills: 0,
    isMounted: false,
    x: 0,
    y: 0,
    z: 0,
    currentZone: 'Grand Sanctum of Aethelgard',
  });

  const [targetMob, setTargetMob] = useState<WorldMobEntity | null>(null);
  const [nearbyNPC, setNearbyNPC] = useState<NPCCharacter | null>(null);
  const [nearbyLoot, setNearbyLoot] = useState<LootDropEntity | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingCombatText[]>([]);
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([]);
  const [dayNightInfo, setDayNightInfo] = useState<DayNightInfo | undefined>(undefined);
  const [simPlayers, setSimPlayers] = useState<SimulatedPlayer[]>([]);
  const [netStats, setNetStats] = useState<MultiplayerNetStats>({
    connected: false,
    pingMs: 0,
    onlinePlayers: 1,
    playerId: 'hero_player_1',
  });
  const [activeBuffs, setActiveBuffs] = useState<ActiveBuffSummary[]>([]);
  const [engineMetrics, setEngineMetrics] = useState<EnginePerformanceMetrics>({
    fps: 60,
    lodStats: { highCount: 0, mediumCount: 0, lowCount: 0, culledCount: 0, totalTracked: 0 },
  });
  const [equipment, setEquipment] = useState<EquipmentState>(() => ({
    weapon: null,
    shield: null,
    helmet: null,
    shoulders: null,
    chest: null,
    arms: null,
    legs: null,
    boots: null,
    relic: null,
    mount: null,
  }));
  const [inventory, setInventory] = useState<RPGItem[]>([]);

  // Modals States
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isCharacterOpen, setIsCharacterOpen] = useState(false);
  const [isClassSelectOpen, setIsClassSelectOpen] = useState(false);
  const [isNPCDialogueOpen, setIsNPCDialogueOpen] = useState(false);
  const [isQuestLogOpen, setIsQuestLogOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isPartyOpen, setIsPartyOpen] = useState(false);
  const [isServerConsoleOpen, setIsServerConsoleOpen] = useState(false);
  const [isPoliticsOpen, setIsPoliticsOpen] = useState(false);
  const [isEconomyOpen, setIsEconomyOpen] = useState(false);
  const [isDeterminismOverlayOpen, setIsDeterminismOverlayOpen] = useState(false);
  const [isPathfindingDebugActive, setIsPathfindingDebugActive] = useState(false);
  const [activeNPC, setActiveNPC] = useState<NPCCharacter | null>(null);

  // Initialize MMO Engine with WebGL verification and DOM timing safeguard
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Verify WebGL support in client environment
    const support = MMOEngine.checkWebGLSupport();
    if (!support.supported) {
      setWebglError(support.error || 'WebGL hardware acceleration is not supported or is disabled in your browser.');
      return;
    }

    let isCancelled = false;
    let unsubscribeEquipment: (() => void) | null = null;

    try {
      const engine = new MMOEngine(container, currentClassId);
      engineRef.current = engine;

      // Populate initial equipment & inventory
      setEquipment({ ...engine.player.equipment });
      setInventory([...engine.player.inventory]);

      // Subscribe to real-time equipment changes
      unsubscribeEquipment = engine.observePlayerEquipment((updatedEq) => {
        if (!isCancelled) {
          setEquipment({ ...updatedEq });
        }
      });

      engine.onStateUpdate = (state) => {
        if (isCancelled) return;
        setStats({ ...state.stats });
        if (state.equipment) setEquipment({ ...state.equipment });
        if (state.inventory) setInventory([...state.inventory]);
        setTargetMob(state.targetMob ? { ...state.targetMob } : null);
        setNearbyNPC(state.nearbyNPC ? { ...state.nearbyNPC } : null);
        setNearbyLoot(state.nearbyLoot ? { ...state.nearbyLoot } : null);
        setQuests([...state.quests]);
        setChatMessages([...state.chatMessages]);
        setFloatingTexts([...state.floatingTexts]);
        setPartyMembers([...(state.partyMembers || [])]);
        setDayNightInfo(state.dayNightInfo);
        setSimPlayers([...(state.simPlayers || [])]);
        if (state.netStats) setNetStats({ ...state.netStats });
        if (state.activeBuffs) setActiveBuffs([...state.activeBuffs]);
        if (state.engineMetrics) setEngineMetrics({ ...state.engineMetrics });
      };


      // Ensure canvas is appended to DOM and start rendering
      engine.start();
      setWebglError(null);

      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      console.info(`[App] MMOEngine started on #three-viewport: dimensions=${w}x${h}, canvas=${container.querySelector('canvas')?.id || 'attached'}`);
    } catch (err: any) {
      console.error('Failed to initialize MMOEngine:', err);
      setWebglError(err?.message || 'Unexpected failure while initializing 3D WebGL Engine.');
    }

    return () => {
      isCancelled = true;
      unsubscribeEquipment?.();
      if (engineRef.current) {
        engineRef.current.stop();
        engineRef.current = null;
      }
    };
  }, [initAttempt]);

  const handleRetryWebGL = useCallback(() => {
    setWebglError(null);
    setInitAttempt((prev) => prev + 1);
  }, []);

  // Global hotkeys for RPG modals (B, C, M, L, K, Escape)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        setIsInventoryOpen((prev) => !prev);
      } else if (key === 'c') {
        e.preventDefault();
        setIsCharacterOpen((prev) => !prev);
      } else if (key === 'm') {
        e.preventDefault();
        setIsMapOpen((prev) => !prev);
      } else if (key === 'l') {
        e.preventDefault();
        setIsQuestLogOpen((prev) => !prev);
      } else if (key === 'k') {
        e.preventDefault();
        setIsClassSelectOpen((prev) => !prev);
      } else if (key === 'p') {
        e.preventDefault();
        setIsPartyOpen((prev) => !prev);
      } else if (key === 'f1') {
        e.preventDefault();
        setIsServerConsoleOpen((prev) => !prev);
      } else if (key === 'n') {
        e.preventDefault();
        setIsEconomyOpen((prev) => !prev);
      } else if (key === 'f2') {
        e.preventDefault();
        setIsDeterminismOverlayOpen((prev) => !prev);
      } else if (key === 'escape') {
        setIsInventoryOpen(false);
        setIsCharacterOpen(false);
        setIsClassSelectOpen(false);
        setIsNPCDialogueOpen(false);
        setIsQuestLogOpen(false);
        setIsMapOpen(false);
        setIsPartyOpen(false);
        setIsServerConsoleOpen(false);
        setIsEconomyOpen(false);
        setIsDeterminismOverlayOpen(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Action callbacks
  const handleCastSkill = useCallback((skillIndex: number) => {
    engineRef.current?.castClassSkill(skillIndex);
  }, []);

  const handleCycleTarget = useCallback(() => {
    engineRef.current?.cycleTarget();
  }, []);

  const handleVirtualMove = useCallback((forward: number, right: number) => {
    engineRef.current?.setVirtualMovement(forward, right);
  }, []);

  const handleToggleMount = useCallback(() => {
    engineRef.current?.toggleMount();
  }, []);

  const handleInteract = useCallback(() => {
    if (!engineRef.current) return;
    const result = engineRef.current.interactNearby();
    if (result.npcOpened) {
      setActiveNPC(result.npcOpened);
      if (result.npcOpened.role === 'Territory Envoy') {
        setIsPoliticsOpen(true);
      } else {
        setIsNPCDialogueOpen(true);
      }
    }
  }, []);

  const handleSelectClass = useCallback((classId: CharacterClassId) => {
    if (!engineRef.current) return;
    setCurrentClassId(classId);
    engineRef.current.player.setClass(classId);
    engineRef.current.addChatMessage('system', 'Sanctum', `You have chosen the path of the [${classId.toUpperCase()}]!`);
  }, []);

  const handleEquipItem = useCallback((item: RPGItem) => {
    if (!engineRef.current) return;
    engineRef.current.equipItem(item);
    setEquipment({ ...engineRef.current.player.equipment });
    setInventory([...engineRef.current.player.inventory]);
    setStats({ ...engineRef.current.player.stats });
  }, []);

  const handleUnequipSlot = useCallback((slot: any) => {
    if (!engineRef.current) return;
    engineRef.current.unequipItem(slot);
    setEquipment({ ...engineRef.current.player.equipment });
    setInventory([...engineRef.current.player.inventory]);
    setStats({ ...engineRef.current.player.stats });
  }, []);

  const handleUseConsumable = useCallback((item: RPGItem) => {
    if (!engineRef.current) return;
    engineRef.current.player.useConsumable(item);
    setEquipment({ ...engineRef.current.player.equipment });
    setInventory([...engineRef.current.player.inventory]);
    setStats({ ...engineRef.current.player.stats });
  }, []);

  const handleDiscardItem = useCallback((itemId: string) => {
    if (!engineRef.current) return;
    const idx = engineRef.current.player.inventory.findIndex((i) => i.id === itemId);
    if (idx !== -1) {
      engineRef.current.player.inventory.splice(idx, 1);
      setInventory([...engineRef.current.player.inventory]);
    }
  }, []);

  const handleSortInventory = useCallback((sortBy: 'rarity' | 'name' | 'type') => {
    engineRef.current?.sortInventory(sortBy);
  }, []);

  const handleAllocateStatPoint = useCallback((attribute: any) => {
    if (!engineRef.current) return { success: false, message: 'Engine not initialized' };
    const res = engineRef.current.player.allocateStatPoint(attribute);
    setStats({ ...engineRef.current.player.stats });
    return res;
  }, []);

  const handleUnlockMilestoneSkill = useCallback((skillId: string) => {
    if (!engineRef.current) return { success: false, message: 'Engine not initialized' };
    const res = engineRef.current.player.unlockMilestoneSkill(skillId);
    setStats({ ...engineRef.current.player.stats });
    return res;
  }, []);

  const handleEquipSkill = useCallback((slotIndex: number, skill: any) => {
    if (!engineRef.current) return;
    engineRef.current.player.equipSkillToHotbar(slotIndex, skill);
    setStats({ ...engineRef.current.player.stats });
  }, []);

  // Party Management Handlers
  const handleInvitePartyMember = useCallback((player: SimulatedPlayer) => {
    if (!engineRef.current) return;
    const isTank = player.classId === 'knight';
    const isHealer = player.classId === 'mage';
    const success = engineRef.current.partyManager.inviteMember({
      id: player.id,
      name: player.name,
      classId: player.classId,
      level: player.level,
      avatarIcon: player.name.includes('Slayer') ? '⚔️' : player.name.includes('Heal') ? '💖' : '🛡️',
      role: isTank ? 'tank' : isHealer ? 'healer' : 'dps',
      hp: 400 + player.level * 45,
      maxHp: 400 + player.level * 45,
      resource: 100,
      maxResource: 100,
      isLeader: false,
      inCombat: false,
      zone: engineRef.current.player.stats.currentZone,
    });

    if (!success) {
      engineRef.current.addChatMessage('system', 'Party', 'Party is already full! (Max 4 members).');
    }
  }, []);


  const handleKickPartyMember = useCallback((memberId: string) => {
    engineRef.current?.partyManager.kickMember(memberId);
  }, []);

  const handleLeaveParty = useCallback(() => {
    engineRef.current?.partyManager.leaveParty();
  }, []);

  const handlePromoteLeader = useCallback((memberId: string) => {
    engineRef.current?.partyManager.promoteLeader(memberId);
  }, []);

  const handleSetLootRule = useCallback((rule: any) => {
    if (engineRef.current) {
      engineRef.current.partyManager.lootRule = rule;
      engineRef.current.addChatMessage('party', 'Party Leader', `Loot distribution rule set to: [${rule.toUpperCase()}].`);
    }
  }, []);

  const handleAcceptQuest = useCallback((quest: Quest) => {
    if (!engineRef.current) return;
    if (!engineRef.current.quests.some((q) => q.id === quest.id)) {
      engineRef.current.quests.push({ ...quest });
      engineRef.current.addChatMessage('system', 'Quest Accepted', `Accepted new campaign quest: [${quest.title}]!`);
    }
  }, []);


  const handleBuyItem = useCallback((item: RPGItem) => {
    if (!engineRef.current) return;
    if (engineRef.current.player.stats.gold >= item.valueGold) {
      engineRef.current.player.stats.gold -= item.valueGold;
      engineRef.current.player.inventory.push(item);
      engineRef.current.addChatMessage('system', 'Merchant', `Purchased [${item.name}] for ${item.valueGold} Gold.`);
    }
  }, []);

  const handleSendMessage = useCallback((text: string, channel: ChatMessage['channel']) => {
    if (!engineRef.current) return;

    if (text.startsWith('/')) {
      const cmd = text.toLowerCase().trim();
      if (cmd === '/help') {
        engineRef.current.addChatMessage('system', 'System', 'Commands: /help, /loot (simulate legendary drop), /boss (locate titan), /dance, /gold');
      } else if (cmd === '/loot') {
        engineRef.current.lootManager.spawnLoot(
          engineRef.current.player.inventory[0] || {
            id: 'item_gm_drop',
            name: 'Titan Overclocked Greatsword',
            slot: 'weapon',
            rarity: 'legendary',
            icon: '⚔️',
            description: 'Forged from the heart of Titan Ignis.',
            stats: { attack: 120, critChance: 25 },
            valueGold: 500,
          },
          engineRef.current.player.position.x + 2,
          engineRef.current.player.position.z + 2,
          250
        );
        engineRef.current.addChatMessage('system', 'System', 'Spawned legendary loot beacon at your location!');
      } else if (cmd === '/boss') {
        engineRef.current.addChatMessage('system', 'Oracle', 'Titan Ignis resides in the Void Spire Arena at [X: 0, Z: 65]!');
      } else if (cmd === '/dance') {
        engineRef.current.addChatMessage('all', 'You', 'performs an intricate steampunk clockwork victory dance!');
      } else if (cmd === '/gold') {
        engineRef.current.player.stats.gold += 500;
        engineRef.current.addChatMessage('system', 'Vault', 'Granted 500 Gold.');
      }
      return;
    }

    engineRef.current.addChatMessage(channel, 'Hero', text, true);
  }, []);

  return (
    <main id="app-root" className="relative w-screen h-screen overflow-hidden bg-[#0d0e12] select-none">
      {/* 3D WebGL Canvas Viewport */}
      <div
        id="three-viewport"
        ref={containerRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing overflow-hidden"
      />

      {/* WebGL Diagnostic Fallback Screen */}
      {webglError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-6 text-center">
          <div className="max-w-md w-full bg-[#161922] border-2 border-red-500/50 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-serif font-bold text-white tracking-wide">3D WebGL Engine Notice</h2>
              <p className="text-xs text-red-300 font-mono bg-red-950/40 p-2.5 rounded-lg border border-red-900/50 break-words">
                {webglError}
              </p>
            </div>

            <div className="text-xs text-gray-400 text-left space-y-1.5 bg-black/40 p-3 rounded-lg border border-gray-800">
              <p className="font-bold text-gray-300">Recommended Steps:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Ensure <strong>Hardware Acceleration</strong> is turned ON in your browser settings.</li>
                <li>Check that WebGL is enabled in your browser or tab flags.</li>
                <li>Ensure graphics drivers are up to date or test in an incognito window.</li>
              </ul>
            </div>

            <button
              onClick={handleRetryWebGL}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-black font-serif font-bold text-sm tracking-wider transition-all shadow-lg hover:shadow-amber-500/20 active:scale-98"
            >
              <RefreshCw className="w-4 h-4" /> Re-initialize 3D Realm
            </button>
          </div>
        </div>
      )}

      {/* Real-time MMORPG Heads-Up Display */}
      <GameHUD
        playerStats={stats}
        currentClassId={currentClassId}
        targetMob={targetMob}
        nearbyNPC={nearbyNPC}
        nearbyLoot={nearbyLoot}
        quests={quests}
        chatMessages={chatMessages}
        floatingTexts={floatingTexts}
        partyMembers={partyMembers}
        dayNightInfo={dayNightInfo}
        netStats={netStats}
        activeBuffs={activeBuffs}
        engineMetrics={engineMetrics}
        onCastSkill={handleCastSkill}
        onCycleTarget={handleCycleTarget}
        onVirtualMove={handleVirtualMove}
        onToggleMount={handleToggleMount}
        onInteract={handleInteract}
        onOpenInventory={() => setIsInventoryOpen(true)}
        onOpenCharacter={() => setIsCharacterOpen(true)}
        onOpenQuests={() => setIsQuestLogOpen(true)}
        onOpenClasses={() => setIsClassSelectOpen(true)}
        onOpenMap={() => setIsMapOpen(true)}
        onOpenParty={() => setIsPartyOpen(true)}
        onOpenServerConsole={() => setIsServerConsoleOpen(true)}
        onOpenEconomy={() => setIsEconomyOpen(true)}
        onOpenDeterminismOverlay={() => setIsDeterminismOverlayOpen((prev) => !prev)}
        onSendMessage={handleSendMessage}
      />

      {/* Inventory & Equipment Paperdoll Dialog */}
      <InventoryModal
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
        equipment={equipment}
        inventory={inventory}
        gold={stats.gold}
        onEquip={handleEquipItem}
        onUnequip={handleUnequipSlot}
        onUseConsumable={handleUseConsumable}
        onDiscard={handleDiscardItem}
        onSortInventory={handleSortInventory}
      />

      {/* Party Management & Cooperative Grouping Dialog */}
      <PartyModal
        isOpen={isPartyOpen}
        onClose={() => setIsPartyOpen(false)}
        partyMembers={partyMembers}
        availablePlayers={simPlayers}
        nearbyPlayers={simPlayers}
        lootRule={engineRef.current?.partyManager.lootRule || 'round_robin'}
        onInvitePlayer={handleInvitePartyMember}
        onKickMember={handleKickPartyMember}
        onRemoveMember={handleKickPartyMember}
        onLeaveParty={handleLeaveParty}
        onPromoteLeader={handlePromoteLeader}
        onSetLootRule={handleSetLootRule}
      />


      {/* Character Sheet & Attributes Dialog */}
      <CharacterModal
        isOpen={isCharacterOpen}
        onClose={() => setIsCharacterOpen(false)}
        stats={stats}
        currentClassId={currentClassId}
        onAllocateStatPoint={handleAllocateStatPoint}
        onUnlockMilestoneSkill={handleUnlockMilestoneSkill}
        onEquipSkill={handleEquipSkill}
      />

      {/* Class Sanctum & Skill Switcher Dialog */}
      <ClassSelectModal
        isOpen={isClassSelectOpen}
        onClose={() => setIsClassSelectOpen(false)}
        currentClassId={currentClassId}
        onSelectClass={handleSelectClass}
      />

      {/* NPC Dialogue, Quests, Genkit AI Quest Board & Merchant Shop Dialog */}
      <NPCDialogueModal
        isOpen={isNPCDialogueOpen}
        onClose={() => setIsNPCDialogueOpen(false)}
        npc={activeNPC}
        activeQuests={quests}
        playerGold={stats.gold}
        playerLevel={stats.level}
        genkitAdapter={engineRef.current?.genkitAdapter}
        onAcceptQuest={handleAcceptQuest}
        onBuyItem={handleBuyItem}
      />

      {/* Dedicated Quest Chronicles Log Dialog */}
      <QuestLogModal
        isOpen={isQuestLogOpen}
        onClose={() => setIsQuestLogOpen(false)}
        quests={quests}
      />

      {/* Realm Atlas World Map Dialog */}
      <WorldMapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        playerStats={stats}
        npcs={engineRef.current?.npcs || []}
        chunkManager={engineRef.current?.landscape.chunkManager || null}
      />

      {/* MariaDB Persistence & External GLB 3D Asset Vault Console */}
      <MariaDbAndGlbConsole
        isOpen={isServerConsoleOpen}
        onClose={() => setIsServerConsoleOpen(false)}
        player={engineRef.current?.player || null}
        engine={engineRef.current || null}
        onSaveState={async () => {
          if (!engineRef.current) return;
          const p = engineRef.current.player;
          syncManager.updateLocalState({
            playerId: 'hero_aurion_1',
            stats: stats,
            inventory: p.inventory,
            quests: quests,
          });
          const ok = await syncManager.performSync();
          if (ok) {
            engineRef.current.addChatMessage('system', 'Persistence', 'Player state & inventory securely persisted to MariaDB!');
          }
        }}
      />

      {/* Region Administration & Politics Modal */}
      {activeNPC && activeNPC.role === 'Territory Envoy' && engineRef.current && (
        <TerritoryPoliticsModal
          isOpen={isPoliticsOpen}
          onClose={() => setIsPoliticsOpen(false)}
          npc={activeNPC}
          player={engineRef.current.player}
          onClaimTerritory={(chunkKey, guardCount, ownerName) => {
            engineRef.current?.addFloatingText(`Territorium beansprucht!`, engineRef.current.player.position.x, engineRef.current.player.position.y + 3, '#fbbf24', 'xl');
            engineRef.current?.spawnTerritoryGuards(chunkKey, guardCount, ownerName);
            setIsPoliticsOpen(false);
          }}
          onCompleteQuest={(questId, xp, points) => {
            // Simplified logic for Political Quests
            const pStats = { ...stats };
            pStats.politicsXp += xp;
            if (pStats.politicsXp >= pStats.politicsLevel * 100) {
              pStats.politicsLevel++;
              pStats.politicsXp = 0;
              engineRef.current?.addFloatingText('Politik Level Up!', engineRef.current.player.position.x, engineRef.current.player.position.y + 3, '#06b6d4', 'xl');
            }
            setStats(pStats);
            engineRef.current?.addFloatingText(`+${xp} Politik XP`, engineRef.current.player.position.x, engineRef.current.player.position.y + 2, '#06b6d4', 'lg');
            
            // Note: points saving is handled inside the modal by updating MariaDB directly
            setIsPoliticsOpen(false);
          }}
        />
      )}

      {/* Autonomous NPC Economy & Commodity Markets Dialog */}
      <NPCEconomyModal
        isOpen={isEconomyOpen}
        onClose={() => setIsEconomyOpen(false)}
        economy={engineRef.current?.npcEconomy || null}
        playerStats={stats}
        onPlayerGoldChange={(newGold) => {
          setStats((prev) => ({ ...prev, gold: newGold }));
          if (engineRef.current) {
            engineRef.current.player.stats.gold = newGold;
          }
        }}
        onShowMessage={(msg, color = '#00f0ff') => {
          if (engineRef.current) {
            engineRef.current.addFloatingText(
              msg,
              engineRef.current.player.position.x,
              engineRef.current.player.position.y + 2.6,
              color,
              'lg'
            );
            engineRef.current.addChatMessage('system', 'Markt', msg);
          }
        }}
      />

      {/* Determinism & Simulation State Desync Debugging Overlay */}
      <DeterminismDebugOverlay
        isOpen={isDeterminismOverlayOpen}
        onClose={() => setIsDeterminismOverlayOpen(false)}
        economy={engineRef.current?.npcEconomy || null}
        onTogglePathfindingDebug={() => {
          if (engineRef.current) {
            const active = engineRef.current.togglePathfindingDebug();
            setIsPathfindingDebugActive(active);
          }
        }}
        isPathfindingDebugActive={isPathfindingDebugActive}
        onShowNotification={(msg, color = '#00f0ff') => {
          if (engineRef.current) {
            engineRef.current.addFloatingText(
              msg,
              engineRef.current.player.position.x,
              engineRef.current.player.position.y + 2.8,
              color,
              'md'
            );
            engineRef.current.addChatMessage('system', 'Sync', msg);
          }
        }}
      />
    </main>
  );
}
