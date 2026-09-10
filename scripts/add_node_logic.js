import fs from 'fs';

// 1. Add them to MMOEngine state
let enginePath = 'src/core/MMOEngine.ts';
let engineCode = fs.readFileSync(enginePath, 'utf8');

if (!engineCode.includes('public resourceNodes: ResourceNode[]')) {
  engineCode = engineCode.replace(/export class MMOEngine \{/, 'export class MMOEngine {\n  public resourceNodes: ResourceNode[] = [];\n  private nodeMeshes: Map<string, THREE.Mesh> = new Map();');
}

// 2. Import INITIAL_RESOURCE_NODES & ResourceNode
if (!engineCode.includes('INITIAL_RESOURCE_NODES')) {
  engineCode = engineCode.replace(/import \{([\s\S]*?)INITIAL_NPCS/m, 'import { INITIAL_RESOURCE_NODES, $1INITIAL_NPCS');
}
if (!engineCode.includes('ResourceNode')) {
  engineCode = engineCode.replace(/import \{([\s\S]*?)SimulatedPlayer/m, 'import { ResourceNode, $1SimulatedPlayer');
}

// 3. Initialize them
const initNodes = `
    // Initialize Resource Nodes
    this.resourceNodes = JSON.parse(JSON.stringify(INITIAL_RESOURCE_NODES));
    this.resourceNodes.forEach(node => this.spawnResourceNode(node));
`;
if (!engineCode.includes('this.resourceNodes = JSON.parse')) {
  engineCode = engineCode.replace(/this\.spawnNPC\(npc\);\n    \}\);/, 'this.spawnNPC(npc);\n    });\n' + initNodes);
}

// 4. Add spawnResourceNode method
const spawnNodeFunc = `
  private spawnResourceNode(node: ResourceNode) {
    if (this.nodeMeshes.has(node.id)) return;
    const geometry = new THREE.DodecahedronGeometry(1.5);
    const material = new THREE.MeshStandardMaterial({ color: node.color, roughness: 0.7, metalness: 0.3 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(node.x, node.y + 1, node.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.nodeMeshes.set(node.id, mesh);
    
    // Add collision
    collisionSystem.addStaticCollider(node.id, node.x, node.y + 1, node.z, 2.0);
  }
`;
if (!engineCode.includes('private spawnResourceNode')) {
  engineCode = engineCode.replace(/private spawnNPC/, spawnNodeFunc + '\n  private spawnNPC');
}

// 5. Add gather interaction logic to interactNearby
const gatherLogic = `
    // Check Resource Nodes
    for (const node of this.resourceNodes) {
      if (node.isDepleted) continue;
      const dist = Math.hypot(node.x - this.player.position.x, node.z - this.player.position.z);
      if (dist < 4.0) {
        // Check tool
        const tool = this.player.inventory.find(i => i.slot === 'tool' && i.name.includes(node.requiredToolCategory));
        if (!tool) {
          this.addFloatingText('Need ' + node.requiredToolCategory + '!', node.x, node.y + 3, '#ef4444');
          return {};
        }
        
        // Harvest
        node.amount -= 1;
        this.addFloatingText('+1 ' + node.name, node.x, node.y + 3, '#10b981');
        soundSynth.playAttackMelee(); // Pluck/Mine sound
        
        // Add to inventory
        const itemDef = RPG_ITEMS_DATABASE[node.resourceItemId];
        if (itemDef) {
          this.player.inventory.push({ ...itemDef, id: \`\${itemDef.id}_\${Date.now()}\` });
        }
        
        // Give XP to profession? (Simple mock for classless logic)
        this.addChatMessage('system', 'System', \`Gathered \${itemDef?.name}. (+XP)\`);
        
        if (node.amount <= 0) {
          node.isDepleted = true;
          const mesh = this.nodeMeshes.get(node.id);
          if (mesh) {
            mesh.visible = false;
            collisionSystem.removeCollider(node.id);
          }
          // Simple respawn timer
          setTimeout(() => {
            node.isDepleted = false;
            node.amount = 5;
            if (mesh) mesh.visible = true;
            collisionSystem.addStaticCollider(node.id, node.x, node.y + 1, node.z, 2.0);
          }, node.respawnTimeSeconds * 1000);
        }
        
        this.emitStateUpdate();
        return {};
      }
    }
`;
if (!engineCode.includes('// Check Resource Nodes')) {
  engineCode = engineCode.replace(/this\.emitStateUpdate\(\);\n    return \{ lootCollected \};/, gatherLogic + '\n    this.emitStateUpdate();\n    return { lootCollected };');
}

fs.writeFileSync(enginePath, engineCode);

