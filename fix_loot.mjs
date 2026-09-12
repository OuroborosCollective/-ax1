import fs from 'fs';
let code = fs.readFileSync('src/core/MMOEngine.ts', 'utf8');

// The replacement logic: we need to find all occurrences of:
// obs.loots.forEach(lootId => {
//    this.player.inventory[lootId] = (this.player.inventory[lootId] || 0) + 1;
//    this.addChatMessage('system', 'Loot', \`\${obs.name} zerstört. +1 \${lootId} erhalten.\`);
// });
// this.triggerGameEvent('inventory_update', this.player.inventory);

// and replace it with:
// obs.loots.forEach(lootId => {
//    this.player.inventory.push({ id: \`\${lootId}_\${Date.now()}_\${Math.random()}\`, name: lootId, type: 'material', rarity: 'common', description: 'Gathered material', icon: '📦', stats: {}, valueGold: 1 });
//    this.addChatMessage('system', 'Loot', \`\${obs.name} zerstört. +1 \${lootId} erhalten.\`);
// });

const targetA = `                   obs.loots.forEach(lootId => {
                      this.player.inventory[lootId] = (this.player.inventory[lootId] || 0) + 1;
                      this.addChatMessage('system', 'Loot', \\\`\\$\\{obs.name\\} zerstört. +1 \\$\\{lootId\\} erhalten.\\\`);
                   });
                   this.triggerGameEvent('inventory_update', this.player.inventory);`;

const repA = `                   obs.loots.forEach(lootId => {
                      this.player.inventory.push({ id: \`\${lootId}_\${Date.now()}_\${deterministicRng.random()}\`, name: lootId, type: 'material', rarity: 'common', description: 'Gathered material', icon: '📦', stats: {}, valueGold: 1 } as any);
                      this.addChatMessage('system', 'Loot', \`\${obs.name} zerstört. +1 \${lootId} erhalten.\`);
                   });`;

// Wait, the backticks in the replacement string can be tricky. Let's use regex instead of literal strings for safety.

code = code.replace(/this\.player\.inventory\[lootId\] = \(this\.player\.inventory\[lootId\] \|\| 0\) \+ 1;/g, 
  "this.player.inventory.push({ id: `${lootId}_${Date.now()}_${deterministicRng.random()}`, name: lootId, type: 'material', rarity: 'common', description: 'Gathered material', icon: '📦', stats: {}, valueGold: 1 } as any);");
  
code = code.replace(/this\.triggerGameEvent\('inventory_update', this\.player\.inventory\);/g, "");

fs.writeFileSync('src/core/MMOEngine.ts', code);
