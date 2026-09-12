import fs from 'fs';
let code = fs.readFileSync('src/world/WorldChunkManager.ts', 'utf8');

const method = `
  public removeObstacleVisually(chunkKey: string, obstacleId: string) {
    const chunkMesh = this.chunkMeshes.get(chunkKey);
    if (!chunkMesh) return;
    const obj = chunkMesh.getObjectByName(obstacleId);
    if (obj) {
      chunkMesh.remove(obj);
      // We could also do proper disposal here
    }
  }
`;

code = code.replace(/public getChunk\(chunkKey: string/g, method + "\n  public getChunk(chunkKey: string");
fs.writeFileSync('src/world/WorldChunkManager.ts', code);
