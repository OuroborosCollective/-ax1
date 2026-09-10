import fs from 'fs';
const path = 'src/entities/OpenWorldPlayer.ts';
let code = fs.readFileSync(path, 'utf8');

const weaponMethod = `
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
        if (mastery.bonusStats.attack !== undefined) mastery.bonusStats.attack += 10;
        if (mastery.bonusStats.critChance !== undefined) mastery.bonusStats.critChance += 0.10;
      } else {
        if (mastery.bonusStats.attack !== undefined) mastery.bonusStats.attack += 2;
      }
      this.stats.totalMasteryLevel += 1;
    }
    if (leveledUp) this.recalculateStats();
    return { leveledUp, newLevel: mastery.level, mastery };
  }
`;

const armorMethod = `
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

      this.stats.statPoints += 1;

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

// we need to rip out the existing ones first
let newCode = code.replace(/public gainWeaponMasteryXp\([\s\S]*?return \{ leveledUp, newLevel: mastery\.level, mastery \};\n  \}/, weaponMethod);
newCode = newCode.replace(/public gainArmorMasteryXp\([\s\S]*?return \{ leveledUp, newLevel: mastery\.level, mastery \};\n  \}/, armorMethod);

fs.writeFileSync(path, newCode);
