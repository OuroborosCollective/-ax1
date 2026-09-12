import fs from 'fs';
let code = fs.readFileSync('src/core/MMOEngine.ts', 'utf8');

code = code.replace(/speed: skill\.speed \|\| 15,/g, "speed: (skill as any).speed || 15,");

fs.writeFileSync('src/core/MMOEngine.ts', code);
