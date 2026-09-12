import fs from 'fs';
let code1 = fs.readFileSync('src/components/AuctionHouseModal.tsx', 'utf8');

// Replace engine.player.name with just 'Hero' since OpenWorldPlayer doesn't have a name property yet
code1 = code1.replace(/engine\.player\.name \|\| 'Hero'/g, "'Hero'");
fs.writeFileSync('src/components/AuctionHouseModal.tsx', code1);

let code2 = fs.readFileSync('src/components/GameHUD.tsx', 'utf8');

// Add the missing props to GameHUDProps interface
const interfacePatch = `  playerStats: PlayerStats;
  currentClassId: CharacterClassId;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  targetMob: WorldMobEntity | null;
  nearbyNPC: NPCCharacter | null;
  nearbyLoot: LootDropEntity | null;
  quests: Quest[];
  chatMessages: ChatMessage[];
  floatingTexts: FloatingCombatText[];
  simPlayers: SimulatedPlayer[];
  partyMembers: PartyMember[];
  dayNightInfo?: DayNightInfo;
  netStats: MultiplayerNetStats;
  activeBuffs: ActiveBuffSummary[];
  engineMetrics: EnginePerformanceMetrics;
  facingAngle?: number;
  cameraYaw?: number;
  activeMobs?: WorldMobEntity[];
  npcs?: NPCCharacter[];
  comboState?: ComboState;
  directionalIndicators?: any;
  dpsMeterStats?: any;
  combatLogs?: any;
  onCycleTarget?: () => void;
  onToggleMount: () => void;
  onTriggerDodge?: () => void;
  onVirtualMove?: (x: number, y: number) => void;
  onCastSkill?: (index: number) => void;`;

code2 = code2.replace(/  playerStats: PlayerStats;\n  currentClassId: CharacterClassId;\n  health: number;\n  maxHealth: number;/g, interfacePatch);

// Add missing icon import
if (!code2.includes('Coins')) {
  code2 = code2.replace(/import \{ /, "import { Coins, ");
}

fs.writeFileSync('src/components/GameHUD.tsx', code2);
