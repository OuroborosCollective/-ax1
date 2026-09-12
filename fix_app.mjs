import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

// We need to pass the missing properties into the GameHUD component inside App.tsx
const targetStr = `        <GameHUD
          playerStats={gameState.stats}
          currentClassId={gameState.currentClassId || 'warrior'}`;

const patchStr = `        <GameHUD
          playerStats={gameState.stats}
          currentClassId={gameState.currentClassId || 'warrior'}
          health={gameState.stats.hp}
          maxHealth={gameState.stats.maxHp}
          mana={gameState.stats.mp}
          maxMana={gameState.stats.maxMp}
          simPlayers={gameState.simPlayers || []}`;

code = code.replace(targetStr, patchStr);

fs.writeFileSync('src/App.tsx', code);

// And we need to fix the SimulatedPlayer import in GameHUD.tsx
let hudCode = fs.readFileSync('src/components/GameHUD.tsx', 'utf8');
if (!hudCode.includes('SimulatedPlayer')) {
   hudCode = hudCode.replace("import {", "import {\n  SimulatedPlayer,\n");
   fs.writeFileSync('src/components/GameHUD.tsx', hudCode);
}

