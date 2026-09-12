import fs from 'fs';
let code = fs.readFileSync('src/core/MMOEngine.ts', 'utf8');

const meleePatch = `
    const nearby = this.mobManager.getNearbyMobs(hitCenter.x, hitCenter.z, skill.aoeRadius || 4.0);
    
    // Also damage destroyable environmental objects
    const hitRadius = skill.aoeRadius || 4.0;
    const obstacles = collisionSystem.getNearbyObstacles(hitCenter.x, hitCenter.z, hitRadius);
    for (const obs of obstacles) {
      if (obs.isDestroyable && obs.hp !== undefined && obs.hp > 0) {
        const dist = Math.hypot(obs.x - hitCenter.x, obs.z - hitCenter.z);
        if (dist <= hitRadius + obs.radius) {
          const dmg = Math.round(((skill.damage * impactMult) + this.player.stats.attackPower * 0.8) * 0.5); // Environmental damage
          obs.hp -= dmg;
          
          this.addFloatingText(\`-\${dmg}\`, obs.x, (obs.height || 4) + 1, '#d1d5db', 'md');
          
          if (obs.hp <= 0) {
            this.particleSystem.emit('rock_shatter', new THREE.Vector3(obs.x, 2, obs.z), '#9ca3af', 2.0);
            
            // Remove visually
            if (obs.chunkKey) {
              this.worldChunkManager.removeObstacleVisually(obs.chunkKey, obs.id);
            }
            // Remove collision
            collisionSystem.removeObstacle(obs.id);
            
            // Give loot
            if (obs.loots && obs.loots.length > 0) {
               obs.loots.forEach(lootId => {
                  this.player.inventory[lootId] = (this.player.inventory[lootId] || 0) + 1;
                  this.addChatMessage('system', 'Loot', \`\${obs.name} zerstört. +1 \${lootId} erhalten.\`);
               });
               this.triggerGameEvent('inventory_update', this.player.inventory);
            }
          } else {
             this.particleSystem.emit('dust_impact', new THREE.Vector3(obs.x, 1, obs.z), '#d1d5db', 1.0);
          }
        }
      }
    }
`;

code = code.replace(/const nearby = this\.mobManager\.getNearbyMobs\(hitCenter\.x, hitCenter\.z, skill\.aoeRadius \|\| 4\.0\);/g, meleePatch);
fs.writeFileSync('src/core/MMOEngine.ts', code);
