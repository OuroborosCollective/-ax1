import fs from 'fs';

const path = 'src/components/CharacterModal.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace the hardcoded array with Object.values(stats.weaponMasteries) mapping
const weaponMappingReplacement = `
                Object.values(stats.weaponMasteries || {}).map((mastery) => {
                  const wep = mastery;
                  const isSelected = selectedWeaponTab === wep.type;
                  const rank = mastery?.level || 1;
`;
code = code.replace(/\[[\s\S]*?\] as \{ type: WeaponType; name: string; icon: string; color: string \}\[\s*\]\n\s*\)\.map\(\(wep\) => \{\n\s*const isSelected = selectedWeaponTab === wep\.type;\n\s*const mastery = stats\.weaponMasteries\?\.\[wep\.type\];\n\s*const rank = mastery\?\.level \|\| 1;/m, weaponMappingReplacement);

fs.writeFileSync(path, code);
