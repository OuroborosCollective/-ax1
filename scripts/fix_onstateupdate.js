import fs from 'fs';
let file = 'src/core/MMOEngine.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/this\.onStateUpdate\?\.\(\);/g, `this.onStateUpdate?.({
        stats: { ...this.player.stats },
        equipment: { ...this.player.equipment },
        inventory: [...this.player.inventory],
        targetMob: this.targetMob,
        nearbyNPC: this.nearbyNPC,
        nearbyLoot: this.nearbyLoot,
        quests: this.player.quests || [],
        chatMessages: [],
        floatingTexts: [],
        simPlayers: Array.from(this.simPlayers.players.values()),
      });`);

fs.writeFileSync(file, code);
