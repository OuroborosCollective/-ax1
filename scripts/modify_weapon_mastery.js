import fs from 'fs';

const path = 'src/entities/OpenWorldPlayer.ts';
let code = fs.readFileSync(path, 'utf8');

const weaponMasteryLevelUp = `
      this.stats.statPoints += 1;

      if (mastery.level % 10 === 0) {
        if (mastery.bonusStats.attack) mastery.bonusStats.attack += 10;
        if (mastery.bonusStats.critChance) mastery.bonusStats.critChance += 0.10;
      } else {
        if (mastery.bonusStats.attack) mastery.bonusStats.attack += 2;
      }
`;

code = code.replace(/this\.stats\.statPoints \+= 1;[\s\S]*?\/\/\s*Scale mastery stats[\s\S]*?if\s*\(mastery\.bonusStats\.attack\)\s*mastery\.bonusStats\.attack \+= 4;/, weaponMasteryLevelUp);

fs.writeFileSync(path, code);
