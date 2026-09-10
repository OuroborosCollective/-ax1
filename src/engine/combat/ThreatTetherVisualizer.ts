import * as THREE from 'three';

export interface TargetPositionInfo {
  x: number;
  y: number;
  z: number;
  isPlayer: boolean;
  isAlive: boolean;
  name?: string;
}

interface TetherEntry {
  mobId: string;
  targetId: string;
  line: THREE.Line;
  glowLine: THREE.Line;
  material: THREE.LineBasicMaterial;
  glowMaterial: THREE.LineBasicMaterial;
  isPlayerTarget: boolean;
}

/**
 * ThreatTetherVisualizer
 * Renders glowing 3D aggro indicator lines linking mobs to their current threat targets.
 * Features dynamic color coding (Crimson red for local hero target, Amber gold for allies/tanks),
 * pulsating aetherial energy resonance, and instant retargeting/removal.
 */
export class ThreatTetherVisualizer {
  private scene: THREE.Scene;
  private tethers: Map<string, TetherEntry> = new Map();
  private animTimer: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Update or create tether connecting mob to target.
   */
  public updateTether(
    mobId: string,
    mobPos: { x: number; y: number; z: number; height?: number },
    targetId: string | null,
    targetPosInfo: TargetPositionInfo | null
  ): void {
    if (!targetId || !targetPosInfo || !targetPosInfo.isAlive) {
      this.hideTether(mobId);
      return;
    }

    const isPlayer = targetPosInfo.isPlayer || targetId === 'hero_player_1';
    let entry = this.tethers.get(mobId);

    const mobChestY = mobPos.y + (mobPos.height || 1.8) * 0.55;
    const targetChestY = targetPosInfo.y + 1.25;

    const start = new THREE.Vector3(mobPos.x, mobChestY, mobPos.z);
    const end = new THREE.Vector3(targetPosInfo.x, targetChestY, targetPosInfo.z);

    if (!entry) {
      const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
      const glowGeometry = new THREE.BufferGeometry().setFromPoints([start, end]);

      const coreColor = isPlayer ? 0xef4444 : 0xf59e0b;
      const glowColor = isPlayer ? 0xf43f5e : 0xfbbf24;

      const material = new THREE.LineBasicMaterial({
        color: coreColor,
        transparent: true,
        opacity: 0.95,
        linewidth: 2,
        depthWrite: false,
      });

      const glowMaterial = new THREE.LineBasicMaterial({
        color: glowColor,
        transparent: true,
        opacity: 0.55,
        linewidth: 4,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const line = new THREE.Line(geometry, material);
      line.renderOrder = 999;
      const glowLine = new THREE.Line(glowGeometry, glowMaterial);
      glowLine.renderOrder = 998;

      this.scene.add(line);
      this.scene.add(glowLine);

      entry = {
        mobId,
        targetId,
        line,
        glowLine,
        material,
        glowMaterial,
        isPlayerTarget: isPlayer,
      };
      this.tethers.set(mobId, entry);
    } else {
      // Update target color if target entity type switched
      if (entry.isPlayerTarget !== isPlayer || entry.targetId !== targetId) {
        entry.isPlayerTarget = isPlayer;
        entry.targetId = targetId;
        const coreColor = isPlayer ? 0xef4444 : 0xf59e0b;
        const glowColor = isPlayer ? 0xf43f5e : 0xfbbf24;
        entry.material.color.setHex(coreColor);
        entry.glowMaterial.color.setHex(glowColor);
      }

      entry.line.visible = true;
      entry.glowLine.visible = true;

      // Update geometry positions
      const linePositions = entry.line.geometry.attributes.position as THREE.BufferAttribute;
      linePositions.setXYZ(0, start.x, start.y, start.z);
      linePositions.setXYZ(1, end.x, end.y, end.z);
      linePositions.needsUpdate = true;

      const glowPositions = entry.glowLine.geometry.attributes.position as THREE.BufferAttribute;
      glowPositions.setXYZ(0, start.x, start.y, start.z);
      glowPositions.setXYZ(1, end.x, end.y, end.z);
      glowPositions.needsUpdate = true;
    }
  }

  /**
   * Tick animation for pulsating energy tethers.
   */
  public update(delta: number): void {
    this.animTimer += delta * 7.0;
    const pulse = 0.75 + Math.sin(this.animTimer) * 0.25;

    this.tethers.forEach((entry) => {
      if (entry.line.visible) {
        if (entry.isPlayerTarget) {
          // Intense pulse for hero target to alert danger
          entry.material.opacity = Math.min(1.0, pulse * 1.05);
          entry.glowMaterial.opacity = 0.45 + Math.sin(this.animTimer * 1.5) * 0.25;
        } else {
          entry.material.opacity = 0.75 + Math.sin(this.animTimer * 0.8) * 0.15;
          entry.glowMaterial.opacity = 0.35 + Math.sin(this.animTimer * 0.8) * 0.15;
        }
      }
    });
  }

  public hideTether(mobId: string): void {
    const entry = this.tethers.get(mobId);
    if (entry) {
      entry.line.visible = false;
      entry.glowLine.visible = false;
    }
  }

  public removeTether(mobId: string): void {
    const entry = this.tethers.get(mobId);
    if (entry) {
      this.scene.remove(entry.line);
      this.scene.remove(entry.glowLine);
      entry.line.geometry.dispose();
      entry.glowLine.geometry.dispose();
      entry.material.dispose();
      entry.glowMaterial.dispose();
      this.tethers.delete(mobId);
    }
  }

  public hideAll(): void {
    this.tethers.forEach((entry) => {
      entry.line.visible = false;
      entry.glowLine.visible = false;
    });
  }

  public dispose(): void {
    this.tethers.forEach((entry) => {
      this.scene.remove(entry.line);
      this.scene.remove(entry.glowLine);
      entry.line.geometry.dispose();
      entry.glowLine.geometry.dispose();
      entry.material.dispose();
      entry.glowMaterial.dispose();
    });
    this.tethers.clear();
  }
}
