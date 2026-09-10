import fs from 'fs';
const path = 'src/entities/OpenWorldPlayer.ts';
let code = fs.readFileSync(path, 'utf8');

const weaponMasteryFunc = `
  public gainWeaponMasteryXp(
    type: WeaponType,
    amount: number
  ): { leveledUp: boolean; newLevel: number; mastery: WeaponMastery } {
    const mastery = this.stats.weaponMasteries[type];
    if (!mastery) return { leveledUp: false, newLevel: 1, mastery: this.stats.weaponMasteries.blade };

    mastery.xp += amount;
    let leveledUp = false;

    while (mastery.xp >= mastery.maxXp) {
      mastery.xp -= mastery.maxXp;
      mastery.level += 1;
      mastery.maxXp = Math.round(mastery.maxXp * 1.45);
      leveledUp = true;

      this.stats.statPoints += 1;

      if (mastery.level % 10 === 0) {
        if (mastery.bonusStats.attack) mastery.bonusStats.attack += 10;
        if (mastery.bonusStats.critChance) mastery.bonusStats.critChance += 0.10;
      } else {
        if (mastery.bonusStats.attack) mastery.bonusStats.attack += 2;
      }
      this.stats.totalMasteryLevel += 1;
    }
    if (leveledUp) this.recalculateStats();
    return { leveledUp, newLevel: mastery.level, mastery };
  }
`;

if (!code.includes('public gainWeaponMasteryXp')) {
  // Insert before gainArmorMasteryXp
  code = code.replace(/public gainArmorMasteryXp/, weaponMasteryFunc + '\n  public gainArmorMasteryXp');
}

fs.writeFileSync(path, code);
