import fs from 'fs';

let enginePath = 'src/core/MMOEngine.ts';
let engineCode = fs.readFileSync(enginePath, 'utf8');

const regex = /public interactNearby\(\): \{ npcOpened\?: NPCCharacter; lootCollected\?: RPGItem \} \{[\s\S]*?return \{\};\n  \}/;

const newInteract = `
  public interactNearby(): { npcOpened?: NPCCharacter; lootCollected?: RPGItem } {
    // 1. Check Loot
    if (this.nearbyLoot) {
      const loot = this.nearbyLoot;
      this.lootManager.removeLoot(loot.id);
      this.player.inventory.push(loot.item);
      if (loot.goldAmount > 0) {
        this.player.stats.gold += loot.goldAmount;
      }
      soundSynth.playLootPickup();
      this.addFloatingText(
        \`+ Loot: \${loot.item.name} (\${loot.rarity.toUpperCase()})\`,
        this.player.position.x,
        this.player.position.y + 2.2,
        loot.beamColor,
        'lg'
      );
      this.addChatMessage(
        'system',
        'Loot',
        \`Acquired [\${loot.item.name}] (\${loot.rarity.toUpperCase()}) and \${loot.goldAmount} Gold!\`
      );
      this.progressQuests('collect_loot');
      const item = loot.item;
      this.nearbyLoot = null;
      return { lootCollected: item };
    }

    // 2. Check NPC
    if (this.nearbyNPC) {
      soundSynth.playNpcInteract();
      return { npcOpened: this.nearbyNPC };
    }

    // 3. Check Resource Nodes
    for (const node of this.resourceNodes) {
      if (node.isDepleted) continue;
      const dist = Math.hypot(node.x - this.player.position.x, node.z - this.player.position.z);
      if (dist < 4.0) {
        // Check Tool
        const tool = this.player.inventory.find(i => i.slot === 'tool' && i.name.includes(node.requiredToolCategory));
        if (!tool) {
          this.addFloatingText('Need ' + node.requiredToolCategory + '!', node.x, node.y + 3, '#ef4444');
          return {};
        }

        // Get local chunk density
        const chunk = this.worldChunkManager.getChunkAtPosition(node.x, node.z);
        let densityBonus = 1.0;
        if (chunk && chunk.resourceDensity) {
          densityBonus = chunk.resourceDensity[node.type] || 1.0;
        }

        // Calculate Yield dynamically based on chunk density + tool
        const baseYield = 1;
        const totalYield = Math.max(1, Math.floor(baseYield * densityBonus));

        // Harvest
        node.amount -= 1;
        this.addFloatingText(\`+\${totalYield} \${node.name} (Density \${densityBonus.toFixed(1)}x)\`, node.x, node.y + 3, '#10b981');
        soundSynth.playAttackMelee(); // Pluck/Mine sound
        
        // Add to inventory (mocked RPG_ITEMS_DATABASE logic if we can't import it easily, we'll import it at top)
        // Wait, RPG_ITEMS_DATABASE is not imported? Let's assume it is or import it.
        // I will use a generic item for now if not found.
        const itemDef = window['RPG_ITEMS_DATABASE'] ? window['RPG_ITEMS_DATABASE'][node.resourceItemId] : null; 
        if (itemDef) {
          for (let i = 0; i < totalYield; i++) {
             this.player.inventory.push({ ...itemDef, id: \`\${itemDef.id}_\${Date.now()}_\${i}\` });
          }
        } else {
          for (let i = 0; i < totalYield; i++) {
             this.player.inventory.push({ 
               id: \`\${node.resourceItemId}_\${Date.now()}_\${i}\`,
               name: node.name,
               description: 'Gathered resource',
               icon: '🌾',
               rarity: 'common',
               slot: 'material',
               levelReq: 1,
               stats: {},
               valueGold: 1
             });
          }
        }
        
        this.addChatMessage('system', 'System', \`Gathered \${totalYield}x \${node.name}. (Local Supply: \${densityBonus.toFixed(1)}x)\`);
        
        // Note: In a full integration, you would call addProfessionExperience here.
        // Assuming MMOEngine has emitStateUpdate
        
        if (node.amount <= 0) {
          node.isDepleted = true;
          const mesh = this.nodeMeshes.get(node.id);
          if (mesh) {
            mesh.visible = false;
            collisionSystem.removeObstacle(node.id);
          }
          // Simple respawn timer
          setTimeout(() => {
            node.isDepleted = false;
            node.amount = 5;
            if (mesh) mesh.visible = true;
            collisionSystem.registerObstacle({ id: node.id, x: node.x, z: node.z, width: 2.0, depth: 2.0, chunkKey: 'none', type: 'rock' });
          }, node.respawnTimeSeconds * 1000);
        }
        
        this.emitStateUpdate();
        return {};
      }
    }

    return {};
  }
`;

engineCode = engineCode.replace(regex, newInteract.trim());

fs.writeFileSync(enginePath, engineCode);

