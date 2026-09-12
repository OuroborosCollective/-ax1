import fs from 'fs';
let code = fs.readFileSync('src/core/MMOEngine.ts', 'utf8');

// replace Math.random() with deterministicRng.random() globally in MMOEngine.ts
code = code.replace(/Math\.random\(\)/g, 'deterministicRng.random()');

fs.writeFileSync('src/core/MMOEngine.ts', code);
