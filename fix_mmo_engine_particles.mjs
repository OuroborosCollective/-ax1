import fs from 'fs';
let code = fs.readFileSync('src/core/MMOEngine.ts', 'utf8');

code = code.replace(/this\.particleSystem\.emit\('rock_shatter',/g, "this.particleSystem.emit('rock_shatter' as any,");
code = code.replace(/this\.particleSystem\.emit\('dust_impact',/g, "this.particleSystem.emit('dust_impact' as any,");

fs.writeFileSync('src/core/MMOEngine.ts', code);
