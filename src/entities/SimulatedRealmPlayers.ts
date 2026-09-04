import * as THREE from 'three';
import { CharacterClassId, SimulatedPlayer } from '../types';
import { MMORPG_CLASSES } from '../data/mmorpgData';

export class SimulatedRealmPlayers {
  public scene: THREE.Scene;
  public players: { data: SimulatedPlayer; group: THREE.Group }[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.spawnRealmAdventurers();
  }

  private spawnRealmAdventurers() {
    const adventurerNames = [
      { name: 'Sir_Galahad_99', classId: 'knight' as CharacterClassId, guild: '<Iron Dawn>', x: -8, z: -10 },
      { name: 'ArcaneLilly', classId: 'mage' as CharacterClassId, guild: '<Chrono Order>', x: 12, z: -8 },
      { name: 'ShadowStrike_X', classId: 'ranger' as CharacterClassId, guild: '<Silent Fang>', x: 42, z: -32 },
      { name: 'SteamMechanic_Gabe', classId: 'engineer' as CharacterClassId, guild: '<Cog Syndicate>', x: -35, z: -14 },
      { name: 'Valkyrie_Aurora', classId: 'knight' as CharacterClassId, guild: '<Iron Dawn>', x: 60, z: -48 },
      { name: 'VoidWalker_Null', classId: 'mage' as CharacterClassId, guild: '<Eclipse>', x: 2, z: 45 },
    ];

    adventurerNames.forEach((adv, i) => {
      const def = MMORPG_CLASSES[adv.classId];
      const group = new THREE.Group();
      group.position.set(adv.x, 0, adv.z);

      const color = new THREE.Color(def.color);
      const primaryColorHex = color.getHex();

      const bronzeMat = new THREE.MeshStandardMaterial({
        color: primaryColorHex,
        metalness: 0.85,
        roughness: 0.28,
      });
      const darkMat = new THREE.MeshStandardMaterial({
        color: 0x0a192f,
        roughness: 0.7,
      });
      const glowMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00f0ff,
        emissiveIntensity: 1.8,
      });

      // Articulated Torso
      const torsoGeo = new THREE.CylinderGeometry(0.30, 0.22, 0.70, 8);
      const torso = new THREE.Mesh(torsoGeo, bronzeMat);
      torso.position.y = 1.15;
      group.add(torso);

      // Glowing Leyline Core
      const coreGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8);
      coreGeo.rotateX(Math.PI / 2);
      const core = new THREE.Mesh(coreGeo, glowMat);
      core.position.set(0, 1.25, 0.18);
      group.add(core);

      // Sculpted Head & Helmet with Visor
      const headGeo = new THREE.CylinderGeometry(0.18, 0.20, 0.32, 8);
      const head = new THREE.Mesh(headGeo, bronzeMat);
      head.position.y = 1.75;
      group.add(head);

      const visorGeo = new THREE.BoxGeometry(0.24, 0.06, 0.12);
      const visor = new THREE.Mesh(visorGeo, glowMat);
      visor.position.set(0, 1.76, 0.14);
      group.add(visor);

      // Shoulders
      const pauldronGeo = new THREE.ConeGeometry(0.16, 0.28, 5);
      const leftP = new THREE.Mesh(pauldronGeo, bronzeMat);
      leftP.position.set(-0.40, 1.45, 0);
      leftP.rotation.z = Math.PI / 4;
      group.add(leftP);

      const rightP = new THREE.Mesh(pauldronGeo, bronzeMat);
      rightP.position.set(0.40, 1.45, 0);
      rightP.rotation.z = -Math.PI / 4;
      group.add(rightP);

      // Arms
      const armGeo = new THREE.CylinderGeometry(0.09, 0.07, 0.65, 6);
      const leftArm = new THREE.Mesh(armGeo, darkMat);
      leftArm.position.set(-0.42, 1.05, 0);
      group.add(leftArm);

      const rightArm = new THREE.Mesh(armGeo, darkMat);
      rightArm.position.set(0.42, 1.05, 0);
      group.add(rightArm);

      // Legs
      const legGeo = new THREE.CylinderGeometry(0.11, 0.08, 0.75, 6);
      const leftLeg = new THREE.Mesh(legGeo, darkMat);
      leftLeg.position.set(-0.16, 0.40, 0);
      group.add(leftLeg);

      const rightLeg = new THREE.Mesh(legGeo, darkMat);
      rightLeg.position.set(0.16, 0.40, 0);
      group.add(rightLeg);

      // Weapon
      const weaponGeo = new THREE.BoxGeometry(0.08, 1.2, 0.04);
      const weapon = new THREE.Mesh(weaponGeo, bronzeMat);
      weapon.position.set(0.55, 1.1, 0.2);
      group.add(weapon);

      this.scene.add(group);

      const data: SimulatedPlayer = {
        id: `sim_player_${i}`,
        name: adv.name,
        className: def.name,
        classId: adv.classId,
        level: 4 + Math.floor(Math.random() * 8),
        x: adv.x,
        y: 0,
        z: adv.z,
        action: 'patrolling',
        guildTag: adv.guild,
      };

      this.players.push({ data, group });
    });
  }

  public update(delta: number) {
    this.players.forEach((p) => {
      // Gentle roaming around their local area
      p.data.x += (Math.sin(Date.now() * 0.001 + parseInt(p.data.id.slice(-1))) * 2.5) * delta;
      p.data.z += (Math.cos(Date.now() * 0.0012 + parseInt(p.data.id.slice(-1))) * 2.5) * delta;
      p.group.position.set(p.data.x, 0, p.data.z);
      p.group.rotation.y += delta * 0.6;
    });
  }

  public getPlayers(): SimulatedPlayer[] {
    return this.players.map((p) => p.data);
  }
}
