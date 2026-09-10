import fs from 'fs';

const dataPath = 'src/data/mmorpgData.ts';
let dataCode = fs.readFileSync(dataPath, 'utf8');

const toolsStr = `
  'tool_pickaxe': { id: 'tool_pickaxe', name: 'Iron Pickaxe', description: 'Used to mine ores.', icon: '⛏️', rarity: 'common', slot: 'tool', weaponType: 'heavy_tech', levelReq: 1, stats: {}, valueGold: 10 },
  'tool_sickle': { id: 'tool_sickle', name: 'Iron Sickle', description: 'Used to harvest plants.', icon: '🌾', rarity: 'common', slot: 'tool', weaponType: 'blade', levelReq: 1, stats: {}, valueGold: 10 },
  'tool_skinning_knife': { id: 'tool_skinning_knife', name: 'Skinning Knife', description: 'Used to skin beasts.', icon: '🗡️', rarity: 'common', slot: 'tool', weaponType: 'daggers', levelReq: 1, stats: {}, valueGold: 10 },
`;

if (!dataCode.includes('tool_pickaxe')) {
  dataCode = dataCode.replace(/export const RPG_ITEMS_DATABASE: Record<string, RPGItem> = \{/, 'export const RPG_ITEMS_DATABASE: Record<string, RPGItem> = {' + toolsStr);
}

const nodesStr = `
export const INITIAL_RESOURCE_NODES = [
  { id: 'node_copper_1', name: 'Bronze Ore Vein', type: 'ore', x: 10, y: 0, z: -20, resourceItemId: 'res_copper_tin_ore', requiredProfession: 'miner', requiredToolCategory: 'Pickaxe', amount: 5, respawnTimeSeconds: 60, isDepleted: false, color: '#cd7f32' },
  { id: 'node_iron_1', name: 'Iron Ore Vein', type: 'ore', x: 25, y: 0, z: -30, resourceItemId: 'res_iron_ore', requiredProfession: 'miner', requiredToolCategory: 'Pickaxe', amount: 5, respawnTimeSeconds: 60, isDepleted: false, color: '#a0aec0' },
  { id: 'node_steel_1', name: 'High-Yield Iron Vein', type: 'ore', x: -15, y: 0, z: -40, resourceItemId: 'res_steel_ore', requiredProfession: 'miner', requiredToolCategory: 'Pickaxe', amount: 5, respawnTimeSeconds: 60, isDepleted: false, color: '#4a5568' },
  { id: 'node_cotton_1', name: 'Cotton Plant', type: 'plant', x: 30, y: 0, z: 10, resourceItemId: 'res_cotton', requiredProfession: 'farmer', requiredToolCategory: 'Sickle', amount: 5, respawnTimeSeconds: 60, isDepleted: false, color: '#f8fafc' },
  { id: 'node_beast_1', name: 'Beast Carcass', type: 'carcass', x: -20, y: 0, z: 25, resourceItemId: 'res_hide', requiredProfession: 'hunter', requiredToolCategory: 'Skinning Knife', amount: 5, respawnTimeSeconds: 60, isDepleted: false, color: '#8b5a2b' },
];
`;

if (!dataCode.includes('INITIAL_RESOURCE_NODES')) {
  dataCode += nodesStr;
}

fs.writeFileSync(dataPath, dataCode);
