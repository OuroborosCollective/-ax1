import fs from 'fs';
let code = fs.readFileSync('src/core/MMOEngine.ts', 'utf8');

const projectilePatch = `
    const targetPos = new THREE.Vector3(this.targetMob.x, 1.2, this.targetMob.z);
    
    // Line of sight check
    const los = lineOfSight.checkLineOfSight(startPos, targetPos);
    let finalTargetPos = targetPos;
    let hitObstacle = null;
    
    if (!los.hasLoS) {
      if (los.blockingObstacle && los.blockingObstacle.isDestroyable) {
         finalTargetPos = los.hitPoint || new THREE.Vector3(los.blockingObstacle.x, 1.2, los.blockingObstacle.z);
         hitObstacle = los.blockingObstacle;
      } else {
        this.addFloatingText('Sichtlinie blockiert!', this.targetMob.x, 2.0, '#94a3b8', 'md');
        return;
      }
    }
    
    const projGeo = new THREE.SphereGeometry(0.35, 8, 8);
    const projMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(skill.color) });
    const projMesh = new THREE.Mesh(projGeo, projMat);
    projMesh.position.copy(startPos);
    this.scene.add(projMesh);
    
    const impactMult = this.getSkillImpactMultiplier(skill);
    const isCrit = deterministicRng.rollChance(this.player.stats.critChance * this.currentWeather.critMultiplierShadow);
    const baseDmg = (skill.damage * impactMult) + (this.player.stats.spellPower || this.player.stats.attackPower) * 0.9;
    const totalDmg = Math.round(isCrit ? baseDmg * 1.9 : baseDmg);

    this.projectiles.push({
      mesh: projMesh,
      targetId: hitObstacle ? null : this.targetMob.id,
      targetPos: finalTargetPos,
      damage: totalDmg,
      isCrit: isCrit,
      speed: skill.speed || 15,
      type: skill.type,
      color: skill.color,
      hitObstacle: hitObstacle,
    });
`;

// wait, I need to match the original correctly
const pattern = /const targetPos = new THREE\.Vector3\(this\.targetMob\.x, 1\.2, this\.targetMob\.z\);[\s\S]*?const totalDmg = Math\.round\(isCrit \? baseDmg \* 1\.9 : baseDmg\);/m;
code = code.replace(pattern, projectilePatch.trim());
fs.writeFileSync('src/core/MMOEngine.ts', code);
