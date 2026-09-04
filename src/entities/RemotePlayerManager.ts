import * as THREE from 'three';
import { multiplayerClient, PeerPlayerState } from '../engine/net/MultiplayerClient';
import { MMORPG_CLASSES } from '../data/mmorpgData';
import { CharacterClassId, SimulatedPlayer } from '../types';

interface RemotePlayerVisual {
  data: PeerPlayerState;
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  weaponMesh: THREE.Mesh;
  healthBarMesh: THREE.Mesh;
  targetPos: THREE.Vector3;
  targetAngle: number;
  lastPacketTime: number;
}

/**
 * RemotePlayerManager
 * Manages real network multiplayer peer entities connected through WebSockets.
 * Provides client-side Hermite/Lerp interpolation, real equipment sockets,
 * overhead health bars, and network-synchronized actions.
 */
export class RemotePlayerManager {
  public scene: THREE.Scene;
  private players: Map<string, RemotePlayerVisual> = new Map();
  private unsubscribeList: (() => void)[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.bindNetworkEvents();
  }

  private bindNetworkEvents(): void {
    const un1 = multiplayerClient.on('player:joined', (packet: { player: PeerPlayerState }) => {
      if (packet.player && packet.player.id !== multiplayerClient.localPlayerId) {
        this.addOrUpdatePlayer(packet.player);
      }
    });

    const un2 = multiplayerClient.on('player:moved', (packet: any) => {
      if (packet.playerId && packet.playerId !== multiplayerClient.localPlayerId) {
        const visual = this.players.get(packet.playerId);
        if (visual) {
          visual.targetPos.set(packet.x, packet.y || 0, packet.z);
          visual.targetAngle = packet.facingAngle || 0;
          visual.data.hp = packet.hp ?? visual.data.hp;
          visual.data.maxHp = packet.maxHp ?? visual.data.maxHp;
          visual.data.actionState = packet.actionState || 'idle';
          visual.data.activeWeaponType = packet.activeWeaponType || visual.data.activeWeaponType;
          visual.lastPacketTime = performance.now();
        } else {
          // If we haven't seen them yet, construct from packet
          this.addOrUpdatePlayer({
            id: packet.playerId,
            name: `Player_${packet.playerId.substring(0, 5)}`,
            classId: 'knight',
            level: 1,
            hp: packet.hp || 200,
            maxHp: packet.maxHp || 200,
            x: packet.x,
            y: packet.y || 0,
            z: packet.z,
            facingAngle: packet.facingAngle || 0,
            activeWeaponType: packet.activeWeaponType || 'blade',
            isMounted: packet.isMounted || false,
            actionState: packet.actionState || 'idle',
          });
        }
      }
    });

    const un3 = multiplayerClient.on('player:left', (packet: { playerId: string }) => {
      this.removePlayer(packet.playerId);
    });

    const un4 = multiplayerClient.on('player:combat_action', (packet: any) => {
      const visual = this.players.get(packet.playerId);
      if (visual) {
        // Visual weapon swing or lunge
        visual.weaponMesh.rotation.x = Math.PI * 0.45;
        setTimeout(() => {
          visual.weaponMesh.rotation.x = 0;
        }, 220);
      }
    });

    this.unsubscribeList.push(un1, un2, un3, un4);
  }

  public addOrUpdatePlayer(state: PeerPlayerState): void {
    let visual = this.players.get(state.id);

    if (visual) {
      visual.targetPos.set(state.x, state.y, state.z);
      visual.targetAngle = state.facingAngle;
      visual.data = state;
      return;
    }

    // Build 3D articulated rig for remote player
    const group = new THREE.Group();
    group.position.set(state.x, state.y, state.z);

    const classDef = MMORPG_CLASSES[state.classId as CharacterClassId] || MMORPG_CLASSES.knight;
    const armorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(classDef.color || 0x00f0ff),
      metalness: 0.75,
      roughness: 0.35,
    });

    // Body Torso
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.2, 8);
    const bodyMesh = new THREE.Mesh(bodyGeo, armorMat);
    bodyMesh.position.y = 1.1;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Head / Helmet
    const headGeo = new THREE.SphereGeometry(0.32, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.y = 1.95;
    group.add(headMesh);

    // Weapon
    const wepGeo = new THREE.BoxGeometry(0.12, 1.3, 0.12);
    const wepMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9 });
    const weaponMesh = new THREE.Mesh(wepGeo, wepMat);
    weaponMesh.position.set(0.55, 1.1, 0.2);
    group.add(weaponMesh);

    // Overhead Health Bar
    const hpBgGeo = new THREE.PlaneGeometry(1.4, 0.15);
    const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, side: THREE.DoubleSide });
    const hpBg = new THREE.Mesh(hpBgGeo, hpBgMat);
    hpBg.position.y = 2.45;
    group.add(hpBg);

    const hpFgGeo = new THREE.PlaneGeometry(1.36, 0.11);
    const hpFgMat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide });
    const healthBarMesh = new THREE.Mesh(hpFgGeo, hpFgMat);
    healthBarMesh.position.set(0, 2.45, 0.01);
    group.add(healthBarMesh);

    this.scene.add(group);

    visual = {
      data: state,
      group,
      bodyMesh,
      weaponMesh,
      healthBarMesh,
      targetPos: new THREE.Vector3(state.x, state.y, state.z),
      targetAngle: state.facingAngle,
      lastPacketTime: performance.now(),
    };

    this.players.set(state.id, visual);
  }

  public removePlayer(playerId: string): void {
    const visual = this.players.get(playerId);
    if (visual) {
      this.scene.remove(visual.group);
      this.players.delete(playerId);
    }
  }

  public update(delta: number, cameraPos: THREE.Vector3): void {
    this.players.forEach((visual) => {
      // Smooth Hermite / Lerp interpolation to target network position
      visual.group.position.lerp(visual.targetPos, Math.min(1.0, delta * 12.0));

      // Shortest-arc angular interpolation
      let angleDiff = visual.targetAngle - visual.group.rotation.y;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      visual.group.rotation.y += angleDiff * Math.min(1.0, delta * 10.0);

      // Billboarding health bar to face camera
      visual.healthBarMesh.lookAt(cameraPos);

      // Update HP bar fill
      const hpPct = Math.max(0.01, Math.min(1.0, visual.data.hp / Math.max(1, visual.data.maxHp)));
      visual.healthBarMesh.scale.x = hpPct;

      // Bobbing walking animation if moving
      const isMoving = visual.group.position.distanceTo(visual.targetPos) > 0.08;
      if (isMoving) {
        visual.bodyMesh.position.y = 1.1 + Math.sin(performance.now() * 0.012) * 0.06;
      } else {
        visual.bodyMesh.position.y = 1.1;
      }
    });
  }

  public getPlayerCount(): number {
    return this.players.size;
  }

  public getPlayers(): SimulatedPlayer[] {
    const res: SimulatedPlayer[] = [];
    this.players.forEach((p) => {
      res.push({
        id: p.data.id,
        name: p.data.name,
        className: p.data.classId,
        classId: p.data.classId as CharacterClassId,
        level: p.data.level,
        x: p.group.position.x,
        y: p.group.position.y,
        z: p.group.position.z,
        action:
          p.data.actionState === 'attack' || p.data.actionState === 'hit' || p.data.actionState === 'cast'
            ? 'fighting'
            : p.data.isMounted
            ? 'riding'
            : p.data.actionState === 'run' || p.data.actionState === 'walk'
            ? 'patrolling'
            : 'resting',
        guildTag: '<Aurion Vanguard>',
      });
    });
    return res;
  }

  public dispose(): void {
    this.unsubscribeList.forEach((un) => un());
    this.players.forEach((p) => this.scene.remove(p.group));
    this.players.clear();
  }
}
