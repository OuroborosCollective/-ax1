import fs from 'fs';

const path = 'src/entities/OpenWorldPlayer.ts';
let code = fs.readFileSync(path, 'utf8');

// Inside takeDamage, right after stats calculation, we should award armor mastery xp
const insertXp = `
    // Award Armor Mastery XP for equipped armor pieces when taking damage
    const armors: (keyof typeof this.equipment)[] = ['shoulders', 'arms', 'gloves', 'chest', 'legs', 'boots', 'helmet', 'cape'];
    armors.forEach(slot => {
      const item = this.equipment[slot];
      if (item && item.armorType) {
        this.gainArmorMasteryXp(item.armorType, Math.max(1, Math.floor(damageTaken * 0.1)));
      }
    });
`;

if (!code.includes('Award Armor Mastery XP')) {
  // Find where HP is reduced
  code = code.replace(/(this\.stats\.hp -= damageTaken;)/, '$1' + insertXp);
}

// Add ArmorType import
if (!code.includes('ArmorType')) {
  code = code.replace(/import \{([\s\S]*?)CharacterClassId/m, 'import { ArmorType, $1CharacterClassId');
}

fs.writeFileSync(path, code);
