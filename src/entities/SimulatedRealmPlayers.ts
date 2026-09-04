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

      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(def.color),
        metalness: 0.7,
        roughness: 0.3,
      });

      // Body
      const bodyGeo = new THREE.BoxGeometry(0.8, 1.2, 0.5);
      const body = new THREE.Mesh(bodyGeo, mat);
      body.position.y = 1.2;
      group.add(body);

      // Head
      const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const head = new THREE.Mesh(headGeo, mat);
      head.position.y = 2.0;
      group.add(head);

      // Weapon
      const weaponGeo = new THREE.BoxGeometry(0.15, 1.4, 0.1);
      const weapon = new THREE.Mesh(weaponGeo, mat);
      weapon.position.set(0.6, 1.2, 0.3);
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
