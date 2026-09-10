import fs from 'fs';
let file = 'src/world/WorldChunkManager.ts';
let code = fs.readFileSync(file, 'utf8');

// Add the ResourceDensityMap
const mapCode = `
export const ResourceDensityMap: Record<BiomeType, Record<string, number>> = {
  'whispering_forest': { wood: 1.8, herb: 1.5, ore: 0.5, fabric: 1.0, leather: 1.0 },
  'emberfall_march': { ore: 2.0, wood: 0.2, herb: 1.0, fabric: 1.0, leather: 1.0 },
  'void_crater': { ore: 2.5, wood: 0.0, herb: 0.2, fabric: 1.0, leather: 1.0 },
  'sanctum_capital': { wood: 1.0, ore: 1.0, herb: 1.0, fabric: 1.0, leather: 1.0 },
  'clockwork_woods': { wood: 1.5, ore: 1.2, herb: 0.8, fabric: 1.0, leather: 1.0 },
  'scorched_quarry': { wood: 0.1, ore: 2.2, herb: 0.3, fabric: 1.0, leather: 1.0 },
  'sunwatch_bastion': { wood: 1.0, ore: 1.0, herb: 1.0, fabric: 1.0, leather: 1.0 },
  'ancient_dungeon': { wood: 0.0, ore: 2.0, herb: 0.1, fabric: 1.0, leather: 1.0 },
  'frontier_border': { wood: 1.2, ore: 1.2, herb: 1.2, fabric: 1.0, leather: 1.0 },
};
`;

if (!code.includes('export const ResourceDensityMap')) {
    code = code.replace(/export class WorldChunkManager/, mapCode + '\nexport class WorldChunkManager');
}

// Replace the arbitrary generation logic
const regex = /const resourceDensity: Record<string, number> = \{ wood: 1\.0, ore: 1\.0, herb: 1\.0, fabric: 1\.0, leather: 1\.0 \};[\s\S]*?resourceDensity\.herb = 1\.0 \+ Math\.random\(\) \* 0\.5;\n\s*\}/;

const replacement = `const resourceDensity = ResourceDensityMap[biome] || { wood: 1.0, ore: 1.0, herb: 1.0, fabric: 1.0, leather: 1.0 };`;

code = code.replace(regex, replacement);

fs.writeFileSync(file, code);
