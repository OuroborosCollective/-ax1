import fs from 'fs';
let file = 'src/core/MMOEngine.ts';
let code = fs.readFileSync(file, 'utf8');

const target = "const chunk = this.worldChunkManager.getChunkAtPosition(node.x, node.z);";
const replacement = `const cx = Math.floor(node.x / this.worldChunkManager.chunkSize);
        const cz = Math.floor(node.z / this.worldChunkManager.chunkSize);
        const chunk = this.worldChunkManager.getChunk(\`\${cx},\${cz}\`);`;

code = code.replace(target, replacement);

// Also fix emitStateUpdate to onStateUpdate
code = code.replace(/this\.emitStateUpdate\(\);/g, "this.onStateUpdate?.();");

fs.writeFileSync(file, code);
