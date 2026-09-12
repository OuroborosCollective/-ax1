import fs from 'fs';
let code = fs.readFileSync('src/components/GameHUD.tsx', 'utf8');

// replace w-8 h-8 with w-11 h-11 on mobile, and keep sm:w-10 sm:h-10
code = code.replace(/w-8 h-8 sm:w-10 sm:h-10/g, 'w-11 h-11 sm:w-10 sm:h-10');

fs.writeFileSync('src/components/GameHUD.tsx', code);
