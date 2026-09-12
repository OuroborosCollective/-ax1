import fs from 'fs';
let code = fs.readFileSync('src/components/GameHUD.tsx', 'utf8');

const targetStr = `  maxHealth,
  mana,
  maxMana,`;

const replacement = `  currentClassId,
  maxHealth,
  mana,
  maxMana,`;

code = code.replace(targetStr, replacement);

const targetInterface = `  playerStats: PlayerStats;
  health: number;
  maxHealth: number;`;

const replacementInterface = `  playerStats: PlayerStats;
  currentClassId: CharacterClassId;
  health: number;
  maxHealth: number;`;

code = code.replace(targetInterface, replacementInterface);
fs.writeFileSync('src/components/GameHUD.tsx', code);
