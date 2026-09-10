import fs from 'fs';

const path = 'src/data/mmorpgData.ts';
let code = fs.readFileSync(path, 'utf8');

const weapons = ['scythe', 'battleaxe', 'warhammer', 'daggers', 'bow', 'staff', 'wand', 'knuckles', 'spear', 'greatsword'];
const armors = ['shoulder', 'bracers', 'gloves', 'chest', 'shoes', 'legs', 'helmet', 'cape'];
const weaponMats = ['bronze', 'iron', 'steel'];
const armorMats = ['cloth', 'leather', 'bronze', 'iron', 'steel'];

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

let newItems = '';
let newRecipes = '';
let newResources = '';

// Let's create a raw resource and an ingot/leather/cloth for each
const rawMats = {
  cloth: { raw: 'cotton', node: 'Cotton Plant', tool: 'Sickle' },
  leather: { raw: 'hide', node: 'Beast Carcass', tool: 'Skinning Knife' },
  bronze: { raw: 'copper_tin_ore', node: 'Bronze Ore Vein', tool: 'Pickaxe' },
  iron: { raw: 'iron_ore', node: 'Iron Ore Vein', tool: 'Pickaxe' },
  steel: { raw: 'steel_ore', node: 'High-Yield Iron Vein', tool: 'Pickaxe' } // simplified
};

Object.keys(rawMats).forEach(mat => {
  const r = rawMats[mat];
  newResources += `
  'res_${r.raw}': { id: 'res_${r.raw}', name: '${capitalize(r.raw)}', description: 'Raw material.', icon: '📦', rarity: 'common', slot: 'material', levelReq: 1, stats: {}, valueGold: 1 },
  'mat_${mat}': { id: 'mat_${mat}', name: '${capitalize(mat)}', description: 'Refined material.', icon: '📜', rarity: 'uncommon', slot: 'material', levelReq: 1, stats: {}, valueGold: 5 },
`;
  newRecipes += `
  'rec_${mat}': { id: 'rec_${mat}', name: 'Refine ${capitalize(mat)}', createdItemId: 'mat_${mat}', requiredProfession: 'blacksmithing', requiredLevel: 1, materials: [{ itemId: 'res_${r.raw}', amount: 2 }], craftTimeSeconds: 1, expReward: 5 },
`;
});


// Generate Weapons
weaponMats.forEach((mat, mIdx) => {
  weapons.forEach(w => {
    let wName = `${capitalize(mat)} ${capitalize(w)}`;
    let id = `wep_${mat}_${w}`;
    let lvl = (mIdx * 10) + 1; // Bronze: 1, Iron: 11, Steel: 21
    newItems += `
  '${id}': { id: '${id}', name: '${wName}', description: 'A sturdy ${w}.', icon: '🗡️', rarity: 'common', slot: 'weapon', weaponType: '${w}', material: '${mat}', levelReq: ${lvl}, stats: { attack: ${lvl * 5} }, valueGold: ${lvl * 10} },
`;
    newRecipes += `
  'rec_${id}': { id: 'rec_${id}', name: 'Craft ${wName}', createdItemId: '${id}', requiredProfession: 'blacksmithing', requiredLevel: ${lvl}, materials: [{ itemId: 'mat_${mat}', amount: 3 }], craftTimeSeconds: 3, expReward: ${lvl * 10} },
`;
  });
});

// Generate Armors
armorMats.forEach((mat, mIdx) => {
  armors.forEach(a => {
    let aName = `${capitalize(mat)} ${capitalize(a)}`;
    let id = `arm_${mat}_${a}`;
    let lvl = (mIdx * 5) + 1; 
    let slot = a === 'bracers' ? 'arms' : a;
    newItems += `
  '${id}': { id: '${id}', name: '${aName}', description: 'Protective ${a}.', icon: '🛡️', rarity: 'common', slot: '${slot}', armorType: '${a}', material: '${mat}', levelReq: ${lvl}, stats: { armor: ${lvl * 3}, maxHp: ${lvl * 10} }, valueGold: ${lvl * 8} },
`;
    newRecipes += `
  'rec_${id}': { id: 'rec_${id}', name: 'Craft ${aName}', createdItemId: '${id}', requiredProfession: 'blacksmithing', requiredLevel: ${lvl}, materials: [{ itemId: 'mat_${mat}', amount: 3 }], craftTimeSeconds: 3, expReward: ${lvl * 10} },
`;
  });
});

// inject items
if(!code.includes('wep_bronze_scythe')) {
  code = code.replace(/export const RPG_ITEMS_DATABASE: Record<string, RPGItem> = \{/, 'export const RPG_ITEMS_DATABASE: Record<string, RPGItem> = {' + newResources + newItems);
}

if(!code.includes('rec_wep_bronze_scythe')) {
  code = code.replace(/export const CRAFTING_RECIPES: Record<string, CraftingRecipe> = \{/, 'export const CRAFTING_RECIPES: Record<string, CraftingRecipe> = {' + newRecipes);
}

fs.writeFileSync(path, code);
console.log("Injected items and recipes");
