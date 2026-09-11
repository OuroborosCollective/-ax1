/**
 * Core Types for Aurion - 3D Open World Steampunk Fantasy MMORPG
 */

export type CharacterClassId = 'knight' | 'mage' | 'ranger' | 'engineer';

export type WeaponType = 'blade' | 'arcane' | 'marksmanship' | 'heavy_tech' | 'scythe' | 'battleaxe' | 'warhammer' | 'daggers' | 'bow' | 'staff' | 'wand' | 'knuckles' | 'spear' | 'greatsword';
export type ArmorType = 'shoulder' | 'bracers' | 'gloves' | 'chest' | 'shoes' | 'legs' | 'helmet' | 'cape';
export type ItemMaterial = 'steel' | 'iron' | 'bronze' | 'leather' | 'cloth';

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mystic';

export type ItemSlot =
  | 'weapon'
  | 'shield'
  | 'offhand'
  | 'helmet'
  | 'head'
  | 'shoulders'
  | 'chest'
  | 'arms'
  | 'gloves'
  | 'legs'
  | 'boots'
  | 'shoes'
  | 'cape'
  | 'relic'
  | 'ring'
  | 'amulet'
  | 'mount'
  | 'consumable'
  | 'material'
  | 'tool'
  | 'furniture';

// --- Handwerk & Berufe System Types ---
export type CraftingProfessionId =
  | 'blacksmith'     // Schmied
  | 'alchemist'      // Alchemist
  | 'tailor'         // Schneider
  | 'leatherworker'  // Ledermeister
  | 'carpenter';     // Tischler

export type GatheringProfessionId =
  | 'woodcutter'     // Holzfäller
  | 'miner'          // Bergbauer
  | 'farmer'         // Bauer
  | 'herbalist'      // Kräuterkundler
  | 'enchanter'      // Verzauberung
  | 'fisherman'      // Fischer
  | 'hunter'         // Jäger
  | 'democrat'       // Demokrat (Staatsbürger / Volkstribun)
  | 'steward';       // Landesverwalter (Gouverneur / Vogt)

export type ProfessionId = CraftingProfessionId | GatheringProfessionId;

export interface ProfessionSkill {
  id: ProfessionId;
  name: string;
  germanName: string;
  category: 'crafting' | 'gathering' | 'civic';
  icon: string;
  color: string;
  description: string;
  level: number;
  xp: number;
  maxXp: number;
  totalCraftedOrGathered: number;
  passiveBonus: string;
}

export interface CraftingRecipeIngredient {
  itemId: string;
  name: string;
  icon: string;
  quantity: number;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  germanName: string;
  professionId: CraftingProfessionId;
  requiredLevel: number;
  xpReward: number;
  craftTimeSeconds: number;
  outputItemId: string;
  outputQuantity: number;
  outputItem: RPGItem;
  ingredients: CraftingRecipeIngredient[];
  description: string;
  category: string;
  icon: string;
  rarity: ItemRarity;
  goldCost?: number;
}

// --- Dungeon Finder System Types ---
export interface DungeonDefinition {
  id: string;
  name: string;
  germanName: string;
  description: string;
  zone: string;
  levelReq: number;
  recommendedIlvl: number;
  bossCount: number;
  bosses: string[];
  bannerGradient: string;
  icon: string;
  rewards: { xp: number; gold: number; gearRarity: ItemRarity };
  rolesNeeded: { tanks: number; healers: number; dps: number };
}

export interface DungeonQueueState {
  dungeonId: string | null;
  selectedRole: 'tank' | 'healer' | 'dps';
  status: 'idle' | 'queuing' | 'group_found' | 'in_dungeon';
  queueStartTime: number | null;
  elapsedSeconds: number;
  matchedParty: {
    tank: string | null;
    healer: string | null;
    dps: string[];
  };
}

// --- Lore & Storyline Chronicles Types ---
export interface LoreChapter {
  id: string;
  title: string;
  germanTitle: string;
  era: string;
  description: string;
  unlocked: boolean;
  requiredCompletedQuests: string[];
  icon: string;
  bannerColor: string;
}

export interface LoreEntry {
  id: string;
  chapterId: string;
  title: string;
  author: string;
  excerpt: string;
  fullText: string;
  unlockedAt?: string;
  rewardClaimed?: boolean;
}

export interface CharacterAttributes {
  strength: number;     // Physical damage & heavy crit bonus
  agility: number;      // Attack speed, cooldown reduction & dodge chance
  intelligence: number; // Max mana, mana regen & magic spell power
  defense: number;      // Armor rating & max HP
}

export interface AttributeBreakpoint {
  attribute: keyof CharacterAttributes;
  threshold: number; // 25, 50, 75, 100
  name: string;
  icon: string;
  description: string;
}

export interface WeaponMasteryPerk {
  id: string;
  weaponType: WeaponType;
  name: string;
  tier: number; // 1..6
  requiredMasteryLevel: number;
  icon: string;
  description: string;
  effectType: 'damage_mult' | 'crit_damage' | 'cooldown_reduc' | 'lifesteal' | 'armor_penetration' | 'resource_cost' | 'cleave_radius' | 'elemental_potency';
  value: number; // e.g. 0.15 for 15%
}

export interface MilestoneWeaponSkill extends ClassSkill {
  requiredMasteryLevel: number;
  unlockCostGold: number;
  weaponType: WeaponType;
  unlocked?: boolean;
}

export interface WeaponMastery {
  type: WeaponType;
  name: string;
  level: number;
  xp: number;
  maxXp: number;
  icon: string;
  color: string;
  description: string;
  scalingAttr: string;
  perkPoints?: number;
  allocatedPerks?: string[];
  bonusStats: {
    attack?: number;
    spellPower?: number;
    armor?: number;
    critChance?: number;
    maxHp?: number;
    maxResource?: number;
    moveSpeed?: number;
    dodgeChance?: number;
  };
  skills: ClassSkill[];
  milestoneSkills?: MilestoneWeaponSkill[];
  availablePerks?: WeaponMasteryPerk[];
}

export type ElementalSynergyType = 'shatter' | 'firestorm' | 'chain_discharge' | 'overcharge' | 'void_collapse';

export interface ElementalSynergyEvent {
  type: ElementalSynergyType;
  name: string;
  color: string;
  damage: number;
  x: number;
  y: number;
  z: number;
  targetCount: number;
}

export interface BossTelegraph {
  id: string;
  sourceMobId: string;
  sourceName?: string;
  type: 'circle' | 'cone' | 'rectangle';
  x: number;
  y: number;
  z: number;
  radius: number;
  angle?: number;
  arcAngle?: number;
  length?: number;
  width?: number;
  castTime: number;
  totalCastTime: number;
  damage: number;
  skillName: string;
  color: string;
}

export interface CombatLogEntry {
  id: string;
  timestamp: string;
  type: 'damage_dealt' | 'damage_taken' | 'heal' | 'synergy' | 'dodge' | 'telegraph_avoid';
  text: string;
  color: string;
  value?: number;
  isCrit?: boolean;
}

export interface DPSMeterStats {
  currentDps: number;
  peakDps: number;
  currentDtps: number;
  totalDamageDone: number;
  totalDamageTaken: number;
  combatDurationSec: number;
  inCombat: boolean;
  critRate: number;
  synergyTriggers: number;
  recentLogs: CombatLogEntry[];
}

export interface ArmorMastery {
  type: ArmorType;
  name: string;
  level: number;
  xp: number;
  maxXp: number;
  icon: string;
  color: string;
  description: string;
  bonusStats: {
    armor: number;
    health: number;
    dodgeChance: number;
  };
}

export interface RPGItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: ItemRarity;
  slot: ItemSlot;
  weaponType?: WeaponType;
  armorType?: ArmorType;
  material?: ItemMaterial;
  levelReq: number;
  classReq?: CharacterClassId;
  quantity?: number;
  stats: {
    attack?: number;
    spellPower?: number;
    armor?: number;
    maxHp?: number;
    maxResource?: number;
    critChance?: number; // %
    moveSpeed?: number;  // %
    dodgeChance?: number; // %
  };
  valueGold: number;
  effectDescription?: string;
  glbModelId?: string;
  glbModelUrl?: string;
  isGlbModel?: boolean;
}

export interface ClassSkill {
  id: string;
  name: string;
  icon: string;
  description: string;
  keybind: string;
  cooldown: number; // in seconds
  currentCooldown: number;
  resourceCost: number;
  resourceType: 'steam' | 'mana' | 'energy' | 'heat';
  range: number;
  damage: number;
  aoeRadius?: number;
  castTime?: number;
  type: 'melee' | 'projectile' | 'aoe' | 'buff' | 'utility' | 'turret';
  color: string;
}

export interface ClassDefinition {
  id: CharacterClassId;
  name: string;
  title: string;
  description: string;
  primaryRole: string;
  icon: string;
  color: string;
  resourceName: string;
  resourceType: 'steam' | 'mana' | 'energy' | 'heat';
  resourceColor: string;
  baseHp: number;
  baseResource: number;
  baseAttack: number;
  baseSpellPower: number;
  baseArmor: number;
  skills: ClassSkill[];
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  resource: number;
  maxResource: number;
  resourceName: string;
  resourceColor: string;
  level: number;
  xp: number;
  maxXp: number;
  xpToNextLevel: number;
  gold: number;
  politicsLevel: number;
  politicsXp: number;
  attackPower: number;
  spellPower: number;
  armor: number;
  critChance: number;
  dodgeChance: number;
  moveSpeed: number;
  moveSpeedMultiplier: number;
  isMounted: boolean;
  activeMountName: string;
  score: number;
  kills: number;
  bossKills: number;
  currentZone: string;
  x: number;
  y: number;
  z: number;
  facingAngle?: number;
  // RuneScape-style Attribute Stat Point Allocation
  statPoints: number;
  attributes: CharacterAttributes;
  // Open Classless Weapon & Armor Mastery Progression
  activeWeaponType: WeaponType;
  weaponMasteries: Record<WeaponType, WeaponMastery>;
  armorMasteries: Record<ArmorType, ArmorMastery>;
  equippedSkills: ClassSkill[];
  unlockedMilestoneSkills: string[];
  totalMasteryLevel: number;
  // Longterm Endlich / Endgame Ascension (Paragon / Transcendent Level) Progression
  ascensionLevel: number; // 0 if level < 100, 1..∞ once base level 100 achieved
  ascensionXp: number;
  ascensionMaxXp: number;
  ascensionPoints: number; // Transcendent celestial resonance points to allocate
  ascensionTalents: Record<string, number>;
  prestigeTitle: string;
  // Handwerk & Berufe Progression
  professions?: Record<ProfessionId, ProfessionSkill>;
}

export type EntityFsmState = 'idle' | 'patrolling' | 'combat' | 'fleeing' | 'evading' | 'dead';
export type NPCFsmState = 'idle' | 'patrolling' | 'interacting' | 'alert';

export interface AscensionTalent {
  id: string;
  name: string;
  category: 'power' | 'defense' | 'utility' | 'celestial';
  description: string;
  icon: string;
  color: string;
  currentRank: number;
  maxRank: number;
  statBonusPerRank: string;
}

export interface MysticFlowerWell {
  id: string;
  name: string;
  germanName: string;
  zone: string;
  kingdom: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  bloomState: 'radiant' | 'aether_surge' | 'blooming' | 'dormant';
  buffEffect: string;
  color: string;
  icon: string;
  description: string;
}

export interface EnemySpawnPoint {
  id: string;
  name: string;
  germanName: string;
  zone: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  mobType: string;
  mobName: string;
  dangerLevel: 'low' | 'moderate' | 'high' | 'skull';
  recommendedLevel: number;
  icon: string;
  respawnRateSeconds: number;
}

export interface EquipmentState {
  weapon: RPGItem | null;
  shield: RPGItem | null;
  offhand?: RPGItem | null;
  helmet: RPGItem | null;
  head?: RPGItem | null;
  shoulders: RPGItem | null;
  chest: RPGItem | null;
  arms: RPGItem | null;
  gloves?: RPGItem | null;
  legs: RPGItem | null;
  boots: RPGItem | null;
  shoes?: RPGItem | null;
  cape: RPGItem | null;
  relic: RPGItem | null;
  ring?: RPGItem | null;
  amulet?: RPGItem | null;
  mount: RPGItem | null;
}

export interface LootDropEntity {
  id: string;
  item: RPGItem;
  x: number;
  y: number;
  z: number;
  goldAmount: number;
  rarity: ItemRarity;
  beamColor: string;
  spawnTime: number;
}

export interface WorldMobEntity {
  id: string;
  name: string;
  type: 'clockwork_stalker' | 'corrupted_golem' | 'aether_wisp' | 'steam_drake' | 'centurion_elite' | 'titan_boss';
  level: number;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  z: number;
  spawnX: number;
  spawnZ: number;
  radius: number;
  attackRange: number;
  damage: number;
  expReward: number;
  goldReward: number;
  isAggroed: boolean;
  isBoss: boolean;
  isElite: boolean;
  patrolAngle: number;
  attackCooldown: number;
  maxAttackCooldown: number;
  dropTable: RPGItem[];
  color: string;
  castProgress?: number; // for boss telegraphed skills
  castSkillName?: string;
  fsmState?: EntityFsmState;
  aggroTable?: Record<string, number>; // Maps entity ID (player/party) to aggro amount
  targetId?: string | null;
  targetName?: string;
  fightStartX?: number; // Starting coordinate where fight engaged
  fightStartZ?: number;
  topThreat?: number;
}

export interface SimulatedPlayer {
  id: string;
  name: string;
  className: string;
  classId: CharacterClassId;
  level: number;
  x: number;
  y: number;
  z: number;
  targetMobId?: string;
  action: 'patrolling' | 'fighting' | 'resting' | 'riding';
  guildTag: string;
  avatarIcon?: string;
  role?: 'tank' | 'healer' | 'dps';
  hp?: number;
  maxHp?: number;
  resource?: number;
  maxResource?: number;
  isLeader?: boolean;
  inCombat?: boolean;
  zone?: string;
}

export interface PartyMember {
  id: string;
  name: string;
  classId: CharacterClassId;
  className: string;
  level: number;
  hp: number;
  maxHp: number;
  resource: number;
  maxResource: number;
  resourceName: string;
  resourceColor: string;
  isLeader: boolean;
  avatarIcon: string;
  zone: string;
  isOnline: boolean;
  dps: number;
  isPlayer?: boolean;
  inCombat?: boolean;
}

export interface DayNightInfo {
  timeOfDay: number; // 0.0 to 24.0
  formattedTime: string;
  phase: 'dawn' | 'day' | 'dusk' | 'night';
  phaseName: string;
  icon: string;
  sunIntensity: number;
  skyColorHex: string;
}


export interface Quest {
  id: string;
  title: string;
  giverName: string;
  giverZone: string;
  lore: string;
  description?: string;
  objective: string;
  targetCount: number;
  currentCount: number;
  rewardXp: number;
  rewardGold: number;
  rewardItem?: RPGItem;
  completed: boolean;
  type: 'kill_mobs' | 'kill_boss' | 'collect_loot' | 'explore_zone' | 'level_up' | 'tame_pet' | 'build_house';
  targetMobType?: string;
  loreChapter?: 'sonnen_spitze' | 'aschen_gewoelbe' | 'windhaine' | 'aethelgard_krieg' | 'reichs_chronik';
  chapterName?: string;
  chronicleSummary?: string;
  completedAt?: string;
}

export type NPCRole =
  | 'grand_artificer'
  | 'archmage'
  | 'guard_captain'
  | 'wandering_trader'
  | 'beast_tamer'
  | 'homestead_architect'
  | 'outlaw_informant'
  | 'tavern_keeper'
  | 'auktionator'
  | 'auctioneer'
  | 'Territory Envoy'
  | 'Guard';

export interface WorldBossRecord {
  id: string;
  name: string;
  title: string;
  zone: string;
  level: number;
  maxHp: number;
  icon: string;
  color: string;
  coords: { x: number; z: number };
  respawnIntervalSec: number;
  lastDefeatedTimestamp: number | null; // epoch ms or null if never defeated / alive
  defeatCount: number;
  lastSlayerName?: string;
  rareDrops: string[];
  status: 'alive' | 'respawning' | 'dormant';
}

export interface SoldBuybackItem {
  id: string;
  item: RPGItem;
  soldPrice: number;
  soldAtTimestamp: number;
  soldToNpcId?: string;
  soldToHubId?: string;
}

export interface NPCReactionLogic {
  baseAggroThreshold?: number; // Rep below this threshold triggers defensive/hostile behavior
  retaliateOnAttack?: boolean; // Whether NPC will draw weapon / alert guards when struck
  tradeAffinityMultiplier?: number; // Multiplier for reputation gain during commerce
  crimeTolerance?: 'zero' | 'low' | 'moderate' | 'high'; // Tolerance to rogue actions
  hostileThreshold?: number; // e.g. < -20 triggers hostile dialogue & hostility
  friendlyThreshold?: number; // e.g. > 30 triggers friendly perks & discounts
  exaltedThreshold?: number; // e.g. > 70 triggers heroic acknowledgement
  onAttackedDialogue?: string[]; // Dynamic dialogue lines injected when attacked
  onTradeDialogue?: string[]; // Dynamic dialogue lines injected on successful trades
  onCrimeWitnessedDialogue?: string[]; // Dialogue when observing player theft or crimes
  reputationChangeOnAttack?: number; // Custom rep penalty (default -25)
  reputationChangeOnTrade?: number; // Custom rep bonus (default +8)
  onEvent?: (
    event: 'attack' | 'trade' | 'crime' | 'chat',
    npc: NPCCharacter,
    details?: { amount?: number; itemName?: string; damage?: number; isHostile?: boolean }
  ) => void;
}

export interface NPCInteractionFrequency {
  totalInteractions: number;
  lastInteractionTimestamp: number;
  interactionIntervalsAvgMs: number;
  velocityCategory: 'frequent' | 'occasional' | 'rare' | 'first_contact';
  friendlyStreak: number;
  aggressiveStreak: number;
}

export interface NPCEmotionalContext {
  friendlyScore: number;
  aggressiveScore: number;
  dominantTone: 'friendly' | 'aggressive' | 'neutral';
  lastEmote?: string;
}

export type NPCDefensivePosture = 'PEACEFUL' | 'GUARDED' | 'DEFENSIVE' | 'HOSTILE_STANCE' | 'HEROIC_SALUTE';

export interface NPCRelationshipMemory {
  reputation: number; // -100 (Hostile / Criminal) to +100 (Exalted Hero)
  affectionRating?: number; // -100 (Bitter / Enemy) to +100 (Adored / Heroic)
  timesInteracted: number;
  tradesCompleted: number;
  crimesWitnessed: number;
  attacksSuffered?: number;
  totalGoldTraded?: number;
  lastEvent?: 'attack' | 'trade' | 'crime' | 'chat' | 'quest';
  lastEventTimestamp?: number;
  lastConversationTimestamp?: string;
  personalNotes?: string;
  dynamicDialogueHistory?: string[];
  customFlags?: Record<string, string | number | boolean>;
  interactionFrequency?: NPCInteractionFrequency;
  emotionalContext?: NPCEmotionalContext;
  defensivePosture?: NPCDefensivePosture;
  activeDiscountPercent?: number; // negative number is discount (e.g. -20%), positive is markup (e.g. +30%)
}

export interface NPCCharacter {
  id: string;
  name: string;
  title: string;
  zone: string;
  role?: NPCRole;
  x: number;
  y: number;
  z: number;
  dialogue: string[];
  quests: Quest[];
  shopItems?: RPGItem[];
  color: string;
  faction?: 'Kingdom of Aethelgard' | 'Clockwork Artisans' | 'Aether Circle' | 'Outlaw Syndicate';
  familyMembers?: string[];
  mood?: 'ecstatic' | 'friendly' | 'neutral' | 'suspicious' | 'hostile';
  memory?: NPCRelationshipMemory;
  reactionLogic?: NPCReactionLogic;
  affectionRating?: number; // -100 to +100
  interactionFrequency?: NPCInteractionFrequency;
  emotionalContext?: NPCEmotionalContext;
  defensivePosture?: NPCDefensivePosture;
  activeDiscountPercent?: number;
  sellPets?: CompanionPet[];
  houseBlueprints?: HomesteadBlueprint[];
  fsmState?: NPCFsmState;
}

export interface CompanionPet {
  id: string;
  name: string;
  species: 'clockwork_hound' | 'steam_drake' | 'aether_wisp' | 'golden_gryphon';
  level: number;
  bonusAttack: number;
  bonusSpeed: number;
  loyalty: number; // 0 to 100
  priceGold: number;
  color: string;
  icon: string;
  description: string;
}

export interface HomesteadBlueprint {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  costGold: number;
  woodRequired: number;
  stoneRequired: number;
  description: string;
  perks: string;
  unlocked: boolean;
}

export interface CharacterAppearance {
  name: string;
  gender: 'male' | 'female' | 'nonbinary';
  bodyType: 'standard' | 'athletic' | 'stout' | 'tall';
  hairStyle: 'classic' | 'spiky' | 'braids' | 'goggles_bob' | 'shaved';
  hairColor: string;
  skinTone: string;
  armorTint: string;
  startingProfession: 'vanguard' | 'wandering_trader' | 'pet_tamer' | 'iron_guard' | 'outlaw_scout';
  faction: 'Kingdom of Aethelgard' | 'Clockwork Artisans' | 'Aether Circle' | 'Outlaw Syndicate';
}

export interface GMWorldConfig {
  godMode: boolean;
  infiniteResources: boolean;
  spawnMobType: WorldMobEntity['type'];
  weatherState: 'clear_sun' | 'blood_moon' | 'aether_aurora' | 'steampunk_fog' | 'void_storm';
  timeOfDay: number; // 0 to 24
  mobSpawnMultiplier: number;
  ambientParticles: boolean;
}

export interface ChatMessage {
  id: string;
  channel: 'all' | 'party' | 'guild' | 'system' | 'say' | 'whisper';
  sender: string;
  senderClass?: string;
  text: string;
  timestamp: string;
  isPlayer?: boolean;
}

export interface FloatingCombatText {
  id: string;
  text: string;
  x: number;
  y: number;
  z?: number;
  screenX?: number; // 0-100 percentage
  screenY?: number; // 0-100 percentage
  color: string;
  size: 'sm' | 'md' | 'lg' | 'xl';
  opacity: number;
  lifespan: number;
  vy: number;
  isCrit?: boolean;
  type?: 'damage' | 'crit' | 'heal' | 'combo' | 'player_damage' | 'system' | 'exp' | 'mastery';
  icon?: string;
}

export type ComboRank = 'NORMAL' | 'AETHER' | 'TEMPEST' | 'TITAN' | 'AURION';

export interface ComboState {
  count: number;
  maxCombo: number;
  timer: number;
  maxTimer: number;
  totalDamage: number;
  multiplier: number;
  rank: ComboRank;
  rankName: string;
  rankColor: string;
  activeWeaponType: WeaponType;
  lastHitTime: number;
  recentHits: number;
}

export interface DirectionalDamageIndicator {
  id: string;
  angleRad: number; // relative to camera view / player orientation (-PI to PI; 0 = top/front, PI/2 = right, PI/-PI = bottom/back, -PI/2 = left)
  damage: number;
  lifespan: number;
  maxLifespan: number;
  opacity: number;
  isCrit?: boolean;
  sourceType?: 'mob' | 'hazard' | 'projectile' | 'boss';
  sourceName?: string;
  color?: string;
}

export interface ArchiveFile {
  path: string;
  language: 'typescript' | 'javascript' | 'glsl' | 'python' | 'html' | 'markdown' | 'json';
  description: string;
  content: string;
}

// --- Solid Obstacles & Collision System Types ---
export type SolidObstacleType =
  | 'tree'
  | 'building'
  | 'tower'
  | 'wall'
  | 'rock'
  | 'mound'
  | 'dungeon_gate'
  | 'monolith'
  | 'furnace'
  | 'anvil'
  | 'fountain'
  | 'streetlamp'
  | 'border_stone'
  | 'ruin_pillar'
  | 'homestead_building'
  | 'homestead_wall';

export interface SolidObstacle {
  id: string;
  type: SolidObstacleType;
  x: number;
  z: number;
  radius: number;
  height?: number;
  name?: string;
  chunkKey?: string;
}

export type BiomeType =
  | 'sanctum_capital'
  | 'clockwork_woods'
  | 'scorched_quarry'
  | 'void_crater'
  | 'whispering_forest'
  | 'emberfall_march'
  | 'sunwatch_bastion'
  | 'ancient_dungeon'
  | 'frontier_border';

export type LandmarkType =
  | 'forest'
  | 'city'
  | 'dungeon'
  | 'border'
  | 'quarry'
  | 'sanctum';

export interface WorldChunkData {
  chunkKey: string; // e.g. "0,0", "1,-1"
  chunkX: number;
  chunkZ: number;
  centerX: number;
  centerZ: number;
  size: number; // e.g. 80 meters
  biome: BiomeType;
  kingdom: string;
  landmarkType: LandmarkType;
  landmarkName: string;
  elevationBase: number;
  materialTheme: 'grass' | 'flower_meadow' | 'earth' | 'farmland' | 'garden_parcels' | 'starpath' | 'starpath_crossing';
  obstacles: SolidObstacle[];
  resourceDensity?: Record<string, number>;
  featureDescription: string;
  createdAt: string;
}

export interface WorldExpansionStats {
  totalChunks: number;
  totalAreaSqMeters: number;
  targetMaxPlayers: number;
  discoveredKingdoms: string[];
  activeLandmarks: { name: string; type: LandmarkType; kingdom: string; x: number; z: number }[];
  currentChunkKey: string;
  currentKingdom: string;
  currentLandmark: string;
}

export interface MultiplayerNetStats {
  connected: boolean;
  pingMs: number;
  onlinePlayers: number;
  playerId: string;
}

export interface ActiveBuffSummary {
  id: string;
  name: string;
  icon: string;
  color: string;
  duration: number;
  stacks: number;
}

export interface EnginePerformanceMetrics {
  fps: number;
  lodStats: {
    highCount: number;
    mediumCount: number;
    lowCount: number;
    culledCount: number;
    totalTracked: number;
  };
  simulationStats?: {
    tickRate: number;
    currentTick: number;
    reconciledCount: number;
    pendingPredictions: number;
    occludedObjects: number;
    activeBallistics: number;
  };
  weatherState?: {
    name: string;
    type: string;
    combatBuffDescription: string;
    timeRemainingSec: number;
  };
  deltaWorkerStats?: {
    lastSnapshotTimestamp: number;
    totalSnapshots: number;
    status: 'idle' | 'syncing' | 'saved' | 'error';
    lastPayloadBytes: number;
    nextSnapshotInSec: number;
  };
}

export * from './types/guild';



export interface ResourceNode {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  z: number;
  resourceItemId: string;
  requiredProfession: GatheringProfessionId;
  requiredToolCategory: string; // e.g. 'Pickaxe'
  amount: number;
  respawnTimeSeconds: number;
  isDepleted: boolean;
  color: string;
}
