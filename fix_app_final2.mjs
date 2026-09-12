import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /<GameHUD\n\s+playerStats=\{stats\}\n\s+currentClassId=\{currentClassId\}/m;
const patch = `<GameHUD
          playerStats={stats}
          currentClassId={currentClassId}
          health={stats.hp}
          maxHealth={stats.maxHp}
          mana={stats.mp}
          maxMana={stats.maxMp}
          simPlayers={simPlayers || []}`;

code = code.replace(regex, patch);
fs.writeFileSync('src/App.tsx', code);

