import fs from 'fs';
import path from 'path';

export interface GLBModelItem {
  id: string;
  name: string;
  fileName: string;
  relativePath: string;
  url: string;
  category:
    | 'character_avatar'
    | 'mob'
    | 'mount'
    | 'weapon'
    | 'shield'
    | 'offhand'
    | 'helmet'
    | 'chest'
    | 'shoulders'
    | 'arms'
    | 'legs'
    | 'boots'
    | 'prop'
    | 'architecture';
  equipSlot?: string;
  weaponType?: 'blade' | 'arcane' | 'marksmanship' | 'heavy_tech';
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mystic';
  itemStats?: {
    attack?: number;
    spellPower?: number;
    armor?: number;
    critChance?: number;
    moveSpeed?: number;
    maxHp?: number;
    maxResource?: number;
  };
  triangleBudget: number;
  boneCount: number;
  fileSizeBytes: number;
  status: 'ready' | 'concept' | 'provisional' | 'active_equipped';
  animations: string[];
  description: string;
  referenceUrl?: string;
  author?: string;
  sourceDirectory: string;
  uploadedAt: string;
  lastScannedAt?: string;
}

export interface GLBWatchEvent {
  id: string;
  timestamp: string;
  type: 'added' | 'modified' | 'deleted' | 'scanned' | 'synced' | 'watcher_started' | 'watcher_stopped';
  fileName: string;
  modelId?: string;
  category?: string;
  directory: string;
  message: string;
  details?: any;
}

export interface GLBWatchStatus {
  isWatching: boolean;
  watchedDirectories: string[];
  totalModels: number;
  activeDirectory: string;
  lastScanTime: string | null;
  lastEventTime: string | null;
  recentEvents: GLBWatchEvent[];
}

const PRIMARY_GLB_ASSETS_DIR = path.join(process.cwd(), 'GLB-Assets');
const SECONDARY_PUBLIC_GLB_DIR = path.join(process.cwd(), 'public', 'models', 'glb');

// Minimal valid GLB generator for procedural seeds so Three.js GLTFLoader parses them seamlessly
export function createMinimalGLB(name: string, colorR = 0.0, colorG = 0.94, colorB = 1.0): Buffer {
  const gltfJson = {
    asset: { version: '2.0', generator: 'Aurion OpenWorld Asset Pipeline' },
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name }],
    meshes: [
      {
        name,
        primitives: [
          {
            attributes: {
              POSITION: 0,
              NORMAL: 1,
            },
            indices: 2,
            mode: 4, // TRIANGLES
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        name: `${name}_mat`,
        pbrMetallicRoughness: {
          baseColorFactor: [colorR, colorG, colorB, 1.0],
          metallicFactor: 0.8,
          roughnessFactor: 0.3,
        },
        emissiveFactor: [colorR * 0.4, colorG * 0.4, colorB * 0.4],
      },
    ],
    buffers: [{ byteLength: 648 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 288, target: 34962 },
      { buffer: 0, byteOffset: 288, byteLength: 288, target: 34962 },
      { buffer: 0, byteOffset: 576, byteLength: 72, target: 34963 },
    ],
    accessors: [
      {
        bufferView: 0,
        byteOffset: 0,
        componentType: 5126,
        count: 24,
        type: 'VEC3',
        max: [0.5, 0.5, 0.5],
        min: [-0.5, -0.5, -0.5],
      },
      {
        bufferView: 1,
        byteOffset: 0,
        componentType: 5126,
        count: 24,
        type: 'VEC3',
      },
      {
        bufferView: 2,
        byteOffset: 0,
        componentType: 5123,
        count: 36,
        type: 'SCALAR',
      },
    ],
  };

  const jsonString = JSON.stringify(gltfJson);
  const jsonPadding = (4 - (jsonString.length % 4)) % 4;
  const jsonChunkData = Buffer.from(jsonString + ' '.repeat(jsonPadding), 'utf8');

  // Binary buffer: 288 bytes (positions) + 288 bytes (normals) + 72 bytes (indices) = 648 bytes
  const binData = Buffer.alloc(648);

  // 24 vertices (6 faces * 4 vertices)
  const posArray = new Float32Array(binData.buffer, binData.byteOffset, 72);
  const rawPositions = [
    // Front (+Z)
    -0.4, -0.4,  0.4,   0.4, -0.4,  0.4,   0.4,  0.4,  0.4,  -0.4,  0.4,  0.4,
    // Back (-Z)
     0.4, -0.4, -0.4,  -0.4, -0.4, -0.4,  -0.4,  0.4, -0.4,   0.4,  0.4, -0.4,
    // Top (+Y)
    -0.4,  0.4,  0.4,   0.4,  0.4,  0.4,   0.4,  0.4, -0.4,  -0.4,  0.4, -0.4,
    // Bottom (-Y)
    -0.4, -0.4, -0.4,   0.4, -0.4, -0.4,   0.4, -0.4,  0.4,  -0.4, -0.4,  0.4,
    // Right (+X)
     0.4, -0.4,  0.4,   0.4, -0.4, -0.4,   0.4,  0.4, -0.4,   0.4,  0.4,  0.4,
    // Left (-X)
    -0.4, -0.4, -0.4,  -0.4, -0.4,  0.4,  -0.4,  0.4,  0.4,  -0.4,  0.4, -0.4,
  ];
  for (let i = 0; i < 72; i++) {
    posArray[i] = rawPositions[i];
  }

  const normArray = new Float32Array(binData.buffer, binData.byteOffset + 288, 72);
  const rawNormals = [
    // Front
    0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
    // Back
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    // Top
    0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
    // Bottom
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    // Right
    1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
    // Left
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ];
  for (let i = 0; i < 72; i++) {
    normArray[i] = rawNormals[i];
  }

  const indArray = new Uint16Array(binData.buffer, binData.byteOffset + 576, 36);
  let idx = 0;
  for (let f = 0; f < 6; f++) {
    const b = f * 4;
    indArray[idx++] = b;
    indArray[idx++] = b + 1;
    indArray[idx++] = b + 2;
    indArray[idx++] = b;
    indArray[idx++] = b + 2;
    indArray[idx++] = b + 3;
  }

  const binPadding = (4 - (binData.length % 4)) % 4;
  const binChunkData = Buffer.concat([binData, Buffer.alloc(binPadding)]);

  const totalLength = 12 + 8 + jsonChunkData.length + 8 + binChunkData.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // "glTF"
  header.writeUInt32LE(2, 4); // version 2
  header.writeUInt32LE(totalLength, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonChunkData.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4);

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binChunkData.length, 0);
  binChunkHeader.writeUInt32LE(0x004e4942, 4);

  return Buffer.concat([header, jsonChunkHeader, jsonChunkData, binChunkHeader, binChunkData]);
}

const SEEDED_GLB_ASSETS: Partial<GLBModelItem>[] = [
  // 1. WEAPONS
  {
    id: 'apprentice-steel-blade',
    name: 'Apprentice Steel Blade',
    fileName: 'apprentice-steel-blade.glb',
    relativePath: 'weapons/apprentice-steel-blade.glb',
    category: 'weapon',
    equipSlot: 'weapon',
    weaponType: 'blade',
    rarity: 'common',
    itemStats: { attack: 28, armor: 4 },
    triangleBudget: 460,
    boneCount: 1,
    status: 'ready',
    animations: ['idle', 'attack_01'],
    description: 'Forged steel short blade with honed crossguard for initiate adventurers.',
    author: 'Aethelgard Blacksmith',
  },
  {
    id: 'aurion-blade',
    name: 'Cog-Forged Bastard Sword',
    fileName: 'aurion-blade.glb',
    relativePath: 'weapons/aurion-blade.glb',
    category: 'weapon',
    equipSlot: 'weapon',
    weaponType: 'blade',
    rarity: 'rare',
    itemStats: { attack: 52, critChance: 8, armor: 6 },
    triangleBudget: 780,
    boneCount: 1,
    status: 'ready',
    animations: ['idle', 'attack_01'],
    description: 'Cog-reinforced bastard sword etched with glowing runic conduits.',
    author: 'Aethelgard Master Smith',
  },
  {
    id: 'vortex-steam-katana',
    name: 'Vortex Steam Katana',
    fileName: 'vortex-steam-katana.glb',
    relativePath: 'weapons/vortex-steam-katana.glb',
    category: 'weapon',
    equipSlot: 'weapon',
    weaponType: 'blade',
    rarity: 'epic',
    itemStats: { attack: 72, critChance: 16, moveSpeed: 5 },
    triangleBudget: 860,
    boneCount: 1,
    status: 'ready',
    animations: ['idle', 'attack_01', 'cleave'],
    description: 'Pressurized curved blade venting superheated steam upon impact.',
    author: 'Mechanist Order',
  },
  {
    id: 'novice-aether-wand',
    name: 'Novice Aether Wand',
    fileName: 'novice-aether-wand.glb',
    relativePath: 'weapons/novice-aether-wand.glb',
    category: 'weapon',
    equipSlot: 'weapon',
    weaponType: 'arcane',
    rarity: 'common',
    itemStats: { spellPower: 32, maxResource: 40 },
    triangleBudget: 420,
    boneCount: 1,
    status: 'ready',
    animations: ['idle', 'cast_01'],
    description: 'Lightweight wooden wand tipped with a raw turquoise aether crystal.',
    author: 'Aether Academy',
  },
  {
    id: 'steam-assisted-bow',
    name: 'Steam-Assisted Hunting Bow',
    fileName: 'steam-assisted-bow.glb',
    relativePath: 'weapons/steam-assisted-bow.glb',
    category: 'weapon',
    equipSlot: 'weapon',
    weaponType: 'marksmanship',
    rarity: 'common',
    itemStats: { attack: 30, critChance: 10, moveSpeed: 4 },
    triangleBudget: 510,
    boneCount: 2,
    status: 'ready',
    animations: ['idle', 'aim', 'shoot'],
    description: 'Recurve hunting bow reinforced with mini steam pulleys.',
    author: 'Frontier Scouts',
  },
  {
    id: 'twin-shadow-daggers',
    name: 'Twin Shadow Fang Daggers',
    fileName: 'twin-shadow-daggers.glb',
    relativePath: 'weapons/twin-shadow-daggers.glb',
    category: 'weapon',
    equipSlot: 'weapon',
    weaponType: 'marksmanship',
    rarity: 'epic',
    itemStats: { attack: 68, critChance: 22, moveSpeed: 8 },
    triangleBudget: 740,
    boneCount: 1,
    status: 'ready',
    animations: ['idle', 'attack_01'],
    description: 'Midnight obsidian daggers coated with shadowy aether venom.',
    author: 'Shadow Guild',
  },
  {
    id: 'hand-mortar-blunderbuss',
    name: 'Hand-Mortar Blunderbuss',
    fileName: 'hand-mortar-blunderbuss.glb',
    relativePath: 'weapons/hand-mortar-blunderbuss.glb',
    category: 'weapon',
    equipSlot: 'weapon',
    weaponType: 'heavy_tech',
    rarity: 'common',
    itemStats: { attack: 38, armor: 6 },
    triangleBudget: 620,
    boneCount: 2,
    status: 'ready',
    animations: ['idle', 'fire_artillery'],
    description: 'Flared-barrel portable mortar firing shrapnel pellets.',
    author: 'Iron Cohort',
  },
  {
    id: 'aurion-sunblade',
    name: 'Aurion Sunforged Blade',
    fileName: 'aurion-sunblade.glb',
    relativePath: 'weapons/aurion-sunblade.glb',
    category: 'weapon',
    equipSlot: 'weapon',
    weaponType: 'blade',
    rarity: 'legendary',
    itemStats: { attack: 95, critChance: 14, armor: 8 },
    triangleBudget: 850,
    boneCount: 2,
    status: 'ready',
    animations: ['idle', 'attack_01', 'cleave'],
    description: 'Ancient sunforged two-handed greatsword etched with pulsating Aurion-turquoise leylines.',
    author: 'Aurion Master Smith',
  },
  {
    id: 'clockwork-repeater',
    name: 'Clockwork Heavy Arbalest',
    fileName: 'clockwork-repeater.glb',
    relativePath: 'weapons/clockwork-repeater.glb',
    category: 'weapon',
    equipSlot: 'weapon',
    weaponType: 'marksmanship',
    rarity: 'epic',
    itemStats: { attack: 74, critChance: 18, moveSpeed: 6 },
    triangleBudget: 1100,
    boneCount: 4,
    status: 'ready',
    animations: ['idle', 'aim', 'shoot'],
    description: 'High-pressure pneumatic arbalest firing aether-tipped piercing bolts.',
    author: 'Mechanist Guild',
  },
  {
    id: 'chrono-aether-scepter',
    name: 'Chronomancer Aether Scepter',
    fileName: 'chrono-aether-scepter.glb',
    relativePath: 'weapons/chrono-aether-scepter.glb',
    category: 'weapon',
    equipSlot: 'weapon',
    weaponType: 'arcane',
    rarity: 'mystic',
    itemStats: { spellPower: 110, critChance: 12, maxResource: 120 },
    triangleBudget: 950,
    boneCount: 3,
    status: 'ready',
    animations: ['idle', 'cast_01', 'channel'],
    description: 'Hovering celestial focus staff orbited by dual temporal bronze rings.',
    author: 'Chrono Archivist',
  },
  {
    id: 'hydraulic-warhammer',
    name: 'Titan Hydraulic Warhammer',
    fileName: 'hydraulic-warhammer.glb',
    relativePath: 'weapons/hydraulic-warhammer.glb',
    category: 'weapon',
    equipSlot: 'weapon',
    weaponType: 'blade',
    rarity: 'epic',
    itemStats: { attack: 88, armor: 15, maxHp: 180 },
    triangleBudget: 1200,
    boneCount: 2,
    status: 'ready',
    animations: ['idle', 'heavy_smash'],
    description: 'Devastating colossus hammer equipped with rear-facing steam exhaust thrusters.',
    author: 'Titan Foundry',
  },
  {
    id: 'steam-mortar-cannon',
    name: 'Overcharged Steam Mortar',
    fileName: 'steam-mortar-cannon.glb',
    relativePath: 'weapons/steam-mortar-cannon.glb',
    category: 'weapon',
    equipSlot: 'weapon',
    weaponType: 'heavy_tech',
    rarity: 'epic',
    itemStats: { attack: 92, maxHp: 150, armor: 12 },
    triangleBudget: 1150,
    boneCount: 2,
    status: 'ready',
    animations: ['idle', 'fire_artillery'],
    description: 'Heavy shoulder-mounted artillery cannon firing pressurized steam volleys.',
    author: 'Engineer Cohort',
  },

  // 2. SHIELDS & OFFHANDS
  {
    id: 'brass-buckler',
    name: 'Brass Buckler',
    fileName: 'brass-buckler.glb',
    relativePath: 'shields/brass-buckler.glb',
    category: 'shield',
    equipSlot: 'shield',
    rarity: 'common',
    itemStats: { armor: 24, maxHp: 60 },
    triangleBudget: 420,
    boneCount: 0,
    status: 'ready',
    animations: ['idle', 'block'],
    description: 'Sturdy circular bronze buckler with reinforced boss plate.',
    author: 'Aethelgard Smith',
  },
  {
    id: 'aegis-bulwark',
    name: 'Aegis Antigravity Bulwark',
    fileName: 'aegis-bulwark.glb',
    relativePath: 'shields/aegis-bulwark.glb',
    category: 'shield',
    equipSlot: 'shield',
    rarity: 'epic',
    itemStats: { armor: 55, maxHp: 300, maxResource: 50 },
    triangleBudget: 980,
    boneCount: 0,
    status: 'ready',
    animations: ['idle', 'block'],
    description: 'Tower shield with an embedded hovering octahedron reactor core that absorbs projectile shockwaves.',
    author: 'Sentinel Legion',
  },
  {
    id: 'chrono-grimoire-offhand',
    name: 'Tome of Celestial Mechanics',
    fileName: 'chrono-grimoire-offhand.glb',
    relativePath: 'shields/chrono-grimoire-offhand.glb',
    category: 'offhand',
    equipSlot: 'shield',
    rarity: 'mystic',
    itemStats: { spellPower: 68, maxResource: 150, critChance: 8 },
    triangleBudget: 720,
    boneCount: 2,
    status: 'ready',
    animations: ['idle', 'turn_page'],
    description: 'Levitating grimoire inscribed with ancient Aurion leylines and rotating celestial glyphs.',
    author: 'Grand Archivist',
  },
  {
    id: 'aether-catalyst-orb',
    name: 'Floating Aether Catalyst Orb',
    fileName: 'aether-catalyst-orb.glb',
    relativePath: 'shields/aether-catalyst-orb.glb',
    category: 'offhand',
    equipSlot: 'shield',
    rarity: 'rare',
    itemStats: { spellPower: 45, maxResource: 90, critChance: 6 },
    triangleBudget: 650,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'An orbiting crystalline sphere focusing atmospheric mana.',
    author: 'Aether Circle',
  },
  {
    id: 'parrying-stiletto',
    name: 'Parrying Stiletto',
    fileName: 'parrying-stiletto.glb',
    relativePath: 'shields/parrying-stiletto.glb',
    category: 'shield',
    equipSlot: 'shield',
    rarity: 'rare',
    itemStats: { attack: 35, critChance: 12, armor: 10 },
    triangleBudget: 460,
    boneCount: 0,
    status: 'ready',
    animations: ['idle', 'block'],
    description: 'Needle-thin offhand dagger designed to deflect enemy blades and riposte.',
    author: 'Duelist Guild',
  },

  // 3. HELMETS
  {
    id: 'sol-corona-greathelm',
    name: 'Sol Corona Crown Greathelm',
    fileName: 'sol-corona-greathelm.glb',
    relativePath: 'helmets/sol-corona-greathelm.glb',
    category: 'helmet',
    equipSlot: 'helmet',
    rarity: 'legendary',
    itemStats: { armor: 42, attack: 22, maxHp: 160 },
    triangleBudget: 1050,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Full-visored bronze greathelm crowned with radiant sunburst solar fins.',
    author: 'Aurion Vanguard',
  },
  {
    id: 'aviator-recon-goggles',
    name: 'Aviator Tactical Brass Goggles',
    fileName: 'aviator-recon-goggles.glb',
    relativePath: 'helmets/aviator-recon-goggles.glb',
    category: 'helmet',
    equipSlot: 'helmet',
    rarity: 'rare',
    itemStats: { critChance: 12, moveSpeed: 8, attack: 15 },
    triangleBudget: 680,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Precision cogwheel goggles with glowing turquoise analytical lenses.',
    author: 'Skyway Explorer',
  },
  {
    id: 'sentinel-visored-greathelm',
    name: 'Sentinel Visored Greathelm',
    fileName: 'sentinel-visored-greathelm.glb',
    relativePath: 'helmets/sentinel-visored-greathelm.glb',
    category: 'helmet',
    equipSlot: 'helmet',
    rarity: 'epic',
    itemStats: { armor: 55, maxHp: 120, attack: 14 },
    triangleBudget: 940,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Solid bronze knight helm with glowing turquoise eye slits.',
    author: 'Sentinel Order',
  },
  {
    id: 'chrono-aether-cowl',
    name: 'Chronomancer Aether Cowl',
    fileName: 'chrono-aether-cowl.glb',
    relativePath: 'helmets/chrono-aether-cowl.glb',
    category: 'helmet',
    equipSlot: 'helmet',
    rarity: 'epic',
    itemStats: { spellPower: 42, maxResource: 60, armor: 28 },
    triangleBudget: 850,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'A deep mystic cowl woven from cosmic threads with floating celestial circlets.',
    author: 'Chrono Guild',
  },
  {
    id: 'recruit-iron-sallet',
    name: 'Recruit Iron Sallet',
    fileName: 'recruit-iron-sallet.glb',
    relativePath: 'helmets/recruit-iron-sallet.glb',
    category: 'helmet',
    equipSlot: 'helmet',
    rarity: 'common',
    itemStats: { armor: 12, maxHp: 25 },
    triangleBudget: 420,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Standard steel skullcap protecting recruits from direct overhead blows.',
    author: 'Aethelgard Armory',
  },

  // 4. CHESTPLATES
  {
    id: 'titan-hydraulic-cuirass',
    name: 'Titan Reinforced Boiler Cuirass',
    fileName: 'titan-hydraulic-cuirass.glb',
    relativePath: 'chestplates/titan-hydraulic-cuirass.glb',
    category: 'chest',
    equipSlot: 'chest',
    rarity: 'epic',
    itemStats: { armor: 75, maxHp: 380, maxResource: 40 },
    triangleBudget: 1180,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Heavy bronze breastplate outfitted with rear-mounted twin steam boiler exhaust pipes.',
    author: 'Titan Foundry',
  },
  {
    id: 'valor-hydraulic-cuirass',
    name: 'Hydraulic Cuirass of Valor',
    fileName: 'valor-hydraulic-cuirass.glb',
    relativePath: 'chestplates/valor-hydraulic-cuirass.glb',
    category: 'chest',
    equipSlot: 'chest',
    rarity: 'epic',
    itemStats: { armor: 85, maxHp: 220, attack: 18 },
    triangleBudget: 1100,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Pneumatic piston armor that absorbs concussive shock and reinforces stamina.',
    author: 'Aethelgard High Guard',
  },
  {
    id: 'chrono-silk-robes',
    name: 'Chronomancer Silk Robes',
    fileName: 'chrono-silk-robes.glb',
    relativePath: 'chestplates/chrono-silk-robes.glb',
    category: 'chest',
    equipSlot: 'chest',
    rarity: 'epic',
    itemStats: { armor: 42, spellPower: 58, maxResource: 90 },
    triangleBudget: 860,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Fine midnight-petrol silk woven with gold conduits to channel vast mana pools.',
    author: 'Chrono Archivist',
  },
  {
    id: 'shadowscale-rogue-jerkin',
    name: 'Shadowscale Rogue Jerkin',
    fileName: 'shadowscale-rogue-jerkin.glb',
    relativePath: 'chestplates/shadowscale-rogue-jerkin.glb',
    category: 'chest',
    equipSlot: 'chest',
    rarity: 'rare',
    itemStats: { armor: 48, critChance: 12, moveSpeed: 8 },
    triangleBudget: 740,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Supple blackened reptile leather enabling silent, lightning-fast acrobatics.',
    author: 'Outlaw Syndicate',
  },
  {
    id: 'recruit-padded-gambeson',
    name: 'Recruit Padded Gambeson',
    fileName: 'recruit-padded-gambeson.glb',
    relativePath: 'chestplates/recruit-padded-gambeson.glb',
    category: 'chest',
    equipSlot: 'chest',
    rarity: 'common',
    itemStats: { armor: 18, maxHp: 40 },
    triangleBudget: 520,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Sturdy quilted tunic layered with iron studs.',
    author: 'Aethelgard Recruit Outfitter',
  },

  // 5. SHOULDERS
  {
    id: 'recruit-riveted-pauldrons',
    name: 'Riveted Iron Pauldrons',
    fileName: 'recruit-riveted-pauldrons.glb',
    relativePath: 'shoulders/recruit-riveted-pauldrons.glb',
    category: 'shoulders',
    equipSlot: 'shoulders',
    rarity: 'common',
    itemStats: { armor: 10, maxHp: 20 },
    triangleBudget: 380,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Basic flared shoulder guards offering vital collarbone protection.',
    author: 'Aethelgard Armory',
  },
  {
    id: 'vanguard-spiked-pauldrons',
    name: 'Spiked Vanguard Pauldrons',
    fileName: 'vanguard-spiked-pauldrons.glb',
    relativePath: 'shoulders/vanguard-spiked-pauldrons.glb',
    category: 'shoulders',
    equipSlot: 'shoulders',
    rarity: 'rare',
    itemStats: { armor: 32, attack: 12, maxHp: 50 },
    triangleBudget: 720,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Heavy bronze shoulder armor adorned with brutal counter-weight spikes.',
    author: 'Vanguard Smith',
  },
  {
    id: 'aether-runic-mantle',
    name: 'Mantle of Ancient Aether Runes',
    fileName: 'aether-runic-mantle.glb',
    relativePath: 'shoulders/aether-runic-mantle.glb',
    category: 'shoulders',
    equipSlot: 'shoulders',
    rarity: 'epic',
    itemStats: { armor: 48, spellPower: 38, maxResource: 45 },
    triangleBudget: 960,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Levitating shoulder plates glowing with raw turquoise leylines.',
    author: 'Aether Circle',
  },
  {
    id: 'lion-crest-royal-pauldrons',
    name: 'Lion Crest Royal Pauldrons',
    fileName: 'lion-crest-royal-pauldrons.glb',
    relativePath: 'shoulders/lion-crest-royal-pauldrons.glb',
    category: 'shoulders',
    equipSlot: 'shoulders',
    rarity: 'legendary',
    itemStats: { armor: 65, attack: 28, maxHp: 160, critChance: 8 },
    triangleBudget: 1120,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Carved with roaring golden lion emblems of the High Court.',
    author: 'Royal Forge',
  },

  // 6. ARMS & GAUNTLETS
  {
    id: 'recruit-leather-bracers',
    name: 'Recruit Leather Bracers',
    fileName: 'recruit-leather-bracers.glb',
    relativePath: 'arms/recruit-leather-bracers.glb',
    category: 'arms',
    equipSlot: 'arms',
    rarity: 'common',
    itemStats: { armor: 8, attack: 4 },
    triangleBudget: 340,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Simple forearms guards fastened with bronze buckles.',
    author: 'Aethelgard Armory',
  },
  {
    id: 'bronze-clank-gauntlets',
    name: 'Bronze Clank Gauntlets',
    fileName: 'bronze-clank-gauntlets.glb',
    relativePath: 'arms/bronze-clank-gauntlets.glb',
    category: 'arms',
    equipSlot: 'arms',
    rarity: 'rare',
    itemStats: { armor: 22, attack: 14, maxHp: 40 },
    triangleBudget: 680,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Articulated mechanical fingers reinforced with steam-powered grip pistons.',
    author: 'Clockwork Guild',
  },
  {
    id: 'mystic-chrono-spellwraps',
    name: 'Mystic Chrono Spellwraps',
    fileName: 'mystic-chrono-spellwraps.glb',
    relativePath: 'arms/mystic-chrono-spellwraps.glb',
    category: 'arms',
    equipSlot: 'arms',
    rarity: 'epic',
    itemStats: { armor: 28, spellPower: 36, maxResource: 40 },
    triangleBudget: 890,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Enchanted bindings with glowing runes running along the wrists.',
    author: 'Chrono Guild',
  },
  {
    id: 'titan-piston-fists',
    name: 'Titan Heavy Piston Fists',
    fileName: 'titan-piston-fists.glb',
    relativePath: 'arms/titan-piston-fists.glb',
    category: 'arms',
    equipSlot: 'arms',
    rarity: 'legendary',
    itemStats: { armor: 45, attack: 32, maxHp: 120, critChance: 7 },
    triangleBudget: 1140,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Colossal motorized gauntlets delivering bone-crushing impact force.',
    author: 'Titan Foundry',
  },

  // 7. LEGS & GREAVES
  {
    id: 'recruit-iron-greaves',
    name: 'Recruit Iron Greaves',
    fileName: 'recruit-iron-greaves.glb',
    relativePath: 'legs/recruit-iron-greaves.glb',
    category: 'legs',
    equipSlot: 'legs',
    rarity: 'common',
    itemStats: { armor: 14, maxHp: 30 },
    triangleBudget: 410,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Standard plate cuisses safeguarding legs against low sweeps.',
    author: 'Aethelgard Armory',
  },
  {
    id: 'armored-steel-greaves',
    name: 'Armored Steel Greaves',
    fileName: 'armored-steel-greaves.glb',
    relativePath: 'legs/armored-steel-greaves.glb',
    category: 'legs',
    equipSlot: 'legs',
    rarity: 'rare',
    itemStats: { armor: 38, maxHp: 80 },
    triangleBudget: 760,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Layered steel plates with knee guard hinges for flexible frontline combat.',
    author: 'Vanguard Smith',
  },
  {
    id: 'silk-chrono-robe-skirt',
    name: 'Silk Chrono Robe Skirt',
    fileName: 'silk-chrono-robe-skirt.glb',
    relativePath: 'legs/silk-chrono-robe-skirt.glb',
    category: 'legs',
    equipSlot: 'legs',
    rarity: 'epic',
    itemStats: { armor: 30, spellPower: 35, maxResource: 60 },
    triangleBudget: 830,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Embroidered tunic skirt blessed with arcane warding symbols.',
    author: 'Chrono Archivist',
  },
  {
    id: 'titan-plated-faulds',
    name: 'Titan Heavy Plated Faulds',
    fileName: 'titan-plated-faulds.glb',
    relativePath: 'legs/titan-plated-faulds.glb',
    category: 'legs',
    equipSlot: 'legs',
    rarity: 'legendary',
    itemStats: { armor: 70, maxHp: 220, attack: 15 },
    triangleBudget: 1150,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Massive armored waist faulds and greaves capable of anchoring against siege impacts.',
    author: 'Titan Foundry',
  },

  // 8. BOOTS & SABATONS
  {
    id: 'recruit-iron-sabatons',
    name: 'Recruit Iron Sabatons',
    fileName: 'recruit-iron-sabatons.glb',
    relativePath: 'boots/recruit-iron-sabatons.glb',
    category: 'boots',
    equipSlot: 'boots',
    rarity: 'common',
    itemStats: { armor: 10, moveSpeed: 5 },
    triangleBudget: 360,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Heavy studded marching boots for uneven cobblestone terrain.',
    author: 'Aethelgard Armory',
  },
  {
    id: 'piston-assisted-striders',
    name: 'Piston-Assisted Striders',
    fileName: 'piston-assisted-striders.glb',
    relativePath: 'boots/piston-assisted-striders.glb',
    category: 'boots',
    equipSlot: 'boots',
    rarity: 'rare',
    itemStats: { armor: 20, moveSpeed: 15, maxHp: 40 },
    triangleBudget: 740,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Spring-loaded mechanized boots that increase exploration travel velocity.',
    author: 'Clockwork Guild',
  },
  {
    id: 'arcane-hover-sabatons',
    name: 'Arcane Hover-Sabatons',
    fileName: 'arcane-hover-sabatons.glb',
    relativePath: 'boots/arcane-hover-sabatons.glb',
    category: 'boots',
    equipSlot: 'boots',
    rarity: 'epic',
    itemStats: { armor: 35, moveSpeed: 25, maxResource: 40, spellPower: 20 },
    triangleBudget: 910,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Fitted with micro aether repulsors to glide smoothly across the terrain.',
    author: 'Aether Circle',
  },
  {
    id: 'heavy-crusader-stompers',
    name: 'Heavy Crusader Iron Stompers',
    fileName: 'heavy-crusader-stompers.glb',
    relativePath: 'boots/heavy-crusader-stompers.glb',
    category: 'boots',
    equipSlot: 'boots',
    rarity: 'legendary',
    itemStats: { armor: 50, maxHp: 140, moveSpeed: 12, attack: 16 },
    triangleBudget: 1120,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Shockwave-dampening heavy sabatons with steel claw treads.',
    author: 'Crusader Forge',
  },

  // 5. AVATARS & MOBS
  {
    id: 'celestial-sentinel',
    name: 'Celestial Sentinel',
    fileName: 'celestial-sentinel.glb',
    relativePath: 'avatars/celestial-sentinel.glb',
    category: 'character_avatar',
    equipSlot: 'avatar',
    rarity: 'legendary',
    triangleBudget: 3800,
    boneCount: 36,
    status: 'ready',
    animations: ['idle', 'walk', 'run', 'hit', 'attack_01', 'cast_01'],
    description: 'Legendary partner-link visual and player avatar skin: honey-stone armor with turquoise wings.',
    referenceUrl: '/manus-storage/aurion-sentinel_c61957b4.png',
    author: 'Admin / Manus Pipeline',
  },
  {
    id: 'steam-automaton',
    name: 'Clockwork Automaton Chassis',
    fileName: 'steam-automaton.glb',
    relativePath: 'avatars/steam-automaton.glb',
    category: 'character_avatar',
    equipSlot: 'avatar',
    rarity: 'epic',
    triangleBudget: 3200,
    boneCount: 32,
    status: 'ready',
    animations: ['idle', 'walk', 'run', 'hit', 'attack_01', 'cast_01'],
    description: 'Articulated steam-driven explorer chassis with brass plating and turquoise ocular matrix.',
    author: 'Admin / Mechanist',
  },
  {
    id: 'astralwisp',
    name: 'Astralwisp',
    fileName: 'astralwisp.glb',
    relativePath: 'props/astralwisp.glb',
    category: 'mob',
    triangleBudget: 1200,
    boneCount: 24,
    status: 'ready',
    animations: ['idle', 'walk', 'run', 'hit', 'attack_01', 'cast_01'],
    description: 'First enemy family: airborne cyan-turquoise spirit wisp with aetherial tendrils.',
    referenceUrl: '/manus-storage/aurion-astralwisp-concept_6c6d2153.png',
    author: 'Admin / Manus Pipeline',
  },
  {
    id: 'runenwaechter',
    name: 'Runenwächter',
    fileName: 'runenwaechter.glb',
    relativePath: 'props/runenwaechter.glb',
    category: 'mob',
    triangleBudget: 4000,
    boneCount: 48,
    status: 'ready',
    animations: ['idle', 'walk', 'run', 'hit', 'attack_01', 'cast_01'],
    description: 'Elite & quest encounter: ancient colossus automaton with rune hammer.',
    author: 'Admin / Manus Pipeline',
  },
  {
    id: 'rueckkehrstein',
    name: 'Rückkehrstein',
    fileName: 'rueckkehrstein.glb',
    relativePath: 'props/rueckkehrstein.glb',
    category: 'prop',
    triangleBudget: 2500,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Transition portal anchor: weathered honey-stone obelisk wrapped in bronze rings.',
    author: 'Admin / Manus Pipeline',
  },
  {
    id: 'sternenpfad-archway',
    name: 'Sternenpfad-Archway',
    fileName: 'sternenpfad-archway.glb',
    relativePath: 'props/sternenpfad-archway.glb',
    category: 'architecture',
    triangleBudget: 3500,
    boneCount: 0,
    status: 'ready',
    animations: ['idle'],
    description: 'Starpath monumental gateway connecting floating isles with celestial conduits.',
    author: 'Admin / Manus Pipeline',
  },
];

class GLBRegistryService {
  private catalog: Map<string, GLBModelItem> = new Map();
  private eventHistory: GLBWatchEvent[] = [];
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private isWatching = false;
  private watchedDirectories: Set<string> = new Set();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private listeners: Set<(event: GLBWatchEvent) => void> = new Set();
  private lastScanTime: string | null = null;
  private activeDirectoryPath: string = PRIMARY_GLB_ASSETS_DIR;

  constructor() {
    this.ensureDirectoriesAndSeed();
    this.startWatcher(PRIMARY_GLB_ASSETS_DIR);
    this.startWatcher(SECONDARY_PUBLIC_GLB_DIR);
  }

  // --- Directory Initialization & Seeding ---
  public ensureDirectoriesAndSeed() {
    try {
      if (!fs.existsSync(PRIMARY_GLB_ASSETS_DIR)) {
        fs.mkdirSync(PRIMARY_GLB_ASSETS_DIR, { recursive: true });
      }
      if (!fs.existsSync(SECONDARY_PUBLIC_GLB_DIR)) {
        fs.mkdirSync(SECONDARY_PUBLIC_GLB_DIR, { recursive: true });
      }

      // Ensure subdirectories in GLB-Assets
      const subdirs = ['weapons', 'shields', 'helmets', 'chestplates', 'shoulders', 'arms', 'legs', 'boots', 'avatars', 'props', 'architecture'];
      for (const sub of subdirs) {
        const subPath = path.join(PRIMARY_GLB_ASSETS_DIR, sub);
        if (!fs.existsSync(subPath)) {
          fs.mkdirSync(subPath, { recursive: true });
        }
      }

      // Seed standard model files and companion metadata JSONs
      for (const item of SEEDED_GLB_ASSETS) {
        const targetDir = item.relativePath ? path.dirname(path.join(PRIMARY_GLB_ASSETS_DIR, item.relativePath)) : PRIMARY_GLB_ASSETS_DIR;
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const filePath = item.relativePath
          ? path.join(PRIMARY_GLB_ASSETS_DIR, item.relativePath)
          : path.join(PRIMARY_GLB_ASSETS_DIR, item.fileName!);
        
        const publicFilePath = path.join(SECONDARY_PUBLIC_GLB_DIR, item.fileName!);
        const metaPath = path.join(path.dirname(filePath), `${item.id}.json`);
        const publicMetaPath = path.join(SECONDARY_PUBLIC_GLB_DIR, `${item.id}.json`);

        // Generate minimal valid GLB if file doesn't exist or is invalid/corrupt
        const needsFileUpdate = !fs.existsSync(filePath) || fs.statSync(filePath).size < 1000;
        if (needsFileUpdate) {
          const buffer = createMinimalGLB(item.name || item.id!, 0.0, 0.94, 1.0);
          fs.writeFileSync(filePath, buffer);
        }
        const needsPublicFileUpdate = !fs.existsSync(publicFilePath) || fs.statSync(publicFilePath).size < 1000;
        if (needsPublicFileUpdate) {
          const buffer = createMinimalGLB(item.name || item.id!, 0.0, 0.94, 1.0);
          fs.writeFileSync(publicFilePath, buffer);
        }

        const fullItem: GLBModelItem = {
          id: item.id!,
          name: item.name || item.id!,
          fileName: item.fileName!,
          relativePath: item.relativePath || item.fileName!,
          url: `/glb-assets/${item.relativePath || item.fileName!}`,
          category: item.category || 'weapon',
          equipSlot: item.equipSlot || (item.category as string),
          weaponType: item.weaponType,
          rarity: item.rarity || 'epic',
          itemStats: item.itemStats || { attack: 50, armor: 20 },
          triangleBudget: item.triangleBudget || 1200,
          boneCount: item.boneCount || 0,
          fileSizeBytes: fs.existsSync(filePath) ? fs.statSync(filePath).size : 250000,
          status: item.status || 'ready',
          animations: item.animations || ['idle', 'walk', 'run', 'hit', 'attack_01', 'cast_01'],
          description: item.description || 'Aurion 3D Asset',
          referenceUrl: item.referenceUrl,
          author: item.author || 'Aurion Pipeline',
          sourceDirectory: PRIMARY_GLB_ASSETS_DIR,
          uploadedAt: new Date().toISOString(),
        };

        if (!fs.existsSync(metaPath)) {
          fs.writeFileSync(metaPath, JSON.stringify(fullItem, null, 2), 'utf8');
        }
        if (!fs.existsSync(publicMetaPath)) {
          fs.writeFileSync(publicMetaPath, JSON.stringify(fullItem, null, 2), 'utf8');
        }

        this.catalog.set(fullItem.id, fullItem);
      }

      this.scanDirectory();
    } catch (err) {
      console.error('[GLBRegistry] Initialization error:', err);
    }
  }

  // --- Recursive Directory Scanning & Metadata Synthesis ---
  public scanDirectory(targetDir: string = PRIMARY_GLB_ASSETS_DIR): GLBModelItem[] {
    try {
      this.lastScanTime = new Date().toISOString();
      this.activeDirectoryPath = targetDir;
      const discovered: GLBModelItem[] = [];

      const scanFolderRecursive = (currentDir: string, rootDir: string) => {
        if (!fs.existsSync(currentDir)) return;
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            scanFolderRecursive(fullPath, rootDir);
          } else if (entry.isFile() && (entry.name.endsWith('.glb') || entry.name.endsWith('.gltf'))) {
            const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
            const parsed = path.parse(entry.name);
            const id = parsed.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
            const stats = fs.statSync(fullPath);
            const metaPath = path.join(currentDir, `${parsed.name}.json`);

            let meta: Partial<GLBModelItem> = {};
            if (fs.existsSync(metaPath)) {
              try {
                meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
              } catch (err) {
                console.warn(`[GLBRegistry] Failed to parse JSON metadata for ${metaPath}:`, err);
              }
            }

            const inferred = this.inferMetadataFromFilename(entry.name, relativePath, stats.size);
            const isPublicDir = rootDir.includes('public');
            const url = isPublicDir ? `/models/glb/${relativePath}` : `/glb-assets/${relativePath}`;

            const existing = this.catalog.get(id);
            const item: GLBModelItem = {
              id,
              name: meta.name || existing?.name || inferred.name,
              fileName: entry.name,
              relativePath,
              url,
              category: (meta.category as any) || existing?.category || inferred.category,
              equipSlot: meta.equipSlot || existing?.equipSlot || inferred.equipSlot,
              weaponType: meta.weaponType || existing?.weaponType || inferred.weaponType,
              rarity: (meta.rarity as any) || existing?.rarity || inferred.rarity,
              itemStats: meta.itemStats || existing?.itemStats || inferred.itemStats,
              triangleBudget: meta.triangleBudget || existing?.triangleBudget || inferred.triangleBudget,
              boneCount: meta.boneCount ?? (existing?.boneCount ?? inferred.boneCount),
              fileSizeBytes: stats.size,
              status: (meta.status as any) || existing?.status || 'ready',
              animations: meta.animations || existing?.animations || inferred.animations,
              description: meta.description || existing?.description || inferred.description,
              referenceUrl: meta.referenceUrl || existing?.referenceUrl,
              author: meta.author || existing?.author || 'External Directory Scanner',
              sourceDirectory: rootDir,
              uploadedAt: stats.mtime.toISOString(),
              lastScannedAt: new Date().toISOString(),
            };

            // Auto-persist companion metadata JSON if missing
            if (!fs.existsSync(metaPath)) {
              try {
                fs.writeFileSync(metaPath, JSON.stringify(item, null, 2), 'utf8');
              } catch {}
            }

            this.catalog.set(id, item);
            discovered.push(item);
          }
        }
      };

      // Scan requested directory and secondary public directory
      scanFolderRecursive(targetDir, targetDir);
      if (targetDir !== SECONDARY_PUBLIC_GLB_DIR && fs.existsSync(SECONDARY_PUBLIC_GLB_DIR)) {
        scanFolderRecursive(SECONDARY_PUBLIC_GLB_DIR, SECONDARY_PUBLIC_GLB_DIR);
      }

      this.recordEvent({
        type: 'scanned',
        fileName: '*',
        directory: targetDir,
        message: `Scanned directory "${path.basename(targetDir)}" — Discovered & verified ${this.catalog.size} total 3D models.`,
        details: { count: discovered.length },
      });

      return Array.from(this.catalog.values());
    } catch (err: any) {
      console.error('[GLBRegistry] Scan error:', err);
      return Array.from(this.catalog.values());
    }
  }

  // --- Intelligent Metadata Inference for Dynamic Equipment Swapping ---
  private inferMetadataFromFilename(fileName: string, relativePath: string, sizeBytes: number) {
    const lower = (fileName + ' ' + relativePath).toLowerCase();
    
    // Category & Slot Inference
    let category: GLBModelItem['category'] = 'prop';
    let equipSlot: string = 'relic';
    let weaponType: GLBModelItem['weaponType'] = undefined;
    let rarity: GLBModelItem['rarity'] = 'rare';
    let boneCount = 0;
    let triangleBudget = Math.min(6000, Math.max(500, Math.round(sizeBytes / 220)));
    let animations = ['idle'];

    const itemStats: GLBModelItem['itemStats'] = {
      attack: 0,
      armor: 0,
      spellPower: 0,
      critChance: 0,
      maxHp: 0,
    };

    if (lower.includes('sunblade') || lower.includes('blade') || lower.includes('sword') || lower.includes('katana') || lower.includes('hammer') || lower.includes('axe') || lower.includes('cleaver') || lower.includes('weapons/')) {
      category = 'weapon';
      equipSlot = 'weapon';
      weaponType = 'blade';
      rarity = lower.includes('sun') || lower.includes('legend') ? 'legendary' : 'epic';
      itemStats.attack = 80 + Math.floor(Math.random() * 20);
      itemStats.critChance = 10;
      animations = ['idle', 'attack_01', 'cleave'];
    } else if (lower.includes('arbalest') || lower.includes('crossbow') || lower.includes('bow') || lower.includes('repeater') || lower.includes('rifle') || lower.includes('dagger')) {
      category = 'weapon';
      equipSlot = 'weapon';
      weaponType = 'marksmanship';
      rarity = 'epic';
      itemStats.attack = 72 + Math.floor(Math.random() * 15);
      itemStats.critChance = 16;
      animations = ['idle', 'aim', 'shoot'];
    } else if (lower.includes('scepter') || lower.includes('staff') || lower.includes('wand') || lower.includes('chrono') || lower.includes('arcane')) {
      category = 'weapon';
      equipSlot = 'weapon';
      weaponType = 'arcane';
      rarity = 'mystic';
      itemStats.spellPower = 95 + Math.floor(Math.random() * 25);
      itemStats.critChance = 12;
      animations = ['idle', 'cast_01', 'channel'];
    } else if (lower.includes('cannon') || lower.includes('mortar') || lower.includes('artillery') || lower.includes('gatling') || lower.includes('heavy_tech')) {
      category = 'weapon';
      equipSlot = 'weapon';
      weaponType = 'heavy_tech';
      rarity = 'epic';
      itemStats.attack = 85 + Math.floor(Math.random() * 15);
      itemStats.armor = 15;
      animations = ['idle', 'fire_artillery'];
    } else if (lower.includes('shield') || lower.includes('bulwark') || lower.includes('aegis') || lower.includes('buckler') || lower.includes('shields/')) {
      category = 'shield';
      equipSlot = 'shield';
      rarity = 'epic';
      itemStats.armor = 50 + Math.floor(Math.random() * 15);
      itemStats.maxHp = 250;
      animations = ['idle', 'block'];
    } else if (lower.includes('grimoire') || lower.includes('tome') || lower.includes('orb') || lower.includes('offhand')) {
      category = 'offhand';
      equipSlot = 'shield';
      rarity = 'mystic';
      itemStats.spellPower = 60;
      itemStats.maxResource = 100;
      animations = ['idle'];
    } else if (lower.includes('helm') || lower.includes('goggle') || lower.includes('crown') || lower.includes('hood') || lower.includes('sallet') || lower.includes('helmets/')) {
      category = 'helmet';
      equipSlot = 'helmet';
      rarity = lower.includes('corona') || lower.includes('crown') ? 'legendary' : 'rare';
      itemStats.armor = 35 + Math.floor(Math.random() * 10);
      itemStats.critChance = 8;
      animations = ['idle'];
    } else if (lower.includes('cuirass') || lower.includes('chest') || lower.includes('breastplate') || lower.includes('armor') || lower.includes('robe') || lower.includes('chestplates/')) {
      category = 'chest';
      equipSlot = 'chest';
      rarity = 'epic';
      itemStats.armor = 65 + Math.floor(Math.random() * 20);
      itemStats.maxHp = 320;
      animations = ['idle'];
    } else if (lower.includes('avatar') || lower.includes('sentinel') || lower.includes('automaton') || lower.includes('character') || lower.includes('hero') || lower.includes('avatars/')) {
      category = 'character_avatar';
      equipSlot = 'avatar';
      rarity = 'legendary';
      boneCount = 32;
      triangleBudget = 3500;
      animations = ['idle', 'walk', 'run', 'hit', 'attack_01', 'cast_01'];
    } else if (lower.includes('wisp') || lower.includes('waechter') || lower.includes('boss') || lower.includes('mob')) {
      category = 'mob';
      equipSlot = 'mob';
      boneCount = 24;
      animations = ['idle', 'walk', 'run', 'hit', 'attack_01', 'cast_01'];
    } else if (lower.includes('archway') || lower.includes('gate') || lower.includes('portal') || lower.includes('tower')) {
      category = 'architecture';
      triangleBudget = 3500;
    }

    const cleanName = path.parse(fileName).name
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      name: cleanName,
      category,
      equipSlot,
      weaponType,
      rarity,
      itemStats,
      triangleBudget,
      boneCount,
      animations,
      description: `3D model scanned from ${relativePath}. Auto-configured for Aurion dynamic equipment swapping.`,
    };
  }

  // --- Real-time File-Watch Listener ---
  public startWatcher(dirPath: string = PRIMARY_GLB_ASSETS_DIR): boolean {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      if (this.watchers.has(dirPath)) {
        return true;
      }

      const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        if (!filename.endsWith('.glb') && !filename.endsWith('.gltf') && !filename.endsWith('.json')) return;

        // Debounce file changes (300ms) to avoid duplicate events on file writes
        const debounceKey = `${dirPath}:${filename}`;
        if (this.debounceTimers.has(debounceKey)) {
          clearTimeout(this.debounceTimers.get(debounceKey)!);
        }

        const timer = setTimeout(() => {
          this.handleWatchedFileEvent(dirPath, filename, eventType);
          this.debounceTimers.delete(debounceKey);
        }, 300);

        this.debounceTimers.set(debounceKey, timer);
      });

      watcher.on('error', (err) => {
        console.error(`[GLBWatcher] Error watching ${dirPath}:`, err);
      });

      this.watchers.set(dirPath, watcher);
      this.watchedDirectories.add(dirPath);
      this.isWatching = true;

      this.recordEvent({
        type: 'watcher_started',
        fileName: '*',
        directory: dirPath,
        message: `Live file-watch listener active on "${path.basename(dirPath)}". Auto-syncing incoming .glb models.`,
      });

      return true;
    } catch (err) {
      console.error(`[GLBWatcher] Failed to start watcher on ${dirPath}:`, err);
      return false;
    }
  }

  public stopWatcher(dirPath?: string): boolean {
    try {
      if (dirPath) {
        const watcher = this.watchers.get(dirPath);
        if (watcher) {
          watcher.close();
          this.watchers.delete(dirPath);
          this.watchedDirectories.delete(dirPath);
        }
      } else {
        for (const [_, watcher] of this.watchers.entries()) {
          watcher.close();
        }
        this.watchers.clear();
        this.watchedDirectories.clear();
      }

      this.isWatching = this.watchers.size > 0;

      this.recordEvent({
        type: 'watcher_stopped',
        fileName: '*',
        directory: dirPath || 'all',
        message: `File-watch listener paused for ${dirPath ? path.basename(dirPath) : 'all directories'}.`,
      });

      return true;
    } catch (err) {
      console.error('[GLBWatcher] Stop watcher error:', err);
      return false;
    }
  }

  private handleWatchedFileEvent(dirPath: string, filename: string, eventType: string) {
    const fullPath = path.join(dirPath, filename);
    const parsed = path.parse(filename);
    const id = parsed.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    if (!fs.existsSync(fullPath)) {
      // File was deleted
      if (filename.endsWith('.glb') || filename.endsWith('.gltf')) {
        this.catalog.delete(id);
        this.recordEvent({
          type: 'deleted',
          fileName: filename,
          modelId: id,
          directory: dirPath,
          message: `Model file removed: "${filename}". Unregistered from dynamic equipment vault.`,
        });
      }
      return;
    }

    // File was added or modified
    if (filename.endsWith('.glb') || filename.endsWith('.gltf')) {
      const stats = fs.statSync(fullPath);
      const isNew = !this.catalog.has(id);
      
      // Perform full scan reconciliation
      this.scanDirectory(dirPath);
      const registered = this.catalog.get(id);

      this.recordEvent({
        type: isNew ? 'added' : 'modified',
        fileName: filename,
        modelId: id,
        category: registered?.category,
        directory: dirPath,
        message: isNew
          ? `[NEW MODEL DETECTED] "${registered?.name || filename}" registered into dynamic equipment vault!`
          : `[MODEL UPDATED] "${registered?.name || filename}" synchronized (${(stats.size / 1024).toFixed(1)} KB).`,
        details: registered,
      });
    } else if (filename.endsWith('.json')) {
      // Companion metadata updated
      this.scanDirectory(dirPath);
      const modelId = parsed.name;
      const registered = this.catalog.get(modelId);
      this.recordEvent({
        type: 'modified',
        fileName: filename,
        modelId,
        category: registered?.category,
        directory: dirPath,
        message: `Metadata updated for model "${registered?.name || modelId}".`,
      });
    }
  }

  // --- Event Recording & Notification Bus ---
  private recordEvent(event: Omit<GLBWatchEvent, 'id' | 'timestamp'>) {
    const fullEvent: GLBWatchEvent = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
    };

    this.eventHistory.unshift(fullEvent);
    if (this.eventHistory.length > 100) {
      this.eventHistory.pop();
    }

    for (const listener of this.listeners) {
      try {
        listener(fullEvent);
      } catch (err) {
        console.warn('[GLBRegistry] Error in event listener:', err);
      }
    }
  }

  public onEvent(listener: (event: GLBWatchEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getWatchStatus(): GLBWatchStatus {
    return {
      isWatching: this.isWatching,
      watchedDirectories: Array.from(this.watchedDirectories),
      totalModels: this.catalog.size,
      activeDirectory: this.activeDirectoryPath,
      lastScanTime: this.lastScanTime,
      lastEventTime: this.eventHistory[0]?.timestamp || null,
      recentEvents: this.eventHistory.slice(0, 25),
    };
  }

  public getAll(): GLBModelItem[] {
    if (this.catalog.size === 0) {
      this.scanDirectory();
    }
    return Array.from(this.catalog.values());
  }

  public getById(id: string): GLBModelItem | undefined {
    return this.catalog.get(id) || this.getAll().find((m) => m.id === id);
  }

  // --- Upload & Direct Registration ---
  public registerOrUploadModel(
    fileName: string,
    fileBuffer: Buffer | null,
    metadata: Partial<GLBModelItem>,
    targetDir: string = PRIMARY_GLB_ASSETS_DIR
  ): GLBModelItem {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const cleanFileName = fileName.endsWith('.glb') || fileName.endsWith('.gltf') ? fileName : `${fileName}.glb`;
    const id = metadata.id || path.parse(cleanFileName).name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const targetFilePath = path.join(targetDir, cleanFileName);

    if (fileBuffer) {
      fs.writeFileSync(targetFilePath, fileBuffer);
    } else if (!fs.existsSync(targetFilePath)) {
      const defaultGlb = createMinimalGLB(metadata.name || id);
      fs.writeFileSync(targetFilePath, defaultGlb);
    }

    const stats = fs.statSync(targetFilePath);
    const isPublic = targetDir.includes('public');
    const relativePath = cleanFileName;
    const url = isPublic ? `/models/glb/${cleanFileName}` : `/glb-assets/${cleanFileName}`;

    const item: GLBModelItem = {
      id,
      name: metadata.name || id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      fileName: cleanFileName,
      relativePath,
      url,
      category: metadata.category || 'weapon',
      equipSlot: metadata.equipSlot || (metadata.category as string) || 'weapon',
      weaponType: metadata.weaponType,
      rarity: metadata.rarity || 'epic',
      itemStats: metadata.itemStats || { attack: 75, armor: 25 },
      triangleBudget: metadata.triangleBudget || Math.min(5000, Math.round(stats.size / 200)),
      boneCount: metadata.boneCount || 0,
      fileSizeBytes: stats.size,
      status: metadata.status || 'ready',
      animations: metadata.animations || ['idle', 'walk', 'run', 'hit', 'attack_01', 'cast_01'],
      description: metadata.description || 'External GLB model uploaded by admin.',
      referenceUrl: metadata.referenceUrl,
      author: metadata.author || 'Admin Pipeline',
      sourceDirectory: targetDir,
      uploadedAt: stats.mtime.toISOString(),
      lastScannedAt: new Date().toISOString(),
    };

    // Save companion JSON metadata
    const metaPath = path.join(targetDir, `${id}.json`);
    fs.writeFileSync(metaPath, JSON.stringify(item, null, 2), 'utf8');

    this.catalog.set(id, item);

    this.recordEvent({
      type: 'added',
      fileName: cleanFileName,
      modelId: id,
      category: item.category,
      directory: targetDir,
      message: `Uploaded & registered "${item.name}" into dynamic equipment vault.`,
      details: item,
    });

    return item;
  }

  public deleteModel(id: string): boolean {
    const item = this.getById(id);
    if (!item) return false;

    try {
      const fullPath = path.join(item.sourceDirectory || PRIMARY_GLB_ASSETS_DIR, item.relativePath || item.fileName);
      const metaPath = path.join(path.dirname(fullPath), `${id}.json`);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
      this.catalog.delete(id);

      this.recordEvent({
        type: 'deleted',
        fileName: item.fileName,
        modelId: id,
        directory: item.sourceDirectory,
        message: `Deleted model "${item.name}" (${id}).`,
      });

      return true;
    } catch (err) {
      console.error(`[GLBRegistry] Delete model error for ${id}:`, err);
      return false;
    }
  }
}

export const glbRegistry = new GLBRegistryService();
