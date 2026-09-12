const fs = require('fs');
let code = fs.readFileSync('src/core/MMOEngine.ts', 'utf8');
console.log(code.includes('collisionSystem.getAllObstacles()'));
