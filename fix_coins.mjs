import fs from 'fs';
let code = fs.readFileSync('src/components/GameHUD.tsx', 'utf8');
code = code.replace("import {", "import { Coins, ");
fs.writeFileSync('src/components/GameHUD.tsx', code);
