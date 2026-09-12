import fs from 'fs';
let code = fs.readFileSync('src/core/MMOEngine.ts', 'utf8');

const targetStr = `      if (proj.progress >= 1.0) {
        this.scene.remove(proj.mesh);
        this.applyDamageToMob(proj.targetMobId, proj.damage, proj.isCrit);
      } else {
        remainingProjs.push(proj);
      }`;

const replacementStr = `      if (proj.progress >= 1.0) {
        this.scene.remove(proj.mesh);
        
        if (proj.hitObstacle) {
           const obs = proj.hitObstacle;
           if (obs.hp !== undefined) {
             obs.hp -= proj.damage;
             this.addFloatingText(\`-\${proj.damage}\`, obs.x, (obs.height || 4) + 1, '#d1d5db', 'md');
             if (obs.hp <= 0) {
                this.particleSystem.emit('rock_shatter', new THREE.Vector3(obs.x, 2, obs.z), '#9ca3af', 2.0);
                if (obs.chunkKey) {
                  this.worldChunkManager.removeObstacleVisually(obs.chunkKey, obs.id);
                }
                collisionSystem.removeObstacle(obs.id);
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
        } else {
           if (proj.targetMobId) {
             this.applyDamageToMob(proj.targetMobId, proj.damage, proj.isCrit);
           }
        }
      } else {
        remainingProjs.push(proj);
      }`;

code = code.replace(targetStr, replacementStr);
fs.writeFileSync('src/core/MMOEngine.ts', code);
