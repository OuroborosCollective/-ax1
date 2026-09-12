import fs from 'fs';
let code = fs.readFileSync('src/core/MMOEngine.ts', 'utf8');

const targetAoE = `        const nearby = this.mobManager.getNearbyMobs(hitPoint.x, hitPoint.z, splashRad);
        nearby.forEach((mob) => {
          const isCrit = deterministicRng.rollChance(this.player.stats.critChance * this.currentWeather.critMultiplierShadow);
          const baseDmg = dmg + (this.player.stats.spellPower + this.player.stats.attackPower) * 0.7;
          const totalDmg = Math.round(isCrit ? baseDmg * 1.8 : baseDmg);
          this.applyDamageToMob(mob.id, totalDmg, isCrit);
        });`;

const replacementAoE = `        const nearby = this.mobManager.getNearbyMobs(hitPoint.x, hitPoint.z, splashRad);
        nearby.forEach((mob) => {
          const isCrit = deterministicRng.rollChance(this.player.stats.critChance * this.currentWeather.critMultiplierShadow);
          const baseDmg = dmg + (this.player.stats.spellPower + this.player.stats.attackPower) * 0.7;
          const totalDmg = Math.round(isCrit ? baseDmg * 1.8 : baseDmg);
          this.applyDamageToMob(mob.id, totalDmg, isCrit);
        });

        // Damage environmental obstacles
        const hitRadius = splashRad;
        const obstacles = collisionSystem.getNearbyObstacles(hitPoint.x, hitPoint.z, hitRadius);
        for (const obs of obstacles) {
          if (obs.isDestroyable && obs.hp !== undefined && obs.hp > 0) {
            const dist = Math.hypot(obs.x - hitPoint.x, obs.z - hitPoint.z);
            if (dist <= hitRadius + obs.radius) {
              const baseDmg = dmg + (this.player.stats.spellPower + this.player.stats.attackPower) * 0.7;
              const obsDmg = Math.round(baseDmg * 0.5);
              obs.hp -= obsDmg;
              
              this.addFloatingText(\`-\${obsDmg}\`, obs.x, (obs.height || 4) + 1, '#d1d5db', 'md');
              
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
          }
        }`;

code = code.replace(targetAoE, replacementAoE);
fs.writeFileSync('src/core/MMOEngine.ts', code);
