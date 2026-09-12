import fs from 'fs';
let code = fs.readFileSync('src/components/GameHUD.tsx', 'utf8');

// I need to add back all the destructured props that were removed by my previous deduping.
const propsSignatureRegex = /export const GameHUD: React\.FC<GameHUDProps> = \(\{[^\}]*\}\) => \{/m;

const replacement = `export const GameHUD: React.FC<GameHUDProps> = ({
  playerStats,
  currentClassId,
  health,
  maxHealth,
  mana,
  maxMana,
  targetMob,
  nearbyNPC,
  nearbyLoot,
  quests,
  chatMessages,
  floatingTexts,
  simPlayers,
  partyMembers,
  dayNightInfo,
  netStats,
  activeBuffs,
  engineMetrics,
  facingAngle,
  cameraYaw,
  activeMobs,
  npcs,
  comboState,
  directionalIndicators,
  dpsMeterStats,
  combatLogs,
  onToggleMount,
  onInteract,
  onOpenInventory,
  onOpenCrafting,
  onOpenDungeonFinder,
  onOpenAuctionHouse,
  onOpenCharacter,
  onOpenQuests,
  onOpenClasses,
  onOpenMap,
  onOpenParty,
  onOpenGuild,
  onOpenServerConsole,
  onOpenEconomy,
  onOpenDeterminismOverlay,
  onOpenHomestead,
  autoLootEnabled,
  onToggleAutoLoot,
  pityCounters,
  onSendMessage,
  onCycleTarget,
  onCastSkill,
}) => {`;

code = code.replace(propsSignatureRegex, replacement);

fs.writeFileSync('src/components/GameHUD.tsx', code);
