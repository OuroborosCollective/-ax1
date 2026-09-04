import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RPGItem, ItemSlot, WeaponType, ItemRarity } from '../types';

export interface GLBModelEntry {
  id: string;
  name: string;
  fileName: string;
  relativePath?: string;
  url: string;
  category:
    | 'character_avatar'
    | 'mob'
    | 'mount'
    | 'weapon'
    | 'shield'
    | 'offhand'
    | 'helmet'
    | 'chest'
    | 'shoulders'
    | 'arms'
    | 'legs'
    | 'boots'
    | 'prop'
    | 'architecture';
  equipSlot?: string;
  weaponType?: WeaponType;
  rarity?: ItemRarity;
  itemStats?: {
    attack?: number;
    spellPower?: number;
    armor?: number;
    critChance?: number;
    moveSpeed?: number;
    maxHp?: number;
    maxResource?: number;
  };
  triangleBudget: number;
  boneCount: number;
  fileSizeBytes: number;
  status: string;
  animations: string[];
  description: string;
  referenceUrl?: string;
  author?: string;
  sourceDirectory?: string;
  uploadedAt: string;
  lastScannedAt?: string;
}

export interface WatcherEvent {
  id: string;
  timestamp: string;
  type: 'added' | 'modified' | 'deleted' | 'scanned' | 'synced' | 'watcher_started' | 'watcher_stopped';
  fileName: string;
  modelId?: string;
  category?: string;
  directory: string;
  message: string;
  details?: any;
}

export interface WatchStatus {
  isWatching: boolean;
  watchedDirectories: string[];
  totalModels: number;
  activeDirectory: string;
  lastScanTime: string | null;
  lastEventTime: string | null;
  recentEvents: WatcherEvent[];
}

export class GLBModelManager {
  private static instance: GLBModelManager;
  private loader = new GLTFLoader();
  private cache: Map<string, { scene: THREE.Group; animations: THREE.AnimationClip[] }> = new Map();
  private catalog: GLBModelEntry[] = [];
  private isFetching = false;
  private eventSource: EventSource | null = null;
  private eventListeners: Set<(event: WatcherEvent) => void> = new Set();

  private constructor() {}

  public static getInstance(): GLBModelManager {
    if (!GLBModelManager.instance) {
      GLBModelManager.instance = new GLBModelManager();
    }
    return GLBModelManager.instance;
  }

  public async fetchCatalog(): Promise<GLBModelEntry[]> {
    if (this.isFetching) return this.catalog;
    this.isFetching = true;
    try {
      const res = await fetch('/api/models/glb');
      if (res.ok) {
        const data = await res.json();
        this.catalog = data.models || [];
      }
    } catch (err) {
      console.warn('Could not fetch external GLB catalog from server:', err);
    } finally {
      this.isFetching = false;
    }
    return this.catalog;
  }

  public getCachedCatalog(): GLBModelEntry[] {
    return this.catalog;
  }

  // Synchronous or Manual Directory Scan
  public async scanExternalDirectory(directoryPath?: string): Promise<{
    success: boolean;
    scannedDirectory: string;
    totalModels: number;
    models: GLBModelEntry[];
    watchStatus?: WatchStatus;
  }> {
    const url = directoryPath
      ? `/api/models/scan?dir=${encodeURIComponent(directoryPath)}`
      : '/api/models/scan';
    const res = await fetch(url, { method: 'POST' });
    const data = await res.json();
    if (data.models) {
      this.catalog = data.models;
    }
    return data;
  }

  // Get Watcher Status & Event Logs
  public async getWatchStatus(): Promise<WatchStatus | null> {
    try {
      const res = await fetch('/api/models/watch/status');
      if (res.ok) {
        const data = await res.json();
        return data.status;
      }
    } catch (err) {
      console.warn('Could not fetch watch status:', err);
    }
    return null;
  }

  // Toggle Live Watcher
  public async toggleFileWatcher(active: boolean, directory?: string): Promise<boolean> {
    try {
      const res = await fetch('/api/models/watch/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active, directory }),
      });
      if (res.ok) {
        await this.fetchCatalog();
        return true;
      }
    } catch (err) {
      console.warn('Could not toggle watcher:', err);
    }
    return false;
  }

  // Subscribe to live file events via SSE
  public subscribeToWatchEvents(onEvent: (event: WatcherEvent) => void): () => void {
    this.eventListeners.add(onEvent);

    if (!this.eventSource && typeof window !== 'undefined' && 'EventSource' in window) {
      try {
        this.eventSource = new EventSource('/api/models/events/stream');
        this.eventSource.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data);
            if (data.type !== 'connected') {
              // Automatically refresh catalog on new/updated files
              this.fetchCatalog();
              for (const listener of this.eventListeners) {
                listener(data);
              }
            }
          } catch {}
        };
        this.eventSource.onerror = () => {
          // EventSource will auto-retry
        };
      } catch (err) {
        console.warn('Could not initialize SSE EventSource:', err);
      }
    }

    return () => {
      this.eventListeners.delete(onEvent);
      if (this.eventListeners.size === 0 && this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
    };
  }

  // Convert GLB 3D Model into fully functional RPGItem for dynamic equipment swapping
  public convertToRpgItem(model: GLBModelEntry): RPGItem {
    let slot: ItemSlot = 'weapon';
    if (model.category === 'shield' || model.equipSlot === 'shield') slot = 'shield';
    else if (model.category === 'offhand' || model.equipSlot === 'offhand') slot = 'shield';
    else if (model.category === 'helmet' || model.equipSlot === 'helmet') slot = 'helmet';
    else if (model.category === 'chest' || model.equipSlot === 'chest') slot = 'chest';
    else if (model.category === 'shoulders' || model.equipSlot === 'shoulders') slot = 'shoulders';
    else if (model.category === 'arms' || model.equipSlot === 'arms') slot = 'arms';
    else if (model.category === 'legs' || model.equipSlot === 'legs') slot = 'legs';
    else if (model.category === 'boots' || model.equipSlot === 'boots') slot = 'boots';
    else if (model.category === 'character_avatar') slot = 'relic';

    let icon = '⚔️';
    if (slot === 'shield') icon = model.category === 'offhand' ? '📖' : '🛡️';
    else if (slot === 'helmet') icon = '🪖';
    else if (slot === 'chest') icon = '🥋';
    else if (model.weaponType === 'marksmanship') icon = '🏹';
    else if (model.weaponType === 'arcane') icon = '🔮';
    else if (model.weaponType === 'heavy_tech') icon = '⚙️';
    else if (model.category === 'character_avatar') icon = '✨';

    return {
      id: `glb_item_${model.id}`,
      name: model.name,
      description: model.description || `Registered 3D asset from ${model.fileName}`,
      icon,
      rarity: model.rarity || 'epic',
      slot,
      weaponType: model.weaponType || (slot === 'weapon' ? 'blade' : undefined),
      levelReq: 1,
      stats: {
        attack: model.itemStats?.attack || 0,
        spellPower: model.itemStats?.spellPower || 0,
        armor: model.itemStats?.armor || 0,
        critChance: model.itemStats?.critChance || 0,
        moveSpeed: model.itemStats?.moveSpeed || 0,
        maxHp: model.itemStats?.maxHp || 0,
        maxResource: model.itemStats?.maxResource || 0,
      },
      valueGold: 500,
      effectDescription: `3D Model Mesh: ${model.fileName} (${model.triangleBudget} tris)`,
      glbModelId: model.id,
      glbModelUrl: model.url,
      isGlbModel: true,
    };
  }

  // Load 3D Model with scene caching and materials setup
  public async loadModel(urlOrId: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
    const found = this.catalog.find((c) => c.id === urlOrId);
    const url = found ? found.url : urlOrId.startsWith('/') ? urlOrId : `/glb-assets/${urlOrId}`;

    if (this.cache.has(url)) {
      const cached = this.cache.get(url)!;
      return {
        scene: cached.scene.clone(true),
        animations: cached.animations,
      };
    }

    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          gltf.scene.traverse((node) => {
            if ((node as THREE.Mesh).isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });

          this.cache.set(url, {
            scene: gltf.scene,
            animations: gltf.animations,
          });

          resolve({
            scene: gltf.scene.clone(true),
            animations: gltf.animations,
          });
        },
        undefined,
        (err) => {
          // If first path failed, retry fallback /models/glb path
          if (!url.includes('/models/glb/')) {
            const fallbackUrl = `/models/glb/${urlOrId.replace(/^.*[\\/]/, '')}`;
            this.loader.load(
              fallbackUrl,
              (gltf) => {
                gltf.scene.traverse((node) => {
                  if ((node as THREE.Mesh).isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                  }
                });
                this.cache.set(url, { scene: gltf.scene, animations: gltf.animations });
                resolve({ scene: gltf.scene.clone(true), animations: gltf.animations });
              },
              undefined,
              (fallbackErr) => {
                // Reject cleanly so downstream procedural equipment and avatar managers know GLB is missing
                reject(fallbackErr);
              }
            );
          } else {
            reject(err);
          }
        }
      );
    });
  }

  /**
   * Generates a stylized, high-craft articulated character fallback mesh
   * adhering strictly to Aurion art direction: weathered bronze, midnight-petrol, honey-stone, and Aurion-turquoise.
   */
  public createArticulatedCharacterFallback(primaryColorHex: number = 0xd97706): THREE.Group {
    const root = new THREE.Group();

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

    // Articulated Torso with Breastplate
    const torsoGeo = new THREE.CylinderGeometry(0.32, 0.25, 0.75, 8);
    const torso = new THREE.Mesh(torsoGeo, bronzeMat);
    torso.position.y = 1.15;
    root.add(torso);

    // Glowing Leyline Core
    const coreGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8);
    coreGeo.rotateX(Math.PI / 2);
    const core = new THREE.Mesh(coreGeo, glowMat);
    core.position.set(0, 1.25, 0.22);
    root.add(core);

    // Sculpted Head & Helmet with Visor
    const headGeo = new THREE.CylinderGeometry(0.18, 0.20, 0.32, 8);
    const head = new THREE.Mesh(headGeo, bronzeMat);
    head.position.y = 1.75;
    root.add(head);

    const visorGeo = new THREE.BoxGeometry(0.24, 0.06, 0.12);
    const visor = new THREE.Mesh(visorGeo, glowMat);
    visor.position.set(0, 1.76, 0.14);
    root.add(visor);

    // Shoulders
    const pauldronGeo = new THREE.ConeGeometry(0.16, 0.28, 5);
    const leftP = new THREE.Mesh(pauldronGeo, bronzeMat);
    leftP.position.set(-0.42, 1.45, 0);
    leftP.rotation.z = Math.PI / 4;
    root.add(leftP);

    const rightP = new THREE.Mesh(pauldronGeo, bronzeMat);
    rightP.position.set(0.42, 1.45, 0);
    rightP.rotation.z = -Math.PI / 4;
    root.add(rightP);

    // Arms
    const armGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.55, 6);
    const leftArm = new THREE.Mesh(armGeo, darkMat);
    leftArm.position.set(-0.38, 1.05, 0);
    root.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, darkMat);
    rightArm.position.set(0.38, 1.05, 0);
    root.add(rightArm);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.65, 6);
    const leftLeg = new THREE.Mesh(legGeo, darkMat);
    leftLeg.position.set(-0.16, 0.45, 0);
    root.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, darkMat);
    rightLeg.position.set(0.16, 0.45, 0);
    root.add(rightLeg);

    // Sabaton Feet
    const footGeo = new THREE.BoxGeometry(0.14, 0.12, 0.28);
    const leftFoot = new THREE.Mesh(footGeo, bronzeMat);
    leftFoot.position.set(-0.16, 0.08, 0.06);
    root.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeo, bronzeMat);
    rightFoot.position.set(0.16, 0.08, 0.06);
    root.add(rightFoot);

    return root;
  }

  // Load and configure mesh for specific dynamic equipment attachment socket
  public async loadEquipmentMesh(modelIdOrUrl: string, slot: string): Promise<THREE.Group | null> {
    try {
      const { scene } = await this.loadModel(modelIdOrUrl);
      const container = new THREE.Group();
      container.name = `glb_socket_${slot}_${modelIdOrUrl}`;

      // Calculate bounding box and normalize scale
      const box = new THREE.Box3().setFromObject(scene);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);

      let targetScale = 1.0;
      if (slot === 'weapon') {
        targetScale = maxDim > 0 ? 1.4 / maxDim : 1.0;
        scene.position.set(0, 0, 0);
        scene.rotation.set(0, 0, 0);
      } else if (slot === 'shield' || slot === 'offhand') {
        targetScale = maxDim > 0 ? 1.1 / maxDim : 1.0;
        scene.position.set(0, 0, 0);
      } else if (slot === 'helmet' || slot === 'head') {
        targetScale = maxDim > 0 ? 0.9 / maxDim : 1.0;
        scene.position.set(0, 0, 0);
      } else if (slot === 'chest') {
        targetScale = maxDim > 0 ? 1.2 / maxDim : 1.0;
        scene.position.set(0, 0, 0);
      }

      scene.scale.set(targetScale, targetScale, targetScale);
      container.add(scene);
      return container;
    } catch (err) {
      console.warn(`Could not load GLB equipment socket for ${modelIdOrUrl}:`, err);
      return null;
    }
  }

  // Upload an external GLB model directly
  public async uploadModelExternal(fileName: string, base64Data: string, metadata: Partial<GLBModelEntry>) {
    const res = await fetch('/api/admin/models/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, base64Data, metadata }),
    });
    const data = await res.json();
    await this.fetchCatalog();
    return data;
  }
}

export const glbManager = GLBModelManager.getInstance();
