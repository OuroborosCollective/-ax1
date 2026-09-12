import fs from 'fs';
let code = fs.readFileSync('src/core/MMOEngine.ts', 'utf8');

const findBlock = `        this.projectiles.push({
      mesh: projMesh,
      startPos: startPos,
      targetPos: finalTargetPos,
      progress: 0,
      speed: skill.speed || 15,
      damage: totalDmg,
      isCrit: isCrit,
      targetMobId: hitObstacle ? null : this.targetMob.id,
      color: skill.color,
      hitObstacle: hitObstacle,
    });

    this.projectiles.push({
      mesh: projMesh,
      startPos,
      targetPos,
      progress: 0,
      speed: 35.0,
      damage: totalDmg,
      isCrit,
      targetMobId: this.targetMob.id,
      color: skill.color,
    });`;

const replaceBlock = `        this.projectiles.push({
      mesh: projMesh,
      startPos: startPos,
      targetPos: finalTargetPos,
      progress: 0,
      speed: skill.speed || 15,
      damage: totalDmg,
      isCrit: isCrit,
      targetMobId: hitObstacle ? null : this.targetMob.id,
      color: skill.color,
      hitObstacle: hitObstacle,
    });`;

code = code.replace(findBlock, replaceBlock);
fs.writeFileSync('src/core/MMOEngine.ts', code);
