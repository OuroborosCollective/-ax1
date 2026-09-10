import fs from 'fs';
let file = 'src/world/WorldChunkManager.ts';
let code = fs.readFileSync(file, 'utf8');

const regex1 = /featureDescription: 'Goldverzierte Palaststraße, Aetherium-Brunnen & königliche Wachtürme',/;
code = code.replace(regex1, "featureDescription: 'Goldverzierte Palaststraße, Aetherium-Brunnen & königliche Wachtürme',\n      resourceDensity: { wood: 0.5, ore: 0.5, herb: 1.0 },");

const regex2 = /const chunkData: WorldChunkData = \{\s*chunkKey,\s*chunkX: cx,\s*chunkZ: cz,\s*centerX,\s*centerZ,\s*size: this\.chunkSize,\s*biome,\s*kingdom,\s*landmarkType,\s*landmarkName,\s*elevationBase,\s*materialTheme,\s*obstacles,\s*featureDescription: `\$\{kingdom\} - \$\{landmarkName\} mit \$\{obstacles\.length\} festen Objekten`,\s*createdAt: new Date\(\)\.toISOString\(\),\s*\};/;

const newCode = `
    const resourceDensity: Record<string, number> = { wood: 1.0, ore: 1.0, herb: 1.0, fabric: 1.0, leather: 1.0 };
    if (biome === 'whispering_forest') {
      resourceDensity.wood = 1.8;
      resourceDensity.herb = 1.5;
      resourceDensity.ore = 0.5;
    } else if (biome === 'ash_vaults' || biome === 'emberfall_march') {
      resourceDensity.ore = 2.0;
      resourceDensity.wood = 0.2;
    } else if (biome === 'void_crater') {
      resourceDensity.ore = 2.5;
      resourceDensity.wood = 0.0;
      resourceDensity.herb = 0.2;
    } else {
      resourceDensity.wood = 1.0 + Math.random() * 0.5;
      resourceDensity.ore = 1.0 + Math.random() * 0.5;
      resourceDensity.herb = 1.0 + Math.random() * 0.5;
    }

    const chunkData: WorldChunkData = {
      chunkKey,
      chunkX: cx,
      chunkZ: cz,
      centerX,
      centerZ,
      size: this.chunkSize,
      biome,
      kingdom,
      landmarkType,
      landmarkName,
      elevationBase,
      materialTheme,
      obstacles,
      resourceDensity,
      featureDescription: \`\${kingdom} - \${landmarkName} mit \${obstacles.length} festen Objekten\`,
      createdAt: new Date().toISOString(),
    };
`;

code = code.replace(regex2, newCode);

fs.writeFileSync(file, code);
