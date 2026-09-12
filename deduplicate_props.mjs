import fs from 'fs';
let code = fs.readFileSync('src/components/GameHUD.tsx', 'utf8');

const targetStr = `  maxHealth,
  mana,
  maxMana,
  onOpenInventory,
  onOpenCharacter,
  onOpenClasses,
  onOpenQuestLog,
  onOpenMap,
  onOpenParty,
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
  onSendMessage,`;

const replacement = `  maxHealth,
  mana,
  maxMana,
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
  onSendMessage,`;

code = code.replace(targetStr, replacement);
fs.writeFileSync('src/components/GameHUD.tsx', code);
