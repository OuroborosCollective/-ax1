import fs from 'fs';

let enginePath = 'src/core/MMOEngine.ts';
let engineCode = fs.readFileSync(enginePath, 'utf8');

engineCode = engineCode.replace(/collisionSystem\.addStaticCollider\(node\.id, node\.x, node\.y \+ 1, node\.z, 2\.0\);/g, 
"collisionSystem.registerObstacle({ id: node.id, x: node.x, z: node.z, width: 2.0, depth: 2.0, chunkKey: 'none', type: 'scenery' });");

engineCode = engineCode.replace(/collisionSystem\.removeCollider\(node\.id\);/g, 
"collisionSystem.removeObstacle(node.id);");

fs.writeFileSync(enginePath, engineCode);

