import fs from 'fs';

let p = 'src/data/mmorpgData.ts';
let code = fs.readFileSync(p, 'utf8');

if (!code.includes('ArmorMastery')) {
  code = code.replace(/import \{([\s\S]*?)WeaponMastery/m, 'import { ArmorMastery, $1WeaponMastery');
}
if (!code.includes('ArmorType')) {
  code = code.replace(/import \{([\s\S]*?)WeaponType/m, 'import { ArmorType, $1WeaponType');
}

fs.writeFileSync(p, code);
