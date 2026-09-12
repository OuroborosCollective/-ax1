import fs from 'fs';
let code = fs.readFileSync('src/core/MMOEngine.ts', 'utf8');

const interfaceReplacement = `interface ActiveProjectile {
  mesh: THREE.Mesh;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  progress: number;
  speed: number;
  damage: number;
  isCrit: boolean;
  targetMobId: string | null;
  color: string;
  hitObstacle?: any;
}`;

code = code.replace(/interface ActiveProjectile \{[\s\S]*?color: string;\n\}/m, interfaceReplacement);

const pushReplacement = `    this.projectiles.push({
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

code = code.replace(/this\.projectiles\.push\(\{\n      mesh: projMesh,\n      targetId: [\s\S]*?hitObstacle: hitObstacle,\n    \}\);/m, pushReplacement);

fs.writeFileSync('src/core/MMOEngine.ts', code);
