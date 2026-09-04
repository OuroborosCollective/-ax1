import * as THREE from 'three';

/**
 * Visual parameter tokens adhering strictly to Echoes of Aurion art direction:
 * - Honey-stone & Weathered Sandstone: (#d4af37, #b8860b, #e6c687, #292524)
 * - Brushed Bronze & Steampunk Brass: (#cd7f32, #a0522d, #8b5a2b, #f59e0b)
 * - Midnight-Petrol Negative Space: (#040d1a, #081a2e, #0a192f)
 * - Aurion-Türkis (Turquoise Energy): (#00f0ff, #22d3ee, #06b6d4, #14b8a6)
 */
export interface AurionStylePalette {
  primaryBronze: number;
  secondaryBronze: number;
  darkPetrol: number;
  voidBlack: number;
  honeyStone: number;
  weatheredStone: number;
  aurionTurquoise: number;
  aetherGlow: number;
  corruptedRed: number;
  moltenOrange: number;
  goldTrim: number;
}

export const AURION_PALETTE: AurionStylePalette = {
  primaryBronze: 0xcd7f32,
  secondaryBronze: 0x8b5a2b,
  darkPetrol: 0x0a192f,
  voidBlack: 0x040d1a,
  honeyStone: 0xd4af37,
  weatheredStone: 0x292524,
  aurionTurquoise: 0x00f0ff,
  aetherGlow: 0x22d3ee,
  corruptedRed: 0xef4444,
  moltenOrange: 0xf97316,
  goldTrim: 0xf59e0b,
};

export class AssetStyleRegistry {
  private static instance: AssetStyleRegistry;

  // Cached materials for zero-alloc performance
  private materialsCache: Map<string, THREE.Material> = new Map();

  public static getInstance(): AssetStyleRegistry {
    if (!AssetStyleRegistry.instance) {
      AssetStyleRegistry.instance = new AssetStyleRegistry();
    }
    return AssetStyleRegistry.instance;
  }

  /**
   * Returns a configured PBR material conforming to the Aurion steampunk aesthetic
   */
  public getMaterial(type: 'bronze' | 'darkPetrol' | 'honeyStone' | 'turquoiseGlow' | 'goldTrim' | 'corruptedGlow' | 'magmaGlow', options?: { roughness?: number; metalness?: number; emissiveIntensity?: number }): THREE.MeshStandardMaterial {
    const cacheKey = `${type}_${options?.roughness ?? 'def'}_${options?.metalness ?? 'def'}_${options?.emissiveIntensity ?? 'def'}`;
    if (this.materialsCache.has(cacheKey)) {
      return this.materialsCache.get(cacheKey) as THREE.MeshStandardMaterial;
    }

    let mat: THREE.MeshStandardMaterial;

    switch (type) {
      case 'bronze':
        mat = new THREE.MeshStandardMaterial({
          color: AURION_PALETTE.primaryBronze,
          metalness: options?.metalness ?? 0.85,
          roughness: options?.roughness ?? 0.28,
        });
        break;
      case 'darkPetrol':
        mat = new THREE.MeshStandardMaterial({
          color: AURION_PALETTE.darkPetrol,
          metalness: options?.metalness ?? 0.3,
          roughness: options?.roughness ?? 0.7,
        });
        break;
      case 'honeyStone':
        mat = new THREE.MeshStandardMaterial({
          color: AURION_PALETTE.honeyStone,
          roughness: options?.roughness ?? 0.85,
          metalness: options?.metalness ?? 0.15,
        });
        break;
      case 'goldTrim':
        mat = new THREE.MeshStandardMaterial({
          color: AURION_PALETTE.goldTrim,
          metalness: options?.metalness ?? 0.95,
          roughness: options?.roughness ?? 0.2,
        });
        break;
      case 'turquoiseGlow':
        mat = new THREE.MeshStandardMaterial({
          color: AURION_PALETTE.aurionTurquoise,
          emissive: AURION_PALETTE.aurionTurquoise,
          emissiveIntensity: options?.emissiveIntensity ?? 2.0,
          roughness: 0.2,
        });
        break;
      case 'corruptedGlow':
        mat = new THREE.MeshStandardMaterial({
          color: AURION_PALETTE.corruptedRed,
          emissive: AURION_PALETTE.corruptedRed,
          emissiveIntensity: options?.emissiveIntensity ?? 2.2,
          roughness: 0.2,
        });
        break;
      case 'magmaGlow':
        mat = new THREE.MeshStandardMaterial({
          color: AURION_PALETTE.moltenOrange,
          emissive: AURION_PALETTE.corruptedRed,
          emissiveIntensity: options?.emissiveIntensity ?? 2.4,
          roughness: 0.2,
        });
        break;
      default:
        mat = new THREE.MeshStandardMaterial({
          color: AURION_PALETTE.primaryBronze,
          metalness: 0.8,
          roughness: 0.3,
        });
    }

    this.materialsCache.set(cacheKey, mat);
    return mat;
  }

  /**
   * Generates a stylized articulated humanoid avatar mesh
   */
  public createArticulatedHumanoid(primaryColorHex: number = AURION_PALETTE.primaryBronze): THREE.Group {
    const root = new THREE.Group();

    const bronzeMat = this.getMaterial('bronze');
    const customMat = new THREE.MeshStandardMaterial({
      color: primaryColorHex,
      metalness: 0.85,
      roughness: 0.28,
    });
    const darkMat = this.getMaterial('darkPetrol');
    const glowMat = this.getMaterial('turquoiseGlow');
    const goldMat = this.getMaterial('goldTrim');

    // Articulated Torso with Segmented Plating
    const torsoGeo = new THREE.CylinderGeometry(0.30, 0.22, 0.70, 8);
    const torso = new THREE.Mesh(torsoGeo, customMat);
    torso.position.y = 1.15;
    root.add(torso);

    // Glowing Leyline Reactor
    const coreGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8);
    coreGeo.rotateX(Math.PI / 2);
    const core = new THREE.Mesh(coreGeo, glowMat);
    core.position.set(0, 1.25, 0.18);
    root.add(core);

    // Sculpted Head / Helmet with Visor
    const headGeo = new THREE.CylinderGeometry(0.18, 0.20, 0.32, 8);
    const head = new THREE.Mesh(headGeo, bronzeMat);
    head.position.y = 1.75;
    root.add(head);

    const visorGeo = new THREE.BoxGeometry(0.24, 0.06, 0.12);
    const visor = new THREE.Mesh(visorGeo, glowMat);
    visor.position.set(0, 1.76, 0.14);
    root.add(visor);

    // Pauldrons
    const pauldronGeo = new THREE.ConeGeometry(0.16, 0.28, 5);
    const leftP = new THREE.Mesh(pauldronGeo, goldMat);
    leftP.position.set(-0.40, 1.45, 0);
    leftP.rotation.z = Math.PI / 4;
    root.add(leftP);

    const rightP = new THREE.Mesh(pauldronGeo, goldMat);
    rightP.position.set(0.40, 1.45, 0);
    rightP.rotation.z = -Math.PI / 4;
    root.add(rightP);

    // Limbs
    const armGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.60, 6);
    const leftArm = new THREE.Mesh(armGeo, darkMat);
    leftArm.position.set(-0.40, 1.05, 0);
    root.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, darkMat);
    rightArm.position.set(0.40, 1.05, 0);
    root.add(rightArm);

    const legGeo = new THREE.CylinderGeometry(0.10, 0.08, 0.70, 6);
    const leftLeg = new THREE.Mesh(legGeo, darkMat);
    leftLeg.position.set(-0.16, 0.40, 0);
    root.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, darkMat);
    rightLeg.position.set(0.16, 0.40, 0);
    root.add(rightLeg);

    return root;
  }
}

export const assetStyleRegistry = AssetStyleRegistry.getInstance();
