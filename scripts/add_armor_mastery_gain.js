import fs from 'fs';

const path = 'src/entities/OpenWorldPlayer.ts';
let code = fs.readFileSync(path, 'utf8');

// Add gainArmorMasteryXp
const armorMasteryFunc = `
  public gainArmorMasteryXp(
    type: ArmorType,
    amount: number
  ): { leveledUp: boolean; newLevel: number; mastery: ArmorMastery } {
    const mastery = this.stats.armorMasteries[type];
    if (!mastery) return { leveledUp: false, newLevel: 1, mastery: this.stats.armorMasteries.chest };

    mastery.xp += amount;
    let leveledUp = false;

    while (mastery.xp >= mastery.maxXp) {
      mastery.xp -= mastery.maxXp;
      mastery.level += 1;
      mastery.maxXp = Math.round(mastery.maxXp * 1.45);
      leveledUp = true;

      // Classless specific progression
      this.stats.statPoints += 1;

      // Every 10 levels the impact is increased by 0.10% (0.001 per level -> approx 1% per 10, or directly modifying)
      // The prompt says "alle 10 level den impact um 0,10% erhöht"
      if (mastery.level % 10 === 0) {
          mastery.bonusStats.armor += 5; 
          mastery.bonusStats.health += 50;
          mastery.bonusStats.dodgeChance += 0.1;
      } else {
          mastery.bonusStats.armor += 1;
          mastery.bonusStats.health += 10;
      }
      this.stats.totalMasteryLevel += 1;
    }
    if (leveledUp) this.recalculateStats();
    return { leveledUp, newLevel: mastery.level, mastery };
  }
`;

if (!code.includes('gainArmorMasteryXp(')) {
  code = code.replace(/public gainWeaponMasteryXp\(/, armorMasteryFunc + '\n  public gainWeaponMasteryXp(');
}

// Add cape to equipment initialization
code = code.replace(/boots: null,\s*relic: null,/g, 'boots: null,\n      cape: null,\n      relic: null,');

fs.writeFileSync(path, code);

