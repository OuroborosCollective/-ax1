import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /mana=\{stats\.mp\}\n\s+maxMana=\{stats\.maxMp\}/m;
const patch = `mana={stats.resource}
          maxMana={stats.maxResource}`;

code = code.replace(regex, patch);
fs.writeFileSync('src/App.tsx', code);
