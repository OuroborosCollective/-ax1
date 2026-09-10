import fs from 'fs';

const path = 'src/data/mmorpgData.ts';
let code = fs.readFileSync(path, 'utf8');

// Insert DEFAULT_ARMOR_MASTERIES
const armorMasteriesStr = `
export const DEFAULT_ARMOR_MASTERIES: Record<ArmorType, ArmorMastery> = {
  shoulder: { type: 'shoulder', name: 'Shoulder Armor Mastery', level: 1, xp: 0, maxXp: 120, icon: '🛡️', color: '#64748b', description: 'Mastery of shoulder armor.', bonusStats: { armor: 0, health: 0, dodgeChance: 0 } },
  bracers: { type: 'bracers', name: 'Bracer Mastery', level: 1, xp: 0, maxXp: 120, icon: '🛡️', color: '#64748b', description: 'Mastery of arm guards.', bonusStats: { armor: 0, health: 0, dodgeChance: 0 } },
  gloves: { type: 'gloves', name: 'Glove Mastery', level: 1, xp: 0, maxXp: 120, icon: '🧤', color: '#64748b', description: 'Mastery of gloves.', bonusStats: { armor: 0, health: 0, dodgeChance: 0 } },
  chest: { type: 'chest', name: 'Chestpiece Mastery', level: 1, xp: 0, maxXp: 120, icon: '🛡️', color: '#64748b', description: 'Mastery of chest armor.', bonusStats: { armor: 0, health: 0, dodgeChance: 0 } },
  shoes: { type: 'shoes', name: 'Shoe Mastery', level: 1, xp: 0, maxXp: 120, icon: '🥾', color: '#64748b', description: 'Mastery of shoes.', bonusStats: { armor: 0, health: 0, dodgeChance: 0 } },
  legs: { type: 'legs', name: 'Legging Mastery', level: 1, xp: 0, maxXp: 120, icon: '👖', color: '#64748b', description: 'Mastery of leg armor.', bonusStats: { armor: 0, health: 0, dodgeChance: 0 } },
  helmet: { type: 'helmet', name: 'Helmet Mastery', level: 1, xp: 0, maxXp: 120, icon: '🪖', color: '#64748b', description: 'Mastery of helmets.', bonusStats: { armor: 0, health: 0, dodgeChance: 0 } },
  cape: { type: 'cape', name: 'Cape Mastery', level: 1, xp: 0, maxXp: 120, icon: '🧥', color: '#64748b', description: 'Mastery of capes.', bonusStats: { armor: 0, health: 0, dodgeChance: 0 } },
};
`;

if (!code.includes('DEFAULT_ARMOR_MASTERIES')) {
  code = code.replace(/export const DEFAULT_WEAPON_MASTERIES: Record<WeaponType, WeaponMastery> = \{/, armorMasteriesStr + '\nexport const DEFAULT_WEAPON_MASTERIES: Record<WeaponType, WeaponMastery> = {');
}

// Ensure all weapon masteries are defined
const newWeapons = ['scythe', 'battleaxe', 'warhammer', 'daggers', 'bow', 'staff', 'wand', 'knuckles', 'spear', 'greatsword'];
const weaponMasteriesRegex = /export const DEFAULT_WEAPON_MASTERIES: Record<WeaponType, WeaponMastery> = \{([\s\S]*?)\};\n\nexport const/g;
let match = weaponMasteriesRegex.exec(code);

if (match) {
  let masteriesBlock = match[1];
  let additions = '';
  newWeapons.forEach(w => {
    if (!masteriesBlock.includes(`  ${w}: {`)) {
      additions += `\n  ${w}: {\n    type: '${w}',\n    name: '${w.charAt(0).toUpperCase() + w.slice(1)} Mastery',\n    level: 1,\n    xp: 0,\n    maxXp: 120,\n    icon: '⚔️',\n    color: '#e2e8f0',\n    description: 'Mastery of the ${w}.',\n    scalingAttr: '+Attack Power',\n    bonusStats: { attack: 0, critChance: 0 },\n    skills: []\n  },`;
    }
  });
  if (additions) {
    let newBlock = masteriesBlock + additions;
    code = code.replace(match[1], newBlock);
  }
}

// Write it back
fs.writeFileSync(path, code);

console.log("Updated masteries");

