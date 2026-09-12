const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');
code = code.replace(
  '  name?: string;',
  `  name?: string;\n  hp?: number;\n  maxHp?: number;\n  isDestroyable?: boolean;\n  respawnTime?: number;\n  loots?: string[];`
);
fs.writeFileSync('src/types.ts', code);
