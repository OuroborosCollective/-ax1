import fs from 'fs';
let code = fs.readFileSync('src/core/MMOEngine.ts', 'utf8');

code = code.replace(/deterministicRng\.random\(\)/g, 'deterministicRng.nextFloat()');

fs.writeFileSync('src/core/MMOEngine.ts', code);
