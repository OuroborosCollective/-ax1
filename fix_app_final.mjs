import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /<GameHUD\n\s+playerStats=\{gameState\.stats\}\n\s+currentClassId=\{gameState\.currentClassId \|\| 'warrior'\}/m;
const patch = `<GameHUD
          playerStats={gameState.stats}
          currentClassId={gameState.currentClassId || 'warrior'}
          health={gameState.stats.hp}
          maxHealth={gameState.stats.maxHp}
          mana={gameState.stats.mp}
          maxMana={gameState.stats.maxMp}
          simPlayers={gameState.simPlayers || []}`;

code = code.replace(regex, patch);
fs.writeFileSync('src/App.tsx', code);

// Fix the SimulatedPlayer type in types.ts export or GameHUD import
let code2 = fs.readFileSync('src/components/GameHUD.tsx', 'utf8');
code2 = code2.replace(/  SimulatedPlayer,\n/, ''); // remove from first block if added
code2 = code2.replace(/  CombatLogEntry,\n\} from '\.\.\/types';/, "  CombatLogEntry,\n  SimulatedPlayer,\n} from '../types';");

fs.writeFileSync('src/components/GameHUD.tsx', code2);
