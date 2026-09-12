import fs from 'fs';
let code = fs.readFileSync('src/components/GameHUD.tsx', 'utf8');

const regex = /interface GameHUDProps \{[\s\S]*?playerStats: PlayerStats;[\s\S]*?currentClassId: CharacterClassId;/m;
const patch = `interface GameHUDProps {
  playerStats: PlayerStats;
  currentClassId: CharacterClassId;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  simPlayers: SimulatedPlayer[];`;

code = code.replace(regex, patch);

fs.writeFileSync('src/components/GameHUD.tsx', code);
