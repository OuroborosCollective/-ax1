import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { ResourceNode, 
  ActiveBuffSummary,
  CharacterAppearance,
  CharacterClassId,
  ChatMessage,
  ClassSkill,
  CompanionPet,
  DayNightInfo,
  EnginePerformanceMetrics,
  EquipmentState,
  FloatingCombatText,
  GMWorldConfig,
  HomesteadBlueprint,
  LootDropEntity,
  MultiplayerNetStats,
  NPCCharacter,
  NPCRelationshipMemory,
  NPCReactionLogic,
  PartyMember,
  PlayerStats,
  Quest,
  RPGItem,
  SimulatedPlayer,
  WorldMobEntity,
  DungeonDefinition,
  ComboState,
  ComboRank,
  DirectionalDamageIndicator,
  WeaponType,
  DPSMeterStats,
  CombatLogEntry,
  BossTelegraph,
} from '../types';
import { INITIAL_RESOURCE_NODES, INITIAL_NPCS, MMORPG_CLASSES, COMPANION_PETS_DATABASE, HOMESTEAD_BLUEPRINTS, RPG_ITEMS_DATABASE } from '../data/mmorpgData';
import { MOB_ELEMENTAL_AFFINITIES } from '../data/combatProgressionData';
import { ElementalSynergyEngine } from '../engine/combat/ElementalSynergyEngine';
import { TelegraphVisualizer } from '../engine/combat/TelegraphVisualizer';
import { CombatMetricsTracker } from '../engine/combat/CombatMetricsTracker';
import { OpenWorldLandscape } from '../world/OpenWorldLandscape';
import { OpenWorldPlayer } from '../entities/OpenWorldPlayer';
import { collisionSystem } from '../world/WorldCollisionSystem';
import { MobManager } from '../entities/MobManager';
import { LootDropManager } from '../entities/LootDropManager';
import { npcMemoryService } from './NPCMemoryService';
import { SimulatedRealmPlayers } from '../entities/SimulatedRealmPlayers';
import { RemotePlayerManager } from '../entities/RemotePlayerManager';
import { multiplayerClient } from '../engine/net/MultiplayerClient';
import { CapsuleCollider } from '../engine/combat/CapsuleCollider';
import { buffSystem } from '../engine/combat/BuffDebuffSystem';
import { lodManager } from '../engine/lod/LODManager';
import { soundSynth } from '../audio/SoundSynthesizer';
import { GenkitAdapter } from '../adapters/GenkitAdapter';
import { ParticleSystem, ParticleEffectType } from './ParticleSystem';
import { syncManager } from './SyncManager';
import { PartyManager } from './PartyManager';
import { FixedTimestepLoop } from '../engine/simulation/FixedTimestepLoop';
import { clientPrediction } from '../engine/net/ClientPredictionReconciliation';
import { lagCompensation } from '../engine/combat/LagCompensation';
import { terrainBarycentric } from '../world/TerrainBarycentric';
import { lineOfSight } from '../engine/combat/LineOfSightSystem';
import { BallisticSimulationSystem } from '../engine/combat/BallisticPhysics';
import { InstancedVegetationSystem } from '../world/InstancedVegetationSystem';
import { occlusionCulling } from '../engine/lod/OcclusionCullingSystem';
import { deterministicRng } from '../engine/math/DeterministicPRNG';
import { globalWeather, WeatherState } from '../world/GlobalWeatherEngine';
import { tradeSystem } from '../engine/economy/TradeSystem';
import { AutonomousNPCEconomy } from '../engine/economy/AutonomousNPCEconomy';
import { NPCEconomyVisualizer } from '../engine/economy/NPCEconomyVisualizer';
import { hierarchicalPathfinding } from '../engine/pathfinding/HierarchicalPathfinding';
import { NPCMemoryType } from '../engine/ai/NPCShortTermMemory';
import { areInvariantGuard } from '../engine/are/AREInvariantGuard';
import { createWorldHashSnapshot, WorldHashSnapshot } from '../engine/are/WorldHashSnapshot';
import { deterministicTickRecorder } from '../engine/are/DeterministicTickRecorder';
import { cityLayoutCompiler } from '../engine/are/CityLayoutCompiler';
import {
  aurionTransitionRuntime,
  AURION_EXPANSE_ZONE_ID,
  AURION_TOWER_ZONE_ID,
  AurionTransitionSnapshot,
} from '../engine/aurion/AurionTransitionRuntime';
import {
  prepareMerchantNpcDecision,
  merchantBootstrapMarkets,
  HubId,
  MerchantDecisionRequests,
} from '../engine/aurion/merchantRules';
import {
  timestampedInputBuffer,
  TimestampedUserCommand,
  UserActionType,
  TimestampedActionPayload,
} from '../engine/net/TimestampedInputBuffer';
import {
  arelorianLingua,
  PlayerUtteranceAnalysis,
} from '../engine/lingua/ArelorianLinguaGrammar';



interface ActiveProjectile {
  mesh: THREE.Mesh;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  progress: number;
  speed: number;
  damage: number;
  isCrit: boolean;
  targetMobId: string;
  color: string;
}

interface ActiveAoEEffect {
  mesh: THREE.Mesh;
  timer: number;
  maxTimer: number;
}

export class MMOEngine {
  public resourceNodes: ResourceNode[] = [];
  private nodeMeshes: Map<string, THREE.Mesh> = new Map();
  public container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  // Game Subsystems
  public landscape: OpenWorldLandscape;
  public get worldChunkManager() {
    return this.landscape.chunkManager;
  }
  public player: OpenWorldPlayer;
  public mobManager: MobManager;
  public lootManager: LootDropManager;
  public simPlayers: SimulatedRealmPlayers;
  public genkitAdapter: GenkitAdapter;
  public particleSystem: ParticleSystem;
  public remotePlayers: RemotePlayerManager;
  public netStats: MultiplayerNetStats = {
    connected: false,
    pingMs: 0,
    onlinePlayers: 1,
    playerId: 'hero_player_1',
  };
  public activeBuffs: ActiveBuffSummary[] = [];
  private fpsCounter: number = 60;
  private frameTimes: number[] = [];

  // Deterministic & Advanced Engine Subsystems
  public fixedLoop: FixedTimestepLoop;
  public npcEconomy: AutonomousNPCEconomy;
  public npcEconomyVisualizer: NPCEconomyVisualizer;
  public ballisticPhysics: BallisticSimulationSystem;
  public instancedVegetation: InstancedVegetationSystem;
  public currentWeather: WeatherState;
  private ambientLight: THREE.AmbientLight;

  // ARE Deterministic Kernel & Aurion Living World States
  public latestWorldHashSnapshot: WorldHashSnapshot | null = null;
  public latestTransitionSnapshot: AurionTransitionSnapshot | null = null;
  public latestMerchantDecisions: Record<HubId, MerchantDecisionRequests | null> = {
    observatory_threshold: null,
    windhollow: null,
    emberfall: null,
    cinder_vault: null,
  };

  // Companion Pet & Homestead Subsystems
  public activePet: CompanionPet | null = null;
  private petMeshGroup: THREE.Group | null = null;
  private petPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public unlockedHouses: HomesteadBlueprint[] = [];
  public houseMeshes: THREE.Group[] = [];

  // Dungeon Variables
  public activeDungeon: DungeonDefinition | null = null;
  public isInDungeon: boolean = false;
  private preDungeonPosition: THREE.Vector3 | null = null;

  // Party Subsystem
  public partyManager: PartyManager;

  // Day-Night Cycle Subsystem & Atmospheric Lighting
  public timeOfDay: number = 14.0; // 0.0 to 24.0
  public dayNightSpeed: number = 0.045; // ~8-9 minutes per full 24hr cycle
  public isDayNightActive: boolean = true;
  private currentSkyColor: THREE.Color = new THREE.Color(0x1e293b);

  // Lighting & GM Controls
  private hemiLight: THREE.HemisphereLight;
  private sunLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  public gmConfig: GMWorldConfig = {
    godMode: false,
    infiniteResources: false,
    spawnMobType: 'clockwork_stalker',
    weatherState: 'clear_sun',
    timeOfDay: 14,
    mobSpawnMultiplier: 1.0,
    ambientParticles: true,
  };

  // Active Projectiles & AoE VFX
  private projectiles: ActiveProjectile[] = [];
  private aoeEffects: ActiveAoEEffect[] = [];

  // 3rd-Person Orbit & Follow Camera
  public cameraDistance: number = 10.5;
  public cameraHeight: number = 4.2;
  public cameraYaw: number = 0;
  public cameraPitch: number = 0.28;
  private isOrbitingCamera: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  // Controls Input State
  private keysPressed: Record<string, boolean> = {};
  public targetMob: WorldMobEntity | null = null;
  public nearbyNPC: NPCCharacter | null = null;
  public nearbyLoot: LootDropEntity | null = null;
  public autoLootEnabled: boolean = true;

  // Quests & Chat State
  public quests: Quest[] = [];
  public npcs: NPCCharacter[] = INITIAL_NPCS;
  public chatMessages: ChatMessage[] = [];

  // Floating Combat Texts
  public floatingTexts: FloatingCombatText[] = [];
  private textIdCounter: number = 0;
  private resizeObserver?: ResizeObserver;

  // Combo Counter & Combat Feedback System
  public comboState: ComboState = {
    count: 0,
    maxCombo: 0,
    timer: 0,
    maxTimer: 3.2,
    totalDamage: 0,
    multiplier: 1.0,
    rank: 'NORMAL',
    rankName: 'COMBAT FLOW',
    rankColor: '#e2e8f0',
    activeWeaponType: 'blade',
    lastHitTime: 0,
    recentHits: 0,
  };

  // Directional Damage Hit Indicators
  public directionalIndicators: DirectionalDamageIndicator[] = [];
  private dirIndicatorIdCounter: number = 0;

  // Next-Gen Deterministic Combat Overhaul Engines
  public elementalSynergyEngine: ElementalSynergyEngine;
  public telegraphVisualizer: TelegraphVisualizer;
  public combatMetricsTracker: CombatMetricsTracker;

  // Virtual on-screen movement input
  public virtualForward: number = 0;
  public virtualRight: number = 0;

  // Touch gesture states
  private lastPinchDistance: number = 0;

  // Callback to React
  public onStateUpdate?: (data: {
    stats: PlayerStats;
    equipment: EquipmentState;
    inventory: RPGItem[];
    targetMob: WorldMobEntity | null;
    nearbyNPC: NPCCharacter | null;
    nearbyLoot: LootDropEntity | null;
    quests: Quest[];
    chatMessages: ChatMessage[];
    floatingTexts: FloatingCombatText[];
    simPlayers: SimulatedPlayer[];
    partyMembers: PartyMember[];
    dayNightInfo: DayNightInfo;
    netStats: MultiplayerNetStats;
    activeBuffs: ActiveBuffSummary[];
    engineMetrics: EnginePerformanceMetrics;
    autoLootEnabled?: boolean;
    pityCounters?: Record<string, number>;
    facingAngle?: number;
    cameraYaw?: number;
    activeMobs?: WorldMobEntity[];
    npcs?: NPCCharacter[];
    comboState?: ComboState;
    directionalIndicators?: DirectionalDamageIndicator[];
    dpsMeterStats?: DPSMeterStats;
    combatLogs?: CombatLogEntry[];
  }) => void;

  private isRunning: boolean = false;
  private lastTime: number = 0;
  private animationFrameId: number = 0;
  private stateUpdateTimer: number = 0;

  public collisionDebugGroup: THREE.Group | null = null;
  private _enableCollisionVisualizer: boolean = false;

  // Pathfinding Debug Visualizer Mode
  public pathfindingDebugGroup: THREE.Group | null = null;
  public isPathfindingDebugEnabled: boolean = false;
  private pathfindingDebugLastUpdate: number = 0;

  public get enableCollisionVisualizer(): boolean { return this._enableCollisionVisualizer; }
  public set enableCollisionVisualizer(val: boolean) {
    this._enableCollisionVisualizer = val;
    this.updateCollisionVisualizer();
  }

  /**
   * Toggles the 3D Pathfinding Debug Viewport Mode
   */
  public togglePathfindingDebug(): boolean {
    this.isPathfindingDebugEnabled = !this.isPathfindingDebugEnabled;
    if (this.pathfindingDebugGroup) {
      this.pathfindingDebugGroup.visible = this.isPathfindingDebugEnabled;
    }
    if (this.isPathfindingDebugEnabled) {
      this.updatePathfindingDebugVisualizer(true);
      this.addChatMessage('system', 'Engine', '🧭 Pathfinding Debug Mode: ENABLED. Rendering NPC trajectories, macro highway nodes & deviation segments.');
    } else {
      this.addChatMessage('system', 'Engine', '🧭 Pathfinding Debug Mode: DISABLED.');
    }
    return this.isPathfindingDebugEnabled;
  }

  /**
   * Updates 3D Pathfinding Visualizer:
   * - Renders lines between current NPC positions and target destinations.
   * - Highlights segments that deviate from expected deterministically calculated macro starpaths.
   * - Visualizes short-term memory hazard penalties and trade beacons in 3D space.
   */
  public updatePathfindingDebugVisualizer(force: boolean = false): void {
    if (!this.isPathfindingDebugEnabled && !force) {
      if (this.pathfindingDebugGroup && this.pathfindingDebugGroup.visible) {
        this.pathfindingDebugGroup.visible = false;
      }
      return;
    }

    const now = performance.now();
    if (!force && now - this.pathfindingDebugLastUpdate < 80) return; // Throttle at ~12Hz for zero render lag
    this.pathfindingDebugLastUpdate = now;

    if (!this.pathfindingDebugGroup) {
      this.pathfindingDebugGroup = new THREE.Group();
      this.pathfindingDebugGroup.name = 'pathfinding_debug_group';
      this.scene.add(this.pathfindingDebugGroup);
    }
    this.pathfindingDebugGroup.visible = true;

    // Clear previous debug geometry
    while (this.pathfindingDebugGroup.children.length > 0) {
      const child = this.pathfindingDebugGroup.children[0] as any;
      if (child.geometry) child.geometry.dispose();
      this.pathfindingDebugGroup.remove(child);
    }

    const aliveNPCs = this.npcEconomy.npcs.filter((n) => n.alive);
    const standardLinePositions: number[] = [];
    const deviationLinePositions: number[] = [];

    // Shared reusable materials
    const standardMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff, // Aurion-Türkis
      transparent: true,
      opacity: 0.85,
      linewidth: 2,
    });

    const deviationMat = new THREE.LineBasicMaterial({
      color: 0xf43f5e, // Crimson / Amber deviation highlight
      transparent: true,
      opacity: 0.95,
      linewidth: 3,
    });

    const hazardMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b, // Amber hazard beacon
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    });

    const targetBeaconMat = new THREE.MeshBasicMaterial({
      color: 0x10b981, // Emerald destination beacon
      wireframe: true,
      transparent: true,
      opacity: 0.7,
    });

    const sphereGeo = new THREE.SphereGeometry(1.2, 8, 8);
    const beaconGeo = new THREE.CylinderGeometry(0.2, 1.0, 4, 8);

    for (let i = 0; i < aliveNPCs.length; i++) {
      const npc = aliveNPCs[i];
      const npcY = this.landscape.chunkManager.getElevationAt(npc.x, npc.z) + 0.8;
      const targetY = this.landscape.chunkManager.getElevationAt(npc.targetX, npc.targetZ) + 0.8;

      // Compute deterministic hierarchical macro path
      const waypoints = hierarchicalPathfinding.computeHierarchicalPath(npc.x, npc.z, npc.targetX, npc.targetZ);

      // Check if NPC has recorded recent memory hazards or path deviations
      const memories = npc.memory.getMemories();
      const hasDeviationMemory = memories.some(
        (m) => m.type === NPCMemoryType.PATH_DEVIATION || m.type === NPCMemoryType.OBSTACLE_STUCK
      );
      const hasThreatMemory = memories.some((m) => m.type === NPCMemoryType.HAZARD_THREAT);

      // 1. Direct segment from current NPC location to next target / destination
      const isDeviating = hasDeviationMemory || (hasThreatMemory && npc.memory.getHazardPenalty(npc.x, npc.z, this.npcEconomy.currentTick) > 1.0);

      if (waypoints.length > 0) {
        let prevX = npc.x;
        let prevY = npcY;
        let prevZ = npc.z;

        for (let w = 0; w < waypoints.length; w++) {
          const wp = waypoints[w];
          const wpY = this.landscape.chunkManager.getElevationAt(wp.x, wp.z) + 0.8;

          // Check if this specific segment was influenced by hazard avoidance
          const segmentHazard = npc.memory.getHazardPenalty(wp.x, wp.z, this.npcEconomy.currentTick);
          const isSegmentDeviant = isDeviating || segmentHazard > 0.8;

          if (isSegmentDeviant) {
            deviationLinePositions.push(prevX, prevY, prevZ, wp.x, wpY, wp.z);
          } else {
            standardLinePositions.push(prevX, prevY, prevZ, wp.x, wpY, wp.z);
          }

          prevX = wp.x;
          prevY = wpY;
          prevZ = wp.z;
        }
      } else {
        // Single direct line from NPC to target
        if (isDeviating) {
          deviationLinePositions.push(npc.x, npcY, npc.z, npc.targetX, targetY, npc.targetZ);
        } else {
          standardLinePositions.push(npc.x, npcY, npc.z, npc.targetX, targetY, npc.targetZ);
        }
      }

      // 2. Visual Destination Beacon for caravans and patrol units
      if (Math.hypot(npc.targetX - npc.x, npc.targetZ - npc.z) > 4.0 && (i % 3 === 0)) {
        const beacon = new THREE.Mesh(beaconGeo, targetBeaconMat);
        beacon.position.set(npc.targetX, targetY + 2.0, npc.targetZ);
        this.pathfindingDebugGroup.add(beacon);
      }

      // 3. Visual Threat Memory Spheres
      for (const mem of memories) {
        if (mem.type === NPCMemoryType.HAZARD_THREAT && mem.intensity > 0.3) {
          const memY = this.landscape.chunkManager.getElevationAt(mem.x, mem.z) + 1.2;
          const threatMesh = new THREE.Mesh(sphereGeo, hazardMat);
          threatMesh.position.set(mem.x, memY, mem.z);
          const scale = 1.0 + mem.intensity * 2.0;
          threatMesh.scale.set(scale, scale, scale);
          this.pathfindingDebugGroup.add(threatMesh);
        }
      }
    }

    // Build Batched Standard Path Lines
    if (standardLinePositions.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(standardLinePositions, 3));
      const lineSegments = new THREE.LineSegments(geo, standardMat);
      this.pathfindingDebugGroup.add(lineSegments);
    }

    // Build Batched Deviated Path Lines (Highlighted in vibrant warning color)
    if (deviationLinePositions.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(deviationLinePositions, 3));
      const lineSegments = new THREE.LineSegments(geo, deviationMat);
      this.pathfindingDebugGroup.add(lineSegments);
    }
  }

  /**
   * Serializes current NPC simulation state to dense binary ArrayBuffer.
   */
  public exportNPCBinarySnapshot(): ArrayBuffer {
    return this.npcEconomy.exportBinarySnapshot();
  }

  /**
   * Restores NPC state from authoritative binary ArrayBuffer.
   */
  public importNPCBinarySnapshot(buffer: ArrayBuffer): void {
    this.npcEconomy.importBinarySnapshot(buffer);
  }

  public updateCollisionVisualizer(): void {
    if (!this.collisionDebugGroup) {
      this.collisionDebugGroup = new THREE.Group();
      this.scene.add(this.collisionDebugGroup);
    }
    
    // Clear existing
    while (this.collisionDebugGroup.children.length > 0) {
      this.collisionDebugGroup.remove(this.collisionDebugGroup.children[0]);
    }

    this.collisionDebugGroup.visible = this._enableCollisionVisualizer;

    if (this._enableCollisionVisualizer) {
       // Render all static obstacles
       const obs = collisionSystem.getAllObstacles();
       const geo = new THREE.CylinderGeometry(1, 1, 10, 16);
       const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, transparent: true, opacity: 0.8 });
       
       obs.forEach(o => {
         const mesh = new THREE.Mesh(geo, mat);
         mesh.scale.set(o.radius, 1, o.radius);
         const y = this.landscape.chunkManager.getElevationAt(o.x, o.z);
         mesh.position.set(o.x, y + 5, o.z);
         this.collisionDebugGroup!.add(mesh);
       });
       
       // Render player hitbox
       const playerMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, transparent: true, opacity: 0.8 });
       const pMesh = new THREE.Mesh(geo, playerMat);
       pMesh.scale.set(0.65, 0.4, 0.65); // 0.65 player collision radius
       pMesh.name = 'playerHitbox';
       
       // Add dynamic player hitbox
       this.collisionDebugGroup.add(pMesh);
    }
  }

  public static checkWebGLSupport(): { supported: boolean; version?: string; error?: string } {
    try {
      if (typeof window === 'undefined') {
        return { supported: false, error: 'Window environment not available.' };
      }
      const canvas = document.createElement('canvas');
      const gl2 = canvas.getContext('webgl2');
      if (gl2) {
        return { supported: true, version: 'WebGL 2.0' };
      }
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        return { supported: true, version: 'WebGL 1.0' };
      }
      return {
        supported: false,
        error: 'WebGL context initialization failed. Please ensure WebGL and Hardware Acceleration are enabled in your browser.',
      };
    } catch (e: any) {
      return {
        supported: false,
        error: e?.message || 'WebGL check threw an unexpected exception.',
      };
    }
  }

  public static isWebGLAvailable(): boolean {
    return MMOEngine.checkWebGLSupport().supported;
  }

  constructor(container: HTMLElement, startingClass: CharacterClassId = 'knight') {
    this.container = container;

    // Clear any previous stale canvas or child elements from container
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }

    // 1. Scene, Camera, Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1e293b);

    const width = container.clientWidth > 0 ? container.clientWidth : (window.innerWidth || 1280);
    const height = container.clientHeight > 0 ? container.clientHeight : (window.innerHeight || 720);
    const aspect = height > 0 ? width / height : 16 / 9;

    this.camera = new THREE.PerspectiveCamera(55, isFinite(aspect) && aspect > 0 ? aspect : 16 / 9, 0.1, 800);

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
        failIfMajorPerformanceCaveat: false,
      });
    } catch (err: any) {
      console.error('MMOEngine: Failed to create WebGLRenderer', err);
      throw new Error(`WebGLRenderer initialization failed: ${err?.message || 'WebGL not supported'}`);
    }

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x1e293b, 1.0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.shadowMap.enabled = false;

    // Explicit CSS to eliminate layout glitches, margins, or scrollbars
    const canvas = this.renderer.domElement;
    canvas.id = 'threejs-canvas';
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.outline = 'none';
    canvas.style.touchAction = 'none';

    container.appendChild(canvas);

    console.info(
      `[MMOEngine] Initialization: Container=${width}x${height}, RendererAttached=${container.contains(
        canvas
      )}, PixelRatio=${window.devicePixelRatio}`
    );

    // 2. Sophisticated Atmospheric Lighting & Fog
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x475569, 1.6);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 2.5); // Warm Sun
    this.sunLight.position.set(60, 95, 60);
    this.scene.add(this.sunLight);

    this.fillLight = new THREE.DirectionalLight(0x38bdf8, 1.0); // Luminous Aether Fill
    this.fillLight.position.set(-60, 40, -40);
    this.scene.add(this.fillLight);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    this.scene.add(this.ambientLight);

    this.scene.fog = new THREE.FogExp2(0x1e293b, 0.005);

    // 3. Initialize Subsystems
    this.fixedLoop = new FixedTimestepLoop(20);
    this.npcEconomy = new AutonomousNPCEconomy();
    this.npcEconomyVisualizer = new NPCEconomyVisualizer(this.scene, this.npcEconomy);
    this.fixedLoop.onTick = (tick, fixedDelta) => {
      this.npcEconomy.tick(fixedDelta);

      // ARE Invariant Guard Axiom Check (deterministic Kappa=1000 and fixed seed)
      const guardPayload = { kappa: 1000, deterministicSeed: 'aurion-genesis-seed-v1' };
      areInvariantGuard.validateTick(guardPayload, tick);

      if (!this.player) return;

      // Extract deterministic entities for canonical SHA-256 world hash snapshot
      const playerPos = this.player.position;
      const players = [
        {
          id: 'hero_player_1',
          name: 'Aurion Hero',
          position: { x: Math.round(playerPos.x * 100) / 100, y: Math.round(playerPos.y * 100) / 100, z: Math.round(playerPos.z * 100) / 100 },
          health: Math.round(this.player.stats.hp),
          maxHealth: Math.round(this.player.stats.maxHp),
          state: this.player.isMoving ? 'moving' : 'idle',
        },
      ];

      const npcs = this.npcEconomy.npcs.slice(0, 16).map((npc) => ({
        id: `npc_${npc.id}`,
        name: npc.name,
        position: { x: Math.round(npc.x * 100) / 100, y: 0, z: Math.round(npc.z * 100) / 100 },
        state: npc.macroState,
        role: 'merchant',
      }));

      const loot = (this.lootManager?.lootDrops ?? []).slice(0, 16).map((item) => ({
        id: item.entity.id,
        name: item.entity.item.name,
        position: {
          x: Math.round(item.entity.x * 100) / 100,
          y: Math.round(item.entity.y * 100) / 100,
          z: Math.round(item.entity.z * 100) / 100,
        },
      }));

      const snapshot = createWorldHashSnapshot({
        tick,
        payload: guardPayload,
        players,
        npcs,
        loot,
        chunkSize: 64,
      });
      this.latestWorldHashSnapshot = snapshot;

      // Record tick into deterministic ring buffer
      deterministicTickRecorder.record({
        tick,
        payload: guardPayload,
        worldHash: snapshot.worldHash,
        worldSnapshot: snapshot,
        guard: areInvariantGuard.getStatus(),
        worldState: { players, npcs, loot },
      });

      // Aurion Zone Transition resolution
      const appliedCount = aurionTransitionRuntime.applyReadyTransitions(tick);
      if (appliedCount > 0) {
        const transSnapshot = aurionTransitionRuntime.getSnapshot('hero_player_1');
        this.latestTransitionSnapshot = transSnapshot;
        if (transSnapshot.zoneId === AURION_EXPANSE_ZONE_ID) {
          this.player.position.set(0, 0, 48);
          this.player.group.position.set(0, 0, 48);
          this.addChatMessage('system', 'Gatekeeper', '🌌 Deterministic Transition: You have passed through the Portal into the Aurion Expanse!');
        } else {
          this.player.position.set(0, 0, 0);
          this.player.group.position.set(0, 0, 0);
          this.addChatMessage('system', 'Return Stone', '🏛️ Deterministic Transition: You have touched the Return Stone and returned to the Observatory Threshold.');
        }
      }

      // Aurion Living World 4-Hub Autonomous Merchant Economy (runs every 20 ticks = 1 second)
      if (tick % 20 === 0) {
        const hubs: HubId[] = ['observatory_threshold', 'windhollow', 'emberfall', 'cinder_vault'];
        const resolutionIndex = Math.floor(tick / 20);
        for (const hub of hubs) {
          const decision = prepareMerchantNpcDecision({
            worldSeed: 'aurion-genesis-seed-v1',
            resolutionIndex,
            regionId: hub,
            prior: null,
          });
          this.latestMerchantDecisions[hub] = decision;
        }
      }

      // Timestamped Input Buffer: Process deterministic tick commands
      timestampedInputBuffer.processTick(tick, (cmd) => {
        this.executeBufferedCommand(cmd);
      });
    };

    this.ballisticPhysics = new BallisticSimulationSystem(this.scene);
    this.instancedVegetation = new InstancedVegetationSystem(this.scene);
    this.instancedVegetation.buildInstancedBatches();
    this.currentWeather = globalWeather.applyToScene(this.scene, this.ambientLight, Date.now());

    this.landscape = new OpenWorldLandscape(this.scene);
    this.lootManager = new LootDropManager(this.scene);
    this.player = new OpenWorldPlayer(this.scene, startingClass);
    this.mobManager = new MobManager(this.scene, this.lootManager);
    this.simPlayers = new SimulatedRealmPlayers(this.scene);
    this.remotePlayers = new RemotePlayerManager(this.scene);

    // Initialize Deterministic Combat Engines
    this.elementalSynergyEngine = new ElementalSynergyEngine();
    this.telegraphVisualizer = new TelegraphVisualizer(this.scene);
    this.combatMetricsTracker = new CombatMetricsTracker();

    // Realtime Multiplayer Realm WebSocket setup
    multiplayerClient.connect('hero_player_1', 'Aurion Hero', startingClass);
    multiplayerClient.on('connected', () => {
      this.netStats.connected = true;
      this.netStats.onlinePlayers = multiplayerClient.onlineCount;
      this.addChatMessage('system', 'NetRealm', '🌐 Live Realtime Realm Gateway connected.');
    });
    multiplayerClient.on('disconnected', () => {
      this.netStats.connected = false;
    });
    multiplayerClient.on('ping', (data: { pingMs: number }) => {
      this.netStats.pingMs = data.pingMs;
      this.netStats.onlinePlayers = multiplayerClient.onlineCount;
    });
    multiplayerClient.on('chat:message', (packet: any) => {
      if (packet.playerId !== multiplayerClient.localPlayerId) {
        this.addChatMessage(packet.channel || 'realm', packet.sender || 'Traveler', packet.text);
      }
    });

    // Initialize Default Aether Resonance Buff
    buffSystem.applyBuff('hero_player_1', {
      id: 'aurion_resonance',
      name: 'Resonance of Aurion',
      icon: '✨',
      color: '#00f0ff',
      duration: 3600,
      maxDuration: 3600,
      maxStacks: 1,
      modifiers: [
        { stat: 'moveSpeed', type: 'mult', value: 1.05 },
        { stat: 'attack', type: 'add', value: 10 },
      ],
    });

    // Register LOD targets
    lodManager.registerTarget('local_player', this.player.group);
    this.partyManager = new PartyManager('Hero', startingClass, 1);
    this.partyManager.onPartyMessage = (sender, text) => {
      this.addChatMessage('party', sender, text);
    };
    this.genkitAdapter = new GenkitAdapter();
    this.particleSystem = new ParticleSystem(this.scene);


    // Register landscape steam vents and beacon points into ParticleSystem
    this.landscape.steamVents.forEach((v) => {
      this.particleSystem.registerSteamVent(v.x, v.y, v.z);
    });
    this.particleSystem.registerBeacon(0, 4.2, 0, '#00f2ff'); // Central Aetherium Fountain
    this.particleSystem.registerBeacon(0, 8.0, 65, '#a855f7'); // Void Spire Apex
    this.particleSystem.registerBeacon(55, 3.5, -35, '#10b981'); // Whispering Woods Runestone

    // Dynamic Persistent World Events (Self-expanding world chunks & kingdom borders)
    this.landscape.chunkManager.onChunkLoaded = (chunk) => {
      // Spawn Politics Envoy for ALL chunks (loaded or newly generated)
      this.spawnPoliticsEnvoyForChunk(chunk);
    };

    this.landscape.chunkManager.onNewChunkCreated = (chunk) => {
      this.addFloatingText(
        `🗺️ Territorium erbaut: ${chunk.landmarkName}`,
        this.player.position.x,
        this.player.position.y + 2.4,
        '#00f0ff',
        'xl'
      );
      this.addChatMessage(
        'system',
        'Weltchronik',
        `🗺️ Neues dauerhaftes Territorium [${chunk.kingdom} • ${chunk.landmarkName}] generiert und in der persistenten Weltlogik gespeichert!`
      );
      if (this._enableCollisionVisualizer) {
        this.updateCollisionVisualizer();
      }

      // Spawn Politics Envoy
      this.spawnPoliticsEnvoyForChunk(chunk);
    };

    this.landscape.chunkManager.onKingdomBorderCrossed = (fromK, toK) => {
      this.addFloatingText(
        `⚔️ Grenze: ${toK}`,
        this.player.position.x,
        this.player.position.y + 2.8,
        '#eab308',
        'xl'
      );
      this.addChatMessage(
        'system',
        'Landesgrenze',
        `Du überschreitest die Grenze von [${fromK}] und betrittst nun [${toK}].`
      );
    };

    // Position camera immediately
    const horizDist = this.cameraDistance * Math.cos(this.cameraPitch);
    const vertDist = this.cameraHeight + this.cameraDistance * Math.sin(this.cameraPitch);
    const targetCamX = this.player.position.x + Math.sin(this.cameraYaw) * horizDist;
    const targetCamY = this.player.position.y + vertDist;
    const targetCamZ = this.player.position.z + Math.cos(this.cameraYaw) * horizDist;
    this.camera.position.set(targetCamX, targetCamY, targetCamZ);
    this.camera.lookAt(this.player.position.x, this.player.position.y + 1.6, this.player.position.z);

    // Spawn 3D NPC visuals
    this.spawnNPCVisuals();

    // 4. Initial Quests from NPCs
    this.quests = INITIAL_NPCS.flatMap((n) => n.quests);

    // 5. Initial Chat Announcements
    this.addChatMessage('system', 'System', 'Welcome to the Realm of Aethelgard! Use [W,A,S,D] to move, [1-5] for skills, [Z] for Mount.');
    this.addChatMessage('guild', 'Sir_Galahad_99', 'Heading to the Scorched Quarry to hunt Golems if anyone wants to group up!');
    this.addChatMessage('all', 'ArcaneLilly', 'Has anyone spotted the World Boss Titan Ignis in the South Arena today?');

    // 6. Bind User Controls & Resize Observer
    this.bindEvents();

    // Restore persistent NPC memories and affection ratings from MariaDB server across sessions
    npcMemoryService.loadPlayerNPCMemories('hero_player_1', this.npcs);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      this.resizeObserver.observe(this.container);
    }
  }

  
  private spawnResourceNode(node: ResourceNode) {
    if (this.nodeMeshes.has(node.id)) return;
    const geometry = new THREE.DodecahedronGeometry(1.5);
    const material = new THREE.MeshStandardMaterial({ color: node.color, roughness: 0.7, metalness: 0.3 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(node.x, node.y + 1, node.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.nodeMeshes.set(node.id, mesh);
    
    // Add collision
    collisionSystem.registerObstacle({ id: node.id, x: node.x, z: node.z, radius: 2.0, chunkKey: 'none', type: 'rock' });
  }

  private spawnNPCVisuals() {
    this.npcs.forEach((npc) => {
      this.addNPCMesh(npc);
    });
  }

  private addNPCMesh(npc: NPCCharacter) {
    const group = new THREE.Group();
    // Use elevation for spawn
    const elev = this.landscape.chunkManager.getElevationAt(npc.x, npc.z);
    group.position.set(npc.x, elev, npc.z);

    const baseColor = new THREE.Color(npc.color);
    const mat = new THREE.MeshStandardMaterial({
      color: baseColor,
      metalness: 0.75,
      roughness: 0.32,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.2,
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

    // Sculpted Robes & Lower Mantle
    const robeGeo = new THREE.CylinderGeometry(0.36, 0.58, 1.4, 8);
    const robe = new THREE.Mesh(robeGeo, mat);
    robe.position.y = 0.7;
    group.add(robe);

    // Articulated Torso & Vestment
    const vestGeo = new THREE.CylinderGeometry(0.34, 0.32, 0.65, 8);
    const vest = new THREE.Mesh(vestGeo, darkMat);
    vest.position.y = 1.35;
    group.add(vest);

    // Golden Aether Trim & Collar
    const collarGeo = new THREE.TorusGeometry(0.32, 0.05, 6, 16);
    collarGeo.rotateX(Math.PI / 2);
    const collar = new THREE.Mesh(collarGeo, goldMat);
    collar.position.y = 1.65;
    group.add(collar);

    // Sculpted Head / Hood / Cowl
    const headGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.34, 8);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = 1.85;
    group.add(head);

    // Glowing Eyes / Visor
    const visorGeo = new THREE.BoxGeometry(0.22, 0.06, 0.12);
    const visor = new THREE.Mesh(visorGeo, glowMat);
    visor.position.set(0, 1.86, 0.14);
    group.add(visor);

    // Pauldron Mantle
    const pauldronGeo = new THREE.ConeGeometry(0.16, 0.3, 6);
    const leftP = new THREE.Mesh(pauldronGeo, goldMat);
    leftP.position.set(-0.38, 1.55, 0);
    leftP.rotation.z = Math.PI / 4;
    group.add(leftP);

    const rightP = new THREE.Mesh(pauldronGeo, goldMat);
    rightP.position.set(0.38, 1.55, 0);
    rightP.rotation.z = -Math.PI / 4;
    group.add(rightP);

    // Floating Golden Quest Marker
    const markGeo = new THREE.OctahedronGeometry(0.25, 0);
    const markMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.2,
    });
    const marker = new THREE.Mesh(markGeo, markMat);
    marker.position.y = 2.65;
    group.add(marker);

    this.scene.add(group);
  }

  public spawnPoliticsEnvoyForChunk(chunk: any) {
    // Only one per chunk
    const npcId = `politics_envoy_${chunk.chunkKey}`;
    if (this.npcs.find(n => n.id === npcId)) return;

    const envoyNPC: NPCCharacter = {
      id: npcId,
      name: `Verwaltungssitz: ${chunk.landmarkName}`,
      title: 'Gebietsvorsitzender & Politik',
      role: 'Territory Envoy',
      zone: chunk.landmarkName,
      x: chunk.centerX,
      y: this.landscape.chunkManager.getElevationAt(chunk.centerX, chunk.centerZ),
      z: chunk.centerZ,
      color: '#00f0ff', // Aurion-Türkis
      dialogue: ['Willkommen, Reisender. Die politische Stabilität dieser Region hängt von tapferen Helden ab.'],
      quests: [
        {
          id: `politics_stabilize_${chunk.chunkKey}`,
          title: 'Politik: Gebiet Stabilisieren',
          description: `Erledige Verwaltungsaufgaben in ${chunk.landmarkName}, um Einfluss zu gewinnen. (+15 XP, +5 Gebietsverwaltungspunkte)`,
          completed: false,
          type: 'explore_zone', // Using an existing type for compatibility
          giverName: 'Territory Envoy',
          giverZone: chunk.landmarkName,
          lore: 'Stabilität sichert das Überleben der Zivilisation.',
          objective: 'Führe Verwaltungsaufgaben aus.',
          targetCount: 1,
          currentCount: 0,
          rewardGold: 0,
          rewardXp: 15
        },
        {
          id: `politics_destabilize_${chunk.chunkKey}`,
          title: 'Politik: Chaos stiften (Destabilisierung)',
          description: `Säe Chaos in ${chunk.landmarkName}, um die Kontrolle des aktuellen Verwalters zu schwächen. (+20 XP, senkt Stabilität)`,
          completed: false,
          type: 'explore_zone',
          giverName: 'Territory Envoy',
          giverZone: chunk.landmarkName,
          lore: 'Chaos ist eine Leiter.',
          objective: 'Störe den Frieden.',
          targetCount: 1,
          currentCount: 0,
          rewardGold: 0,
          rewardXp: 20
        }
      ]
    };
    
    this.npcs.push(envoyNPC);
    this.quests.push(...envoyNPC.quests);
    this.addNPCMesh(envoyNPC);

    // Fetch guard state from backend
    fetch(`/api/world/politics/${chunk.chunkKey}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.politics?.ownerId && data.politics.guardCount > 0) {
          this.spawnTerritoryGuards(chunk.chunkKey, data.politics.guardCount, data.politics.ownerName);
        }
      })
      .catch(console.error);
  }

  public spawnTerritoryGuards(chunkKey: string, count: number, ownerName: string) {
    const chunk = Array.from(this.landscape.chunkManager.chunks.values()).find(c => c.chunkKey === chunkKey);
    if (!chunk) return;

    for (let i = 0; i < count; i++) {
      const guardId = `guard_${chunkKey}_${i}`;
      if (this.npcs.find(n => n.id === guardId)) continue;
      
      const angle = (Math.PI * 2 / count) * i;
      const r = 10; // 10m radius around envoy
      const gx = chunk.centerX + Math.cos(angle) * r;
      const gz = chunk.centerZ + Math.sin(angle) * r;

      const guardNPC: NPCCharacter = {
        id: guardId,
        name: `Territoriumswache`,
        title: `Wache von ${ownerName}`,
        zone: chunk.landmarkName,
        role: 'Guard',
        x: gx,
        y: this.landscape.chunkManager.getElevationAt(gx, gz),
        z: gz,
        color: '#fbbf24', // Gold armor
        dialogue: ['Für den Gebietsvorsitzenden!'],
        quests: []
      };
      
      this.npcs.push(guardNPC);
      this.addNPCMesh(guardNPC);
    }
  }

  private bindEvents() {
    const el = this.renderer.domElement;

    // Keyboard controls
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    // Mouse camera rotation
    el.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    el.addEventListener('wheel', this.handleWheel, { passive: false });

    // Touch controls for mobile
    el.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    el.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    el.addEventListener('touchend', this.handleTouchEnd);

    // WebGL Context Loss / Restore
    el.addEventListener('webglcontextlost', this.handleContextLost as EventListener, false);
    el.addEventListener('webglcontextrestored', this.handleContextRestored as EventListener, false);

    // Resize
    window.addEventListener('resize', this.handleResize);
  }

  private unbindEvents() {
    const el = this.renderer?.domElement;

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);

    if (el) {
      el.removeEventListener('mousedown', this.handleMouseDown);
      el.removeEventListener('wheel', this.handleWheel);
      el.removeEventListener('touchstart', this.handleTouchStart);
      el.removeEventListener('touchmove', this.handleTouchMove);
      el.removeEventListener('touchend', this.handleTouchEnd);
      el.removeEventListener('webglcontextlost', this.handleContextLost as EventListener);
      el.removeEventListener('webglcontextrestored', this.handleContextRestored as EventListener);
    }

    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('resize', this.handleResize);
  }

  private handleContextLost = (event: Event) => {
    event.preventDefault();
    console.warn('MMOEngine: WebGL Context Lost.');
    this.stop();
  };

  private handleContextRestored = () => {
    console.info('MMOEngine: WebGL Context Restored. Resuming render loop.');
    this.start();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    // If typing in chat input, ignore game keybinds
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
      return;
    }

    const key = e.key.toLowerCase();
    this.keysPressed[key] = true;

    // Skill keys 1-5
    if (['1', '2', '3', '4', '5'].includes(key)) {
      e.preventDefault();
      const skillIndex = parseInt(key) - 1;
      this.castClassSkill(skillIndex);
    }

    // Space or Shift: Evasive Dodge Roll with I-Frames
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      e.preventDefault();
      this.triggerPlayerDodge();
    }

    // Z: Mount Toggle
    if (key === 'z') {
      e.preventDefault();
      this.toggleMount();
    }

    // U: Auto-Loot Toggle
    if (key === 'u') {
      e.preventDefault();
      this.toggleAutoLoot();
    }

    // F: Interact (Loot or NPC Talk)
    if (key === 'f') {
      e.preventDefault();
      this.interactNearby();
    }

    // Tab: Cycle Target Mob
    if (key === 'tab') {
      e.preventDefault();
      this.cycleTarget();
    }

    // T: Taunt current target or nearby mobs
    if (key === 't') {
      e.preventDefault();
      this.tauntTarget();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    this.keysPressed[key] = false;
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (e.button === 0 || e.button === 2) {
      this.isOrbitingCamera = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isOrbitingCamera) return;

    const deltaX = e.clientX - this.lastMouseX;
    const deltaY = e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    this.cameraYaw -= deltaX * 0.006;
    this.cameraPitch = Math.max(0.1, Math.min(1.2, this.cameraPitch + deltaY * 0.004));
  };

  private handleMouseUp = () => {
    this.isOrbitingCamera = false;
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.cameraDistance = Math.max(7.0, Math.min(28.0, this.cameraDistance + e.deltaY * 0.015));
    this.cameraHeight = this.cameraDistance * 0.55;
  };

  private handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      this.isOrbitingCamera = true;
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;
      this.lastPinchDistance = 0;
    } else if (e.touches.length === 2) {
      this.isOrbitingCamera = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.lastPinchDistance = Math.hypot(dx, dy);
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1 && this.isOrbitingCamera) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - this.lastMouseX;
      const deltaY = touch.clientY - this.lastMouseY;
      this.lastMouseX = touch.clientX;
      this.lastMouseY = touch.clientY;

      this.cameraYaw -= deltaX * 0.008;
      this.cameraPitch = Math.max(0.08, Math.min(1.25, this.cameraPitch + deltaY * 0.005));
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.hypot(dx, dy);

      if (this.lastPinchDistance > 0) {
        const diff = this.lastPinchDistance - distance;
        this.cameraDistance = Math.max(6.0, Math.min(32.0, this.cameraDistance + diff * 0.04));
        this.cameraHeight = this.cameraDistance * 0.55;
      }
      this.lastPinchDistance = distance;
    }
  };

  private handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length === 0) {
      this.isOrbitingCamera = false;
      this.lastPinchDistance = 0;
    } else if (e.touches.length === 1) {
      this.lastPinchDistance = 0;
      this.isOrbitingCamera = true;
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;
    }
  };

  public toggleMount() {
    const isMounted = this.player.toggleMount();
    soundSynth.playMountSound();
    this.addFloatingText(
      isMounted ? 'Mounted (+100% Speed)' : 'Dismounted',
      this.player.position.x,
      this.player.position.y + 2.5,
      isMounted ? '#38bdf8' : '#94a3b8',
      'md'
    );
  }

  public toggleAutoLoot(force?: boolean): boolean {
    this.autoLootEnabled = force !== undefined ? force : !this.autoLootEnabled;
    const status = this.autoLootEnabled ? 'AKTIVIERT' : 'DEAKTIVIERT';
    soundSynth.playItemPickup();
    this.addFloatingText(
      `Auto-Loot (Common): ${status}`,
      this.player.position.x,
      this.player.position.y + 2.5,
      this.autoLootEnabled ? '#10b981' : '#94a3b8',
      'lg'
    );
    this.addChatMessage(
      'system',
      'Auto-Loot',
      `Auto-Loot für gewöhnliche Beute ist jetzt ${status}. [Taste U zum Umschalten]`
    );
    return this.autoLootEnabled;
  }

  public interactNearby(): { npcOpened?: NPCCharacter; lootCollected?: RPGItem } {
    // 1. Check Loot
    if (this.nearbyLoot) {
      const loot = this.nearbyLoot;
      this.lootManager.removeLoot(loot.id);
      this.player.inventory.push(loot.item);
      if (loot.goldAmount > 0) {
        this.player.stats.gold += loot.goldAmount;
      }
      soundSynth.playLootPickup();
      this.addFloatingText(
        `+ Loot: ${loot.item.name} (${loot.rarity.toUpperCase()})`,
        this.player.position.x,
        this.player.position.y + 2.2,
        loot.beamColor,
        'lg'
      );
      this.addChatMessage(
        'system',
        'Loot',
        `Acquired [${loot.item.name}] (${loot.rarity.toUpperCase()}) and ${loot.goldAmount} Gold!`
      );
      this.progressQuests('collect_loot');
      const item = loot.item;
      this.nearbyLoot = null;
      return { lootCollected: item };
    }

    // 2. Check NPC
    if (this.nearbyNPC) {
      soundSynth.playNpcInteract();
      return { npcOpened: this.nearbyNPC };
    }

    // 3. Check Resource Nodes
    for (const node of this.resourceNodes) {
      if (node.isDepleted) continue;
      const dist = Math.hypot(node.x - this.player.position.x, node.z - this.player.position.z);
      if (dist < 4.0) {
        // Check Tool
        const tool = this.player.inventory.find(i => i.slot === 'tool' && i.name.includes(node.requiredToolCategory));
        if (!tool) {
          this.addFloatingText('Need ' + node.requiredToolCategory + '!', node.x, node.y + 3, '#ef4444');
          return {};
        }

        // Get local chunk density
        const cx = Math.floor(node.x / this.worldChunkManager.chunkSize);
        const cz = Math.floor(node.z / this.worldChunkManager.chunkSize);
        const chunk = this.worldChunkManager.getChunk(`${cx},${cz}`);
        let densityBonus = 1.0;
        if (chunk && chunk.resourceDensity) {
          densityBonus = chunk.resourceDensity[node.type] || 1.0;
        }

        // Calculate Yield dynamically based on chunk density + tool
        const baseYield = 1;
        const totalYield = Math.max(1, Math.floor(baseYield * densityBonus));

        // Harvest
        node.amount -= 1;
        this.addFloatingText(`+${totalYield} ${node.name} (Density ${densityBonus.toFixed(1)}x)`, node.x, node.y + 3, '#10b981');
        soundSynth.playItemPickup(); // Pluck/Mine sound
        
        // Add to inventory (mocked RPG_ITEMS_DATABASE logic if we can't import it easily, we'll import it at top)
        // Wait, RPG_ITEMS_DATABASE is not imported? Let's assume it is or import it.
        // I will use a generic item for now if not found.
        const itemDef = RPG_ITEMS_DATABASE.find(i => i.id === node.resourceItemId); 
        if (itemDef) {
          for (let i = 0; i < totalYield; i++) {
             this.player.inventory.push({ ...itemDef, id: `${itemDef.id}_${Date.now()}_${i}` });
          }
        } else {
          for (let i = 0; i < totalYield; i++) {
             this.player.inventory.push({ 
               id: `${node.resourceItemId}_${Date.now()}_${i}`,
               name: node.name,
               description: 'Gathered resource',
               icon: '🌾',
               rarity: 'common',
               slot: 'material',
               levelReq: 1,
               stats: {},
               valueGold: 1
             });
          }
        }
        
        this.addChatMessage('system', 'System', `Gathered ${totalYield}x ${node.name}. (Local Supply: ${densityBonus.toFixed(1)}x)`);
        
        // Note: In a full integration, you would call addProfessionExperience here.
        // Assuming MMOEngine has emitStateUpdate
        
        if (node.amount <= 0) {
          node.isDepleted = true;
          const mesh = this.nodeMeshes.get(node.id);
          if (mesh) {
            mesh.visible = false;
            collisionSystem.removeObstacle(node.id);
          }
          // Simple respawn timer
          setTimeout(() => {
            node.isDepleted = false;
            node.amount = 5;
            if (mesh) mesh.visible = true;
            collisionSystem.registerObstacle({ id: node.id, x: node.x, z: node.z, radius: 2.0, chunkKey: 'none', type: 'rock' });
          }, node.respawnTimeSeconds * 1000);
        }
        
        return {};
      }
    }

    return {};
  }

  public cycleTarget() {
    const nearby = this.mobManager.getNearbyMobs(this.player.position.x, this.player.position.z, 28);
    if (nearby.length === 0) {
      this.targetMob = null;
      return;
    }

    if (!this.targetMob) {
      this.targetMob = nearby[0];
    } else {
      const currentIndex = nearby.findIndex((m) => m.id === this.targetMob?.id);
      this.targetMob = nearby[(currentIndex + 1) % nearby.length];
    }
  }

  public triggerPlayerDodge(fromBuffer: boolean = false): boolean {
    const moveX = (this.keysPressed['d'] || this.keysPressed['arrowright'] ? 1 : 0) - (this.keysPressed['a'] || this.keysPressed['arrowleft'] ? 1 : 0);
    const moveZ = (this.keysPressed['s'] || this.keysPressed['arrowdown'] ? 1 : 0) - (this.keysPressed['w'] || this.keysPressed['arrowup'] ? 1 : 0);
    
    if (!fromBuffer) {
      this.queueUserCommand('DODGE_ROLL', { dirX: moveX, dirZ: moveZ, speed: 1 });
    }

    const rolled = this.player.triggerDodgeRoll(moveX, moveZ);
    if (rolled) {
      soundSynth.playSkillCast('utility');
      this.particleSystem.emit('teleport_warp', this.player.position, '#00f0ff', 0.9);
      this.addFloatingText('💨 EVASIVE ROLL (I-FRAME)', this.player.position.x, this.player.position.y + 2.2, '#00f0ff', 'md');
    }
    return rolled;
  }

  public castClassSkill(skillIndex: number, fromBuffer: boolean = false) {
    const classDef = MMORPG_CLASSES[this.player.currentClassId];
    if (skillIndex < 0 || skillIndex >= classDef.skills.length) return;

    if (!fromBuffer) {
      this.queueUserCommand('CAST_SPELL', { skillIndex, spellId: classDef.skills[skillIndex].name });
    }

    // Action Buffering if currently mid-swing
    if (this.player.isAttacking && this.player.attackAnimTimer > 0.05) {
      this.player.queueSkill(skillIndex);
      this.addFloatingText('⌛ Buffered Skill', this.player.position.x, this.player.position.y + 1.8, '#a78bfa', 'sm');
      return;
    }

    const skill = classDef.skills[skillIndex];
    if (skill.currentCooldown > 0) {
      this.addFloatingText('Skill on Cooldown!', this.player.position.x, this.player.position.y + 2, '#ef4444', 'sm');
      return;
    }

    if (!this.player.consumeResource(skill.resourceCost)) {
      this.addFloatingText(`Not enough ${this.player.stats.resourceName}!`, this.player.position.x, this.player.position.y + 2, '#f97316', 'sm');
      return;
    }

    skill.currentCooldown = skill.cooldown;

    // Auto-acquire target if none selected
    if (!this.targetMob || Math.hypot(this.targetMob.x - this.player.position.x, this.targetMob.z - this.player.position.z) > 30) {
      const nearby = this.mobManager.getNearbyMobs(this.player.position.x, this.player.position.z, 24);
      if (nearby.length > 0) {
        this.targetMob = nearby[0];
      }
    }

    // Execute Skill Mechanics & Visual Weapon Animation
    soundSynth.playSkillCast(skill.type);
    this.player.triggerAttackAnimation(skill.type, skill.type === 'melee' ? 0.55 : 0.45);

    if (skill.type === 'melee') {
      this.executeMeleeSkill(skill);
    } else if (skill.type === 'projectile') {
      this.executeProjectileSkill(skill);
    } else if (skill.type === 'aoe') {
      this.executeAoESkill(skill);
    } else if (skill.type === 'buff') {
      this.executeBuffSkill(skill);
    } else if (skill.type === 'utility') {
      this.executeUtilitySkill(skill);
    } else if (skill.type === 'turret') {
      this.executeTurretSkill(skill);
    }
  }

  private executeMeleeSkill(skill: ClassSkill) {
    const hitAngle = this.player.facingAngle;
    const hitDistance = skill.range || 4.5;
    const hitCenter = new THREE.Vector3(
      this.player.position.x + Math.sin(hitAngle) * 2.5,
      0.5,
      this.player.position.z + Math.cos(hitAngle) * 2.5
    );

    // Spawn 3D Cleave Arc VFX
    const arcGeo = new THREE.RingGeometry(2.0, 3.8, 16, 1, 0, Math.PI * 0.8);
    arcGeo.rotateX(-Math.PI / 2);
    const arcMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(skill.color),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const arc = new THREE.Mesh(arcGeo, arcMat);
    arc.position.copy(hitCenter);
    arc.rotation.y = hitAngle - Math.PI / 2;
    this.scene.add(arc);
    this.aoeEffects.push({ mesh: arc, timer: 0.25, maxTimer: 0.25 });

    // Particle cleave arc
    this.particleSystem.emit('slash_cleave', hitCenter, skill.color, 1.2);

    // Damage all mobs in cleave radius
    const nearby = this.mobManager.getNearbyMobs(hitCenter.x, hitCenter.z, skill.aoeRadius || 4.0);
    nearby.forEach((mob) => {
      const isCrit = Math.random() * 100 < this.player.stats.critChance;
      const baseDmg = (skill.damage + this.player.stats.attackPower * 0.8);
      const totalDmg = Math.round(isCrit ? baseDmg * 1.85 : baseDmg);

      this.applyDamageToMob(mob.id, totalDmg, isCrit);
    });

    // Check if any friendly/neutral NPCs were struck in the cleave arc
    for (const npc of this.npcs) {
      const dist = Math.hypot(npc.x - hitCenter.x, npc.z - hitCenter.z);
      if (dist < 4.0) {
        this.processNPCEvent(npc.id, 'attack', { damage: skill.damage });
      }
    }
  }

  private executeProjectileSkill(skill: ClassSkill) {
    if (!this.targetMob) {
      this.addFloatingText('No Target in Range!', this.player.position.x, this.player.position.y + 2, '#ef4444', 'sm');
      return;
    }

    const startPos = new THREE.Vector3(
      this.player.position.x,
      this.player.position.y + 1.5,
      this.player.position.z
    );
    const targetPos = new THREE.Vector3(this.targetMob.x, 1.2, this.targetMob.z);

    // Line of sight check
    const los = lineOfSight.checkLineOfSight(startPos, targetPos);
    if (!los.hasLoS) {
      this.addFloatingText('Sichtlinie blockiert!', this.targetMob.x, 2.0, '#94a3b8', 'md');
      return;
    }

    const projGeo = new THREE.SphereGeometry(0.35, 8, 8);
    const projMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(skill.color) });
    const projMesh = new THREE.Mesh(projGeo, projMat);
    projMesh.position.copy(startPos);
    this.scene.add(projMesh);

    const isCrit = deterministicRng.rollChance(this.player.stats.critChance * this.currentWeather.critMultiplierShadow);
    const baseDmg = skill.damage + (this.player.stats.spellPower || this.player.stats.attackPower) * 0.9;
    const totalDmg = Math.round(isCrit ? baseDmg * 1.9 : baseDmg);

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
    });
  }

  private executeAoESkill(skill: ClassSkill) {
    const targetX = this.targetMob ? this.targetMob.x : this.player.position.x + Math.sin(this.player.facingAngle) * 6;
    const targetZ = this.targetMob ? this.targetMob.z : this.player.position.z + Math.cos(this.player.facingAngle) * 6;

    const aoeRadius = skill.aoeRadius || 6.0;

    // Launch real ballistic projectile with gravity arc and splash explosion
    const launchOrigin = new THREE.Vector3(this.player.position.x, this.player.position.y + 1.8, this.player.position.z);
    const launchTarget = new THREE.Vector3(targetX, 0.5, targetZ);
    this.ballisticPhysics.launch(
      'hero_player_1',
      launchOrigin,
      launchTarget,
      28.0,
      3.5,
      skill.damage,
      aoeRadius,
      parseInt(skill.color.replace('#', '0x'), 16) || 0x00f0ff,
      (hitPoint, splashRad, dmg) => {
        // 3D AoE Ring Ground Impact
        const ringGeo = new THREE.RingGeometry(0.2, splashRad, 32);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(skill.color),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(hitPoint.x, hitPoint.y + 0.08, hitPoint.z);
        this.scene.add(ring);
        this.aoeEffects.push({ mesh: ring, timer: 0.6, maxTimer: 0.6 });

        // Emit AoE Magic impact particles
        this.particleSystem.emit('magic_impact', { x: hitPoint.x, y: hitPoint.y + 0.5, z: hitPoint.z }, skill.color, 1.5);

        // Damage all mobs in area
        const nearby = this.mobManager.getNearbyMobs(hitPoint.x, hitPoint.z, splashRad);
        nearby.forEach((mob) => {
          const isCrit = deterministicRng.rollChance(this.player.stats.critChance * this.currentWeather.critMultiplierShadow);
          const baseDmg = dmg + (this.player.stats.spellPower + this.player.stats.attackPower) * 0.7;
          const totalDmg = Math.round(isCrit ? baseDmg * 1.8 : baseDmg);

          this.applyDamageToMob(mob.id, totalDmg, isCrit);
        });

        // Check if any NPCs were caught in the splash blast
        for (const npc of this.npcs) {
          const dist = Math.hypot(npc.x - hitPoint.x, npc.z - hitPoint.z);
          if (dist < splashRad) {
            this.processNPCEvent(npc.id, 'attack', { damage: dmg });
          }
        }
      }
    );
  }

  private executeBuffSkill(skill: ClassSkill) {
    if (skill.id === 'k_shield') {
      this.player.triggerShield(6.0);
      this.particleSystem.emit('beacon_activate', this.player.position, '#00f2ff', 0.8);
      this.addFloatingText('Aegis Shield Active (-75% Dmg)', this.player.position.x, this.player.position.y + 2.5, '#00f2ff', 'lg');
      // Knight AoE Taunt: seize aggro from all mobs in 22m radius
      const taunted = this.mobManager.tauntNearbyMobs('hero_player_1', this.player.position.x, this.player.position.z, 22.0, 'Hero Player');
      if (taunted.length > 0) {
        this.addFloatingText(`⚔️ TAUNT! ${taunted.length} Mobs Aggroed`, this.player.position.x, this.player.position.y + 3.2, '#fbbf24', 'xl');
        this.addChatMessage('system', 'Aegis Spott', `[Spott] ${taunted.length} Monster in 22m Umkreis verspottet! Bedrohung auf Höchstwert gesetzt.`);
      }
    } else if (skill.id === 'e_heal') {
      this.player.heal(220);
      this.particleSystem.emit('heal_sparkle', this.player.position, '#10b981', 1.4);
      this.addFloatingText('+220 HP Recovered', this.player.position.x, this.player.position.y + 2.5, '#10b981', 'lg');
    } else if (skill.id === 'k_overdrive') {
      this.player.buffAttackMultiplier = 1.5;
      this.player.buffSpeedMultiplier = 1.35;
      this.player.buffTimer = 8.0;
      this.player.recalculateStats();
      this.particleSystem.emit('steam_vent', this.player.position, '#ef4444', 1.5);
      this.addFloatingText('Steam Overclock (+50% Atk)', this.player.position.x, this.player.position.y + 2.5, '#ef4444', 'lg');
    }
  }

  private executeUtilitySkill(skill: ClassSkill) {
    // Dash / Teleport forward
    const dashDist = skill.range || 12.0;
    this.particleSystem.emit('teleport_warp', this.player.position, skill.color, 1.0);
    this.player.position.x += Math.sin(this.player.facingAngle) * dashDist;
    this.player.position.z += Math.cos(this.player.facingAngle) * dashDist;
    this.particleSystem.emit('teleport_warp', this.player.position, skill.color, 1.2);
    this.addFloatingText('Chrono Warp Dash', this.player.position.x, this.player.position.y + 2, '#ec4899', 'md');
  }

  private executeTurretSkill(skill: ClassSkill) {
    const turretGeo = new THREE.CylinderGeometry(0.4, 0.6, 1.8, 8);
    const turretMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.9 });
    const turret = new THREE.Mesh(turretGeo, turretMat);
    turret.position.set(
      this.player.position.x + Math.sin(this.player.facingAngle) * 2.0,
      0.9,
      this.player.position.z + Math.cos(this.player.facingAngle) * 2.0
    );
    this.scene.add(turret);
    this.aoeEffects.push({ mesh: turret, timer: 18.0, maxTimer: 18.0 });
    this.particleSystem.emit('steam_vent', turret.position, '#0284c7', 1.0);
    this.addFloatingText('Gatling Turret Deployed', turret.position.x, turret.position.y + 2, '#0ea5e9', 'md');
  }

  public teleportPlayer(x: number, z: number, y?: number) {
    this.player.position.set(x, y ?? 0, z);
    this.particleSystem.emit('teleport_warp', this.player.position, '#00f0ff', 2.0);
    soundSynth.playQuestComplete();
  }

  // --- Dungeon Matchmaking & Instancing Hooks ---
  public enterDungeon(dungeon: DungeonDefinition) {
    if (this.isInDungeon) return;
    
    // Save overworld position
    this.preDungeonPosition = this.player.position.clone();
    
    this.activeDungeon = dungeon;
    this.isInDungeon = true;
    
    // Teleport to an instanced origin (far away from main map)
    const instancedZoneOffset = 10000 + Math.floor(Math.random() * 5000);
    this.teleportPlayer(instancedZoneOffset, instancedZoneOffset, 2.0);
    
    this.addChatMessage('system', 'Dungeon Master', `Entered ${dungeon.name}! Objective: Slay ${dungeon.bosses.length} Bosses.`);

    // Spawn Dungeon Bosses
    dungeon.bosses.forEach((bossName, i) => {
      const cx = instancedZoneOffset + Math.cos(i) * 15;
      const cz = instancedZoneOffset + Math.sin(i) * 15;
      this.mobManager.spawnDungeonBoss(
        `instanced_boss_${dungeon.id}_${i}`,
        bossName,
        dungeon.levelReq + 2,
        cx,
        cz
      );
    });
    
    // Set atmosphere based on dungeon
    this.currentSkyColor.setHex(0x0a0404);
    this.scene.background = this.currentSkyColor;
    this.ambientLight.intensity = 0.2;
    this.ambientLight.color.setHex(0xffaaaa);
  }

  public exitDungeon() {
    if (!this.isInDungeon || !this.preDungeonPosition) return;
    
    this.isInDungeon = false;
    this.activeDungeon = null;
    
    // Restore overworld position
    this.teleportPlayer(this.preDungeonPosition.x, this.preDungeonPosition.z, this.preDungeonPosition.y);
    this.preDungeonPosition = null;
    
    this.addChatMessage('system', 'Dungeon Master', `Exited the dungeon and returned to the overworld.`);
    
    // Day-night cycle will automatically restore the overworld lighting on next tick
  }

  private applyDamageToMob(mobId: string, damage: number, isCrit: boolean) {
    const mobVisual = this.mobManager.mobs.find((m) => m.entity.id === mobId);
    if (mobVisual) {
      // Deterministic Line-of-Sight Check against world geometry (walls, rocks)
      const mobPos = new THREE.Vector3(mobVisual.entity.x, mobVisual.entity.y + 1.0, mobVisual.entity.z);
      const los = lineOfSight.checkLineOfSight(this.player.position, mobPos);
      if (!los.hasLoS) {
        this.addFloatingText('Sichtlinie blockiert!', mobVisual.entity.x, mobVisual.entity.y + 2.0, '#94a3b8', 'md');
        return;
      }
      // Lag compensation record
      lagCompensation.recordSnapshot(mobId, mobPos, mobVisual.entity.radius, 2.0);
    }

    // Weather combat multiplier & Combo streak bonus
    let finalDamage = damage;
    if (this.comboState.count > 0) {
      finalDamage = Math.round(finalDamage * this.comboState.multiplier);
    }
    if (this.player.currentClassId === 'mage' && this.currentWeather) {
      finalDamage = Math.round(finalDamage * this.currentWeather.damageMultiplierElectricArcane);
    }

    const isTank = this.player.currentClassId === 'knight';
    const result = this.mobManager.damageMob(mobId, finalDamage, 'hero_player_1', isTank, 'Hero Player');
    if (!result.mob) return;

    // Process Elemental Synergy & Resistances
    const activeWep = this.player.getActiveWeaponType();
    let dmgType: 'physical' | 'arcane' | 'fire' | 'frost' | 'electric' | 'nature' = 'physical';
    if (this.player.currentClassId === 'mage') {
      dmgType = Math.random() < 0.5 ? 'arcane' : 'frost';
    } else if (this.player.currentClassId === 'engineer') {
      dmgType = 'fire';
    } else if (this.player.currentClassId === 'ranger') {
      dmgType = 'nature';
    } else if (activeWep === 'staff') {
      dmgType = 'arcane';
    }

    const synergyRes = this.elementalSynergyEngine.processSkillHit(
      mobId,
      result.mob.name,
      { x: result.mob.x, y: result.mob.y, z: result.mob.z },
      finalDamage,
      dmgType,
      isCrit || this.player.currentClassId === 'knight',
      this.currentWeather?.type === 'aether_rain',
      (radius) => this.mobManager.getNearbyMobs(result.mob!.x, result.mob!.z, radius).map((m) => ({ id: m.id, x: m.x, z: m.z }))
    );

    finalDamage = synergyRes.modifiedDamage;

    if (synergyRes.bonusFloatingTags) {
      synergyRes.bonusFloatingTags.forEach((t) => {
        this.addFloatingText(t.tag, result.mob!.x, result.mob!.y + 2.6, t.color, 'lg');
      });
    }

    if (synergyRes.synergyTriggered) {
      const syn = synergyRes.synergyTriggered;
      this.combatMetricsTracker.recordSynergy(syn.name, syn.damage, syn.targetCount);
      this.particleSystem.emit('beacon_activate', { x: syn.x, y: syn.y + 0.8, z: syn.z }, syn.color, 1.6);
      this.addFloatingText(`✨ ${syn.name}!`, syn.x, syn.y + 2.8, syn.color, 'xl');

      const nearby = this.mobManager.getNearbyMobs(syn.x, syn.z, 6.0);
      nearby.forEach((m) => {
        if (m.id !== mobId) {
          this.applyDamageToMob(m.id, syn.damage, false);
        }
      });
    }

    // Record combat metrics
    this.combatMetricsTracker.recordDamageDealt(finalDamage, isCrit, result.mob.name);
    this.recordComboHit(finalDamage, isCrit, activeWep);

    // Broadcast combat hit to realm peers
    multiplayerClient.sendCombatAction({
      action: 'hit',
      targetMobId: mobId,
      damage: finalDamage,
      isCrit,
      color: isCrit ? '#fbbf24' : '#ffffff',
    });

    soundSynth.playHitSound();

    // Trigger Combat Particle Burst
    let pType: ParticleEffectType = 'combat_hit';
    let pColor = '#ffffff';

    if (isCrit) {
      pType = 'combat_crit';
      pColor = '#fbbf24';
    } else {
      switch (this.player.currentClassId) {
        case 'mage':
          pType = Math.random() > 0.5 ? 'electric_spark' : 'frost_shatter';
          pColor = Math.random() > 0.5 ? '#e879f9' : '#38bdf8'; // Purple for arcane, Cyan for frost
          break;
        case 'knight':
          pType = 'physical_hit';
          pColor = '#d4af37';
          break;
        case 'engineer':
          pType = 'fire_impact';
          pColor = '#ef4444'; // Red/Orange for fire
          break;
        case 'ranger':
          pType = 'physical_hit';
          pColor = '#22c55e'; // Green for nature/poison
          break;
      }
    }

    if (isCrit) {
      this.particleSystem.emit(pType, { x: result.mob.x, y: result.mob.y + 1.2, z: result.mob.z }, pColor, 1.2);
    } else {
      this.particleSystem.emit(pType, { x: result.mob.x, y: result.mob.y + 1.0, z: result.mob.z }, pColor, 1.0);
    }

    // Floating damage text with 3D coordinates and combo rank flare
    const floatColor = isCrit ? '#fbbf24' : this.comboState.count >= 10 ? this.comboState.rankColor : '#ffffff';
    this.addFloatingText(
      isCrit ? `★ CRIT! ${finalDamage}` : `${finalDamage}`,
      result.mob.x + (Math.random() - 0.5) * 1.2,
      result.mob.y + 2.2,
      floatColor,
      isCrit ? 'xl' : this.comboState.count >= 10 ? 'lg' : 'md',
      isCrit,
      result.mob.z + (Math.random() - 0.5) * 0.8,
      isCrit ? 'crit' : 'damage',
      isCrit ? '★' : undefined
    );

    // Award Weapon Mastery Progression for equipped weapon type on combat hit
    const masteryHitXp = Math.max(5, Math.round(damage * 0.35));
    const hitMastery = this.player.gainWeaponMasteryXp(activeWep, masteryHitXp);
    if (hitMastery.leveledUp) {
      soundSynth.playLevelUp();
      this.particleSystem.emit('beacon_activate', this.player.position, hitMastery.mastery.color, 1.6);
      confetti({ particleCount: 60, spread: 70 });
      this.addFloatingText(
        `★ ${hitMastery.mastery.name.toUpperCase()} RANK ${hitMastery.newLevel}! ★`,
        this.player.position.x,
        this.player.position.y + 2.8,
        hitMastery.mastery.color,
        'xl'
      );
      this.addChatMessage(
        'system',
        'Mastery',
        `⚔️ Your ${hitMastery.mastery.name} advanced to Rank ${hitMastery.newLevel}! (${hitMastery.mastery.scalingAttr})`
      );
    }

    if (result.isKilled) {
      soundSynth.playMobDeath();
      this.player.stats.kills += 1;

      // Award bonus kill weapon mastery XP
      const killMastery = this.player.gainWeaponMasteryXp(activeWep, result.mob.expReward);
      if (killMastery.leveledUp && !hitMastery.leveledUp) {
        soundSynth.playLevelUp();
        this.particleSystem.emit('beacon_activate', this.player.position, killMastery.mastery.color, 1.6);
        confetti({ particleCount: 70, spread: 70 });
        this.addFloatingText(
          `★ ${killMastery.mastery.name.toUpperCase()} RANK ${killMastery.newLevel}! ★`,
          this.player.position.x,
          this.player.position.y + 2.8,
          killMastery.mastery.color,
          'xl'
        );
      }

      if (result.mob.isBoss) {
        this.player.stats.bossKills += 1;
        this.particleSystem.emit('explosion', { x: result.mob.x, y: result.mob.y + 1.8, z: result.mob.z }, '#f97316', 2.2);
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        this.addChatMessage(
          'system',
          'World Boss',
          `⚔️ HERO SLAYER ALERT: World Boss [${result.mob.name}] has been defeated by ${this.player.currentClassId.toUpperCase()}!`
        );
      } else {
        this.particleSystem.emit('blood_oil', { x: result.mob.x, y: result.mob.y + 0.6, z: result.mob.z }, '#991b1b', 1.2);
      }

      // Award XP & Gold
      this.player.stats.gold += result.mob.goldReward;
      const leveledUp = this.player.gainXp(result.mob.expReward);

      this.addFloatingText(
        `+${result.mob.expReward} EXP | +${result.mob.goldReward} Gold`,
        this.player.position.x,
        this.player.position.y + 2.0,
        '#10b981',
        'md'
      );

      if (leveledUp) {
        soundSynth.playLevelUp();
        this.particleSystem.emit('level_up', this.player.position, '#fbbf24', 1.5);
        confetti({ particleCount: 80, spread: 60 });
        this.addFloatingText(
          `★ LEVEL UP! (Lv.${this.player.stats.level}) ★`,
          this.player.position.x,
          this.player.position.y + 3.2,
          '#f59e0b',
          'xl'
        );
        this.addChatMessage(
          'guild',
          'System',
          `Congratulate player on reaching Level ${this.player.stats.level}!`
        );
      }

      // Progress Quests & Genkit Adapter Bounties
      this.genkitAdapter.onMobKilled(result.mob);
      this.progressQuests('kill_mobs', result.mob.type);
      if (result.mob.isBoss) {
        this.progressQuests('kill_boss', 'titan_boss');
      }

      // Party Shared Quest Progression
      const partyAssist = this.partyManager.handleSharedKill(result.mob.name, this.quests);
      if (partyAssist.sharedCount > 0) {
        this.addFloatingText(
          `★ Party Quest Shared (${partyAssist.sharedCount}) ★`,
          this.player.position.x,
          this.player.position.y + 3.4,
          '#38bdf8',
          'md'
        );
      }

      // Pity Guarantee Feedback
      if (result.isPityGuaranteed) {
        soundSynth.playLegendaryDrop();
        this.particleSystem.emit('beacon_activate', { x: result.mob.x, y: result.mob.y + 1.2, z: result.mob.z }, '#f59e0b', 3.5);
        confetti({ particleCount: 160, spread: 90, origin: { y: 0.55 } });
        this.addFloatingText(
          '★ SCHICKSALS-MITLEID: GARANTIERTER LEGENDÄRER DROP! ★',
          result.mob.x,
          result.mob.y + 3.2,
          '#f59e0b',
          'xl'
        );
        this.addChatMessage(
          'system',
          'Schicksalsschmiede',
          `🌟 MITLEID-GARANTIE AUSGELÖST! Nach 50 Versuchen ohne epische Beute bei [${result.mob.name}] wurde [${result.lootDropped?.name || 'Legendäre Beute'}] garantiert fallengelassen!`
        );
      }


      if (this.targetMob?.id === mobId) {
        this.targetMob = null;
      }
    }
  }

  public progressQuests(type: Quest['type'], mobType?: string) {
    this.quests.forEach((q) => {
      if (!q.completed && q.type === type) {
        if (mobType && q.targetMobType && q.targetMobType !== mobType) return;

        q.currentCount = Math.min(q.targetCount, q.currentCount + 1);
        if (q.currentCount >= q.targetCount) {
          q.completed = true;
          this.player.gainXp(q.rewardXp);
          this.player.stats.gold += q.rewardGold;
          if (q.rewardItem) {
            this.player.inventory.push(q.rewardItem);
          }
          soundSynth.playQuestComplete();
          this.addFloatingText(
            `QUEST COMPLETE: ${q.title}!`,
            this.player.position.x,
            this.player.position.y + 3.0,
            '#fbbf24',
            'xl'
          );
          this.addChatMessage('system', 'Quest Master', `Completed Quest: [${q.title}]! Received ${q.rewardGold} Gold.`);
        }
      }
    });
  }

  private lastPlayerChatText: string = '';
  private lastPlayerChatTime: number = 0;

  public addChatMessage(
    channel: ChatMessage['channel'],
    sender: string,
    text: string,
    isPlayer: boolean = false
  ) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.chatMessages.push({
      id: `chat_${Date.now()}_${Math.random()}`,
      channel,
      sender,
      text,
      timestamp: timeStr,
      isPlayer,
    });
    if (this.chatMessages.length > 50) {
      this.chatMessages.shift();
    }
  }

  public sendPlayerChat(text: string, channel: ChatMessage['channel'] = 'all'): PlayerUtteranceAnalysis {
    const currentTick = this.fixedLoop.getMetrics().currentTick;
    this.lastPlayerChatText = text;
    this.lastPlayerChatTime = performance.now();

    // 1. Analyze semantic intent with Arelorian Lingua Grammar
    const analysis = arelorianLingua.analyzeUtterance(text, currentTick);

    // 2. Post user chat message
    this.addChatMessage(channel, 'Hero', text, true);

    // 3. Locate closest nearby NPC within overhearing radius
    let closestNPC: NPCCharacter | null = null;
    let closestDist = Infinity;
    for (const npc of this.npcs) {
      const dist = Math.hypot(npc.x - this.player.position.x, npc.z - this.player.position.z);
      if (dist < 18.0 && dist < closestDist) {
        closestDist = dist;
        closestNPC = npc;
      }
    }

    if (closestNPC) {
      let role: 'guard' | 'merchant' | 'mystic' | 'citizen' = 'citizen';
      const title = (closestNPC.title || '').toLowerCase();
      const name = (closestNPC.name || '').toLowerCase();
      if (title.includes('wache') || title.includes('guard') || title.includes('sentinel') || title.includes('ritter') || name.includes('wache')) {
        role = 'guard';
      } else if (title.includes('händler') || title.includes('merchant') || title.includes('schmied') || title.includes('trader') || name.includes('händler')) {
        role = 'merchant';
      } else if (title.includes('mystik') || title.includes('magier') || title.includes('orakel') || title.includes('astral')) {
        role = 'mystic';
      }

      const reaction = arelorianLingua.generateNPCReaction(closestNPC.name, role, analysis);

      setTimeout(() => {
        if (!closestNPC) return;
        this.addChatMessage('all', `${closestNPC.name} (${closestNPC.title || role.toUpperCase()})`, reaction.dialogueText);
        
        let textColor = '#e2e8f0';
        if (reaction.posture === 'ALERT_GUARDS' || reaction.posture === 'DEFENSIVE') {
          textColor = '#ef4444';
          soundSynth.playCombatEngage();
        } else if (reaction.posture === 'FRIENDLY') {
          textColor = '#10b981';
          soundSynth.playNpcInteract();
        } else if (reaction.posture === 'SUSPICIOUS') {
          textColor = '#fbbf24';
        }

        this.addFloatingText(
          reaction.runicSubtext.slice(0, 32),
          closestNPC.x,
          closestNPC.y + 3.2,
          textColor,
          'md'
        );
      }, 350);
    }

    return analysis;
  }

  /**
   * Processes player attack and trade events against an NPC, triggers reactionLogic,
   * and updates the NPC's memory dictionary to dynamically influence future dialogue and behavior.
   */
  public processNPCEvent(
    npcIdOrNpc: string | NPCCharacter,
    eventType: 'attack' | 'trade' | 'crime' | 'chat',
    eventData?: { damage?: number; goldAmount?: number; itemName?: string; details?: string }
  ): NPCRelationshipMemory | null {
    const npc =
      typeof npcIdOrNpc === 'string'
        ? this.npcs.find((n) => n.id === npcIdOrNpc) ||
          (this.nearbyNPC && this.nearbyNPC.id === npcIdOrNpc ? this.nearbyNPC : null)
        : npcIdOrNpc;

    if (!npc) return null;

    // Ensure memory dictionary exists
    if (!npc.memory) {
      npc.memory = {
        reputation: 0,
        timesInteracted: 0,
        tradesCompleted: 0,
        crimesWitnessed: 0,
        attacksSuffered: 0,
        totalGoldTraded: 0,
        dynamicDialogueHistory: [],
        customFlags: {},
        lastConversationTimestamp: new Date().toLocaleTimeString(),
      };
    }

    const memory = npc.memory;
    const reaction = npc.reactionLogic || {};
    const now = Date.now();
    memory.lastEventTimestamp = now;
    memory.lastConversationTimestamp = new Date().toLocaleTimeString();

    if (eventType === 'attack') {
      const repLoss = reaction.reputationChangeOnAttack ?? -25;
      memory.reputation = Math.max(-100, Math.min(100, memory.reputation + repLoss));
      memory.attacksSuffered = (memory.attacksSuffered || 0) + 1;
      memory.crimesWitnessed = (memory.crimesWitnessed || 0) + 1;
      memory.lastEvent = 'attack';

      // Pass event to NPCMemoryService for emotional context & affection calculation
      npcMemoryService.processInteractionEvent(npc, 'attack', {
        damage: eventData?.damage,
        utteranceText: eventData?.details || `Angriff Verrat Feind ${npc.name}`,
      });

      // Update mood based on hostile threshold
      const hostileLimit = reaction.hostileThreshold ?? -20;
      if (memory.reputation <= hostileLimit) {
        npc.mood = 'hostile';
      } else if (memory.reputation < 15) {
        npc.mood = 'suspicious';
      }

      // Select reactive dialogue deterministically
      const customLines = reaction.onAttackedDialogue;
      let chosenLine: string;
      if (customLines && customLines.length > 0) {
        const lineIdx = (memory.attacksSuffered - 1) % customLines.length;
        chosenLine = customLines[lineIdx];
      } else {
        const roleTitle = (npc.title || npc.role || '').toLowerCase();
        if (roleTitle.includes('guard') || roleTitle.includes('wache') || roleTitle.includes('captain')) {
          chosenLine = `Halt im Namen von Aethelgard! Du hast mich angegriffen (Vorfall #${memory.attacksSuffered})! Die Eisenwache wird dich nicht verschonen!`;
        } else if (
          roleTitle.includes('trader') ||
          roleTitle.includes('händler') ||
          roleTitle.includes('builder') ||
          roleTitle.includes('architect')
        ) {
          chosenLine = `Waffen weg! Was fällt dir ein, einen friedlichen Bürger zu attackieren?! Ich verlange Schadensersatz!`;
        } else if (roleTitle.includes('outlaw') || roleTitle.includes('shadow')) {
          chosenLine = `Du ziehst die Klinge gegen mich? Ein törichter Fehler. Die Schatten vergessen keinen Verrat.`;
        } else {
          chosenLine = `Wie kannst du es wagen, mich anzugreifen?! Meine Erinnerung an diesen Verrat verblasst nicht so schnell!`;
        }
      }

      if (!memory.dynamicDialogueHistory) memory.dynamicDialogueHistory = [];
      memory.dynamicDialogueHistory.unshift(`[Angriff #${memory.attacksSuffered}] "${chosenLine}"`);
      if (memory.dynamicDialogueHistory.length > 12) memory.dynamicDialogueHistory.pop();

      // Prepend dynamic line to NPC's available dialogue options
      if (!npc.dialogue.includes(chosenLine)) {
        npc.dialogue = [chosenLine, ...npc.dialogue.slice(0, 3)];
      }

      // Visual and audio feedback
      this.addFloatingText(
        `⚠️ RUF: ${repLoss} (${npc.mood.toUpperCase()})`,
        npc.x,
        npc.y + 3.4,
        '#ef4444',
        'lg',
        true
      );
      this.addChatMessage(
        'system',
        npc.name,
        `[Beziehung verschlechtert] Dein Ruf bei ${npc.name} sank auf ${memory.reputation}/100 (${npc.mood}).`
      );
      soundSynth.playCombatEngage();

      // Contextual semantic learning for Lingua memory
      const currentTick = this.fixedLoop.getMetrics().currentTick;
      arelorianLingua.learnFromContextualUtterance(
        `Angriff Verrat Feind ${npc.name}`,
        'COMBAT_ATTACK',
        currentTick
      );

      reaction.onEvent?.('attack', npc, { damage: eventData?.damage, isHostile: true });
    } else if (eventType === 'trade') {
      const affinity = reaction.tradeAffinityMultiplier ?? 1.2;
      const baseRep = reaction.reputationChangeOnTrade ?? 8;
      const repGain = Math.round(baseRep * affinity);
      memory.reputation = Math.max(-100, Math.min(100, memory.reputation + repGain));
      memory.tradesCompleted = (memory.tradesCompleted || 0) + 1;
      memory.timesInteracted = (memory.timesInteracted || 0) + 1;
      memory.totalGoldTraded = (memory.totalGoldTraded || 0) + (eventData?.goldAmount || 0);
      memory.lastEvent = 'trade';

      // Pass event to NPCMemoryService for emotional context & affection calculation
      npcMemoryService.processInteractionEvent(npc, 'trade', {
        goldAmount: eventData?.goldAmount,
        itemName: eventData?.itemName,
        utteranceText: eventData?.details || `Handel Gold Kauf Tausch ${npc.name}`,
      });

      // Update mood based on friendly and exalted thresholds
      const exaltedLimit = reaction.exaltedThreshold ?? 70;
      const friendlyLimit = reaction.friendlyThreshold ?? 30;
      if (memory.reputation >= exaltedLimit) {
        npc.mood = 'ecstatic';
      } else if (memory.reputation >= friendlyLimit) {
        npc.mood = 'friendly';
      } else if (memory.reputation >= 0) {
        npc.mood = 'neutral';
      }

      // Select reactive dialogue deterministically
      const customLines = reaction.onTradeDialogue;
      let chosenLine: string;
      if (customLines && customLines.length > 0) {
        const lineIdx = (memory.tradesCompleted - 1) % customLines.length;
        chosenLine = customLines[lineIdx];
      } else {
        const itemName = eventData?.itemName ? `[${eventData.itemName}]` : 'diesen Handel';
        if (memory.reputation >= exaltedLimit) {
          chosenLine = `Ein ehrenhafter Verbündeter! Für deine Treue (${memory.tradesCompleted} getätigte Abschlüsse) biete ich stets meine erlesensten Waren.`;
        } else if (memory.reputation >= friendlyLimit) {
          chosenLine = `Vielen Dank für ${itemName}! Stammkunden wie du halten unsere Enklave am Leben.`;
        } else {
          chosenLine = `Ein solider Tausch. Solange du Gold bringst, bist du in ${npc.zone} jederzeit willkommen.`;
        }
      }

      if (!memory.dynamicDialogueHistory) memory.dynamicDialogueHistory = [];
      memory.dynamicDialogueHistory.unshift(`[Handel #${memory.tradesCompleted}] "${chosenLine}"`);
      if (memory.dynamicDialogueHistory.length > 12) memory.dynamicDialogueHistory.pop();

      // Prepend dynamic line to NPC dialogue
      if (!npc.dialogue.includes(chosenLine)) {
        npc.dialogue = [chosenLine, ...npc.dialogue.slice(0, 3)];
      }

      // Visual and audio feedback
      this.addFloatingText(
        `✨ RUF: +${repGain} (${npc.mood.toUpperCase()})`,
        npc.x,
        npc.y + 3.4,
        '#10b981',
        'md'
      );
      this.addChatMessage(
        'system',
        npc.name,
        `[Beziehung gestärkt] Dein Ruf bei ${npc.name} stieg auf ${memory.reputation}/100 (${npc.mood}).`
      );
      soundSynth.playItemPickup();

      // Contextual semantic learning for Lingua memory
      const currentTick = this.fixedLoop.getMetrics().currentTick;
      arelorianLingua.learnFromContextualUtterance(
        `Handel Gold Kauf Tausch ${npc.name}`,
        'TRADE_COMMERCE',
        currentTick
      );

      reaction.onEvent?.('trade', npc, { amount: eventData?.goldAmount, itemName: eventData?.itemName });
    } else if (eventType === 'crime') {
      memory.crimesWitnessed = (memory.crimesWitnessed || 0) + 1;
      const repLoss = reaction.crimeTolerance === 'high' ? -5 : reaction.crimeTolerance === 'moderate' ? -15 : -30;
      memory.reputation = Math.max(-100, Math.min(100, memory.reputation + repLoss));
      memory.lastEvent = 'crime';
      if (memory.reputation <= (reaction.hostileThreshold ?? -20)) {
        npc.mood = 'hostile';
      }
      this.addFloatingText(`🚨 VERBRECHEN BEOBACHTET (${repLoss})`, npc.x, npc.y + 3.4, '#f59e0b', 'md');
      reaction.onEvent?.('crime', npc, { isHostile: true });
    }

    return memory;
  }

  public recordComboHit(damage: number, isCrit: boolean, weaponType: WeaponType) {
    const now = performance.now();
    this.comboState.count += 1;
    this.comboState.timer = 3.2; // 3.2s combo window
    this.comboState.totalDamage += damage;
    this.comboState.activeWeaponType = weaponType;
    this.comboState.lastHitTime = now;
    this.comboState.recentHits += 1;
    if (this.comboState.count > this.comboState.maxCombo) {
      this.comboState.maxCombo = this.comboState.count;
    }

    // Contextual semantic learning: words spoken immediately before/during attacks get associated with COMBAT_ATTACK
    if (this.lastPlayerChatText && now - this.lastPlayerChatTime < 15000) {
      const currentTick = this.fixedLoop.getMetrics().currentTick;
      arelorianLingua.learnFromContextualUtterance(this.lastPlayerChatText, 'COMBAT_ATTACK', currentTick);
    }

    // Dynamic Multiplier & Rank by weapon archetype
    let rank: ComboRank = 'NORMAL';
    let rankName = 'COMBAT FLOW';
    let rankColor = '#e2e8f0';
    let bonusMult = 0;

    const count = this.comboState.count;
    if (count >= 30) {
      rank = 'AURION';
      rankName = 'AURION TRANSCENDENCE';
      rankColor = '#ec4899';
      bonusMult = 0.35;
    } else if (count >= 20) {
      rank = 'TITAN';
      rankName = 'TITAN BREAKER';
      rankColor = '#f59e0b';
      bonusMult = 0.25;
    } else if (count >= 10) {
      rank = 'TEMPEST';
      rankName = 'TEMPEST FLURRY';
      rankColor = '#10b981';
      bonusMult = 0.15;
    } else if (count >= 5) {
      rank = 'AETHER';
      rankName = 'AETHER SURGE';
      rankColor = '#00f0ff';
      bonusMult = 0.08;
    }

    // Heavy weapons (battleaxe, warhammer, greatsword) ramp multiplier faster per hit
    if (weaponType === 'battleaxe' || weaponType === 'warhammer' || weaponType === 'greatsword') {
      bonusMult *= 1.35;
    } else if (weaponType === 'daggers' || weaponType === 'knuckles') {
      bonusMult *= 0.9;
    }

    this.comboState.rank = rank;
    this.comboState.rankName = rankName;
    this.comboState.rankColor = rankColor;
    this.comboState.multiplier = 1.0 + bonusMult;

    soundSynth.playComboHit(this.comboState.count, isCrit);
    if (count === 5 || count === 10 || count === 20 || count === 30 || count === 50) {
      soundSynth.playComboMilestone(this.comboState.count);
      this.addFloatingText(
        `⚡ ${this.comboState.count} COMBO: ${rankName}! ⚡`,
        this.player.position.x,
        this.player.position.y + 2.5,
        rankColor,
        'xl',
        true,
        this.player.position.z,
        'combo',
        '⚡'
      );
    }
  }

  public addDirectionalDamageIndicator(
    sourceX: number,
    sourceZ: number,
    damage: number,
    isCrit: boolean = false,
    sourceType: DirectionalDamageIndicator['sourceType'] = 'mob',
    color?: string,
    sourceName?: string
  ) {
    // Calculate world angle from player to source
    const dx = sourceX - this.player.position.x;
    const dz = sourceZ - this.player.position.z;
    const worldAngle = Math.atan2(dx, dz);

    // Calculate angle relative to camera view yaw
    const camAngle = this.cameraYaw;
    let relativeAngle = worldAngle - camAngle;

    // Normalize between -PI and PI
    while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
    while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;

    const indColor = color || (isCrit ? '#f59e0b' : sourceType === 'boss' ? '#fbbf24' : '#ef4444');

    this.directionalIndicators.push({
      id: `dir_hit_${++this.dirIndicatorIdCounter}`,
      angleRad: relativeAngle,
      damage,
      lifespan: 1.2,
      maxLifespan: 1.2,
      opacity: 1.0,
      isCrit,
      sourceType,
      sourceName,
      color: indColor,
    });

    if (this.directionalIndicators.length > 8) {
      this.directionalIndicators.shift();
    }

    soundSynth.playDirectionalDamageSound(relativeAngle, isCrit);
  }

  public addFloatingText(
    text: string,
    x: number,
    y: number,
    color: string,
    size: FloatingCombatText['size'] = 'md',
    isCrit: boolean = false,
    z?: number,
    type?: FloatingCombatText['type'],
    icon?: string
  ) {
    const textZ = z ?? this.player.position.z;
    let screenX: number | undefined;
    let screenY: number | undefined;

    if (this.camera) {
      const proj = new THREE.Vector3(x, y, textZ).project(this.camera);
      if (proj.z <= 1.0) {
        screenX = Math.round((proj.x * 0.5 + 0.5) * 1000) / 10;
        screenY = Math.round((-(proj.y * 0.5) + 0.5) * 1000) / 10;
      }
    }

    this.floatingTexts.push({
      id: `ftext_${++this.textIdCounter}`,
      text,
      x,
      y,
      z: textZ,
      screenX,
      screenY,
      color,
      size,
      opacity: 1.0,
      lifespan: isCrit || size === 'xl' ? 1.8 : 1.4,
      vy: isCrit ? 1.5 : 1.2,
      isCrit,
      type: type || (isCrit ? 'crit' : 'damage'),
      icon,
    });
  }

  public setVirtualMovement(forward: number, right: number) {
    this.virtualForward = forward;
    this.virtualRight = right;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.handleResize();

    // Verify non-zero viewport dimensions on next animation frame
    requestAnimationFrame(() => {
      this.handleResize();
      if (this.renderer) {
        const size = this.renderer.getSize(new THREE.Vector2());
        console.info(`[MMOEngine] Runtime Viewport Validated: [${size.x}w x ${size.y}h]`);
      }
    });

    this.loop(this.lastTime);
  }

  public stop() {
    this.isRunning = false;
    cancelAnimationFrame(this.animationFrameId);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.unbindEvents();

    multiplayerClient.disconnect();
    this.remotePlayers?.dispose();
    this.npcEconomyVisualizer?.destroy();

    try {
      if (this.renderer) {
        if (this.renderer.domElement && this.renderer.domElement.parentElement === this.container) {
          this.container.removeChild(this.renderer.domElement);
        }
        this.renderer.dispose();
      }
    } catch (e) {
      console.warn('MMOEngine: Error during renderer disposal', e);
    }
  }

  private loop = (time: number) => {
    if (!this.isRunning) return;
    const delta = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    this.update(delta);
    this.renderer.render(this.scene, this.camera);

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private update(delta: number) {
    // 1. Calculate Movement Vector from WASD / Arrow Keys / Virtual On-Screen Joystick
    let inputForward = this.virtualForward;
    let inputRight = this.virtualRight;

    if (this.keysPressed['w'] || this.keysPressed['arrowup']) inputForward += 1;
    if (this.keysPressed['s'] || this.keysPressed['arrowdown']) inputForward -= 1;
    if (this.keysPressed['d'] || this.keysPressed['arrowright']) inputRight += 1;
    if (this.keysPressed['a'] || this.keysPressed['arrowleft']) inputRight -= 1;

    // Rotate movement vector by Camera Yaw (Forward: camera facing direction, Right: camera strafe right)
    const forwardX = -Math.sin(this.cameraYaw);
    const forwardZ = -Math.cos(this.cameraYaw);
    const rightX = Math.cos(this.cameraYaw);
    const rightZ = -Math.sin(this.cameraYaw);

    const moveX = inputForward * forwardX + inputRight * rightX;
    const moveZ = inputForward * forwardZ + inputRight * rightZ;

    // Fixed timestep deterministic simulation & visualizer interpolation advance
    const alpha = this.fixedLoop.advance(delta);
    this.npcEconomyVisualizer.update(alpha, this.lastTime / 1000, this.camera);

    // Record command into client prediction history
    if (moveX !== 0 || moveZ !== 0) {
      clientPrediction.recordCommand(
        inputForward,
        inputRight,
        this.player.stats.moveSpeed,
        delta,
        this.player.position.x,
        this.player.position.y,
        this.player.position.z
      );
    }

    // 2. Update Player
    this.player.update(delta, { x: moveX, z: moveZ });

    // Terrain solid mass height enforcement & Barycentric normal tilt alignment
    const elev = this.landscape.chunkManager.getElevationAt(this.player.position.x, this.player.position.z);
    const terrainSample = terrainBarycentric.sample(this.player.position.x, this.player.position.z, this.player.facingAngle);
    const finalY = Math.max(elev, terrainSample.height);
    this.player.position.y = finalY;
    this.player.group.position.y = finalY;
    if (this.player.rootGroup) {
      this.player.rootGroup.rotation.x = terrainSample.pitchAngleRad * 0.65;
      this.player.rootGroup.rotation.z = -terrainSample.rollAngleRad * 0.65;
    }

    // Lag compensation snapshot recording for local hero
    lagCompensation.recordSnapshot('hero_player_1', this.player.position, 0.55, 1.8, this.player.facingAngle);

    // Update real ballistic projectile simulation
    this.ballisticPhysics.update(delta);

    // Synchronize global dynamic weather system with lighting and sky
    this.currentWeather = globalWeather.applyToScene(this.scene, this.ambientLight, Date.now());

    // Update collision visualizer player hitbox
    if (this._enableCollisionVisualizer && this.collisionDebugGroup) {
      const pMesh = this.collisionDebugGroup.children.find(c => c.name === 'playerHitbox');
      if (pMesh) {
        pMesh.position.set(this.player.position.x, elev + 2, this.player.position.z);
      }
    }

    // Update Pathfinding 3D Debug Visualizer (NPC trajectories, macro starpaths, deviation highlights)
    if (this.isPathfindingDebugEnabled) {
      this.updatePathfindingDebugVisualizer();
    }

    // Dynamic Procedural World Expansion (builds map forward as player approaches edges)
    this.landscape.chunkManager.checkPlayerProximity(this.player.position.x, this.player.position.z);

    // Update Landscape Animations (floating crystal, monoliths, etc.)
    this.landscape.update(delta);

    // 3. Update Skill Cooldowns
    const classDef = MMORPG_CLASSES[this.player.currentClassId];
    classDef.skills.forEach((s) => {
      if (s.currentCooldown > 0) {
        s.currentCooldown = Math.max(0, s.currentCooldown - delta);
      }
    });

    // 4. Update 3rd Person Orbit / Follow Camera
    const horizDist = this.cameraDistance * Math.cos(this.cameraPitch);
    const vertDist = this.cameraHeight + this.cameraDistance * Math.sin(this.cameraPitch);
    const targetCamX = this.player.position.x + Math.sin(this.cameraYaw) * horizDist;
    const targetCamY = this.player.position.y + vertDist;
    const targetCamZ = this.player.position.z + Math.cos(this.cameraYaw) * horizDist;

    this.camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), delta * 8.0);
    this.camera.lookAt(this.player.position.x, this.player.position.y + 1.6, this.player.position.z);

    // 5. Update Mobs AI & Authoritative Threat Matrix with Target Tether Lines
    this.mobManager.update(
      delta,
      this.player.position.x,
      this.player.position.z,
      this.player.stats.hp,
      (mob, dmg, targetId) => {
        // Mob attacks target: Hero or Simulated Player
        if (!targetId || targetId === 'hero_player_1') {
          const res = this.player.takeDamage(dmg);
          if (res.dodged) {
            this.combatMetricsTracker.recordDamageTaken(0, mob.name, true, res.iFrame);
            this.addFloatingText(res.iFrame ? '✨ I-FRAME DODGE!' : '💨 DODGED!', this.player.position.x, this.player.position.y + 2.2, '#38bdf8', 'lg');
            return;
          }

          this.combatMetricsTracker.recordDamageTaken(res.damageTaken, mob.name);
          soundSynth.playHitSound();

          // Directional damage hit indicator relative to camera orientation
          this.addDirectionalDamageIndicator(
            mob.x,
            mob.z,
            res.damageTaken,
            false,
            mob.isBoss ? 'boss' : 'mob',
            mob.isBoss ? '#f59e0b' : '#ef4444'
          );

          this.addFloatingText(
            `-${res.damageTaken}`,
            this.player.position.x,
            this.player.position.y + 1.8,
            '#ef4444',
            'lg',
            false,
            this.player.position.z,
            'player_damage',
            '🛡️'
          );

          if (res.isDead) {
            this.handlePlayerDeath();
          }
        } else {
          // Attack simulated peer
          const sim = this.simPlayers.players.find((p) => p.data.id === targetId);
          if (sim) {
            soundSynth.playHitSound();
            this.addFloatingText(`-${dmg}`, sim.data.x, 2.2, '#f97316', 'md');
          }
        }
      },
      (entityId: string) => {
        if (entityId === 'hero_player_1') {
          return {
            x: this.player.position.x,
            y: this.player.position.y,
            z: this.player.position.z,
            isAlive: this.player.stats.hp > 0,
            isPlayer: true,
            name: 'Hero Player',
          };
        }
        const sim = this.simPlayers.players.find((p) => p.data.id === entityId);
        if (sim) {
          return {
            x: sim.data.x,
            y: sim.data.y,
            z: sim.data.z,
            isAlive: (sim.data.hp ?? 100) > 0,
            isPlayer: false,
            name: sim.data.name,
          };
        }
        return null;
      }
    );

    // 5.1 Keep targetMob in sync with real-time Threat Matrix & positions
    if (this.targetMob) {
      const liveMob = this.mobManager.mobs.find((m) => m.entity.id === this.targetMob!.id);
      if (liveMob && liveMob.entity.hp > 0) {
        this.targetMob = { ...liveMob.entity };
      } else {
        this.targetMob = null;
      }
    }

    // 5.2 Action Buffering: Fire queued skill as soon as character attack animation ends
    if (!this.player.isAttacking && this.player.bufferedSkillIndex !== null) {
      const buffered = this.player.clearBufferedSkill();
      if (buffered !== null) {
        this.castClassSkill(buffered);
      }
    }

    // 5.3 Update Elemental Synergies & DoT ticks
    this.elementalSynergyEngine.update(delta, (entityId, dotDmg, type, color) => {
      const mobVisual = this.mobManager.mobs.find((m) => m.entity.id === entityId);
      if (mobVisual && mobVisual.entity.hp > 0) {
        mobVisual.entity.hp = Math.max(0, mobVisual.entity.hp - dotDmg);
        this.addFloatingText(`-${dotDmg} ${type}`, mobVisual.entity.x, mobVisual.entity.y + 1.8, color, 'sm');
        this.combatMetricsTracker.recordDamageDealt(dotDmg, false, mobVisual.entity.name, type);
        if (mobVisual.entity.hp <= 0) {
          this.mobManager.damageMob(entityId, 1, 'hero_player_1');
        }
      }
    });

    // 5.4 Update Real-Time Combat Metrics & DPS Meter
    this.combatMetricsTracker.update(delta);

    // 5.5 Update Boss / Elite Telegraphs & Collision Resolution
    this.telegraphVisualizer.update(delta, (telegraph) => {
      const dist = Math.hypot(this.player.position.x - telegraph.x, this.player.position.z - telegraph.z);
      let hitPlayer = false;
      if (telegraph.type === 'circle') {
        hitPlayer = dist <= telegraph.radius;
      } else if (telegraph.type === 'cone') {
        if (dist <= telegraph.radius) {
          const angleToPlayer = Math.atan2(this.player.position.x - telegraph.x, this.player.position.z - telegraph.z);
          let diff = angleToPlayer - (telegraph.angle || 0);
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const halfArc = (telegraph.arcAngle || Math.PI * 0.5) / 2;
          hitPlayer = Math.abs(diff) <= halfArc;
        }
      } else {
        const localX = (this.player.position.x - telegraph.x) * Math.cos(-(telegraph.angle || 0)) - (this.player.position.z - telegraph.z) * Math.sin(-(telegraph.angle || 0));
        const localZ = (this.player.position.x - telegraph.x) * Math.sin(-(telegraph.angle || 0)) + (this.player.position.z - telegraph.z) * Math.cos(-(telegraph.angle || 0));
        const halfW = (telegraph.width || 3.5) / 2;
        hitPlayer = Math.abs(localX) <= halfW && localZ >= 0 && localZ <= (telegraph.length || 12.0);
      }

      if (hitPlayer) {
        const res = this.player.takeDamage(telegraph.damage);
        if (res.dodged) {
          this.combatMetricsTracker.recordDamageTaken(0, telegraph.sourceName || 'Boss Telegraph', true, res.iFrame);
          this.addFloatingText(res.iFrame ? '✨ I-FRAME DODGE!' : '💨 DODGED!', this.player.position.x, this.player.position.y + 2.2, '#38bdf8', 'lg');
        } else {
          this.combatMetricsTracker.recordDamageTaken(res.damageTaken, telegraph.sourceName || 'Boss Telegraph');
          soundSynth.playHitSound();
          this.particleSystem.emit('fire_impact', this.player.position, telegraph.color || '#ef4444', 1.8);
          this.addFloatingText(`💥 TELEGRAPH -${res.damageTaken}`, this.player.position.x, this.player.position.y + 2.5, '#ef4444', 'xl');
          if (res.isDead) {
            this.handlePlayerDeath();
          }
        }
      }
      this.particleSystem.emit('magic_impact', { x: telegraph.x, y: telegraph.y + 0.5, z: telegraph.z }, telegraph.color || '#ef4444', 2.0);
    });

    // 5.6 Boss / Elite Telegraph Casting Routine
    this.mobManager.mobs.forEach((visual) => {
      const mob = visual.entity;
      if ((mob.isBoss || mob.isElite) && mob.isAggroed && mob.hp > 0) {
        (mob as any).telegraphCd = ((mob as any).telegraphCd || (mob.isBoss ? 7.0 : 11.0)) - delta;
        if ((mob as any).telegraphCd <= 0) {
          (mob as any).telegraphCd = mob.isBoss ? 8.5 : 14.0;
          const targetX = this.player.position.x;
          const targetZ = this.player.position.z;
          const angleToTarget = Math.atan2(targetX - mob.x, targetZ - mob.z);
          const tType: 'circle' | 'cone' | 'rectangle' = mob.isBoss
            ? (Math.random() < 0.4 ? 'circle' : Math.random() < 0.7 ? 'cone' : 'rectangle')
            : 'circle';

          const telegraph: BossTelegraph = {
            id: `tele_${mob.id}_${Date.now()}`,
            sourceMobId: mob.id,
            sourceName: mob.name,
            skillName: mob.isBoss ? 'Cataclysmic Slam' : 'Arcane Blast',
            type: tType,
            x: tType === 'circle' ? targetX : mob.x,
            y: 0,
            z: tType === 'circle' ? targetZ : mob.z,
            radius: tType === 'circle' ? 4.8 : 7.5,
            arcAngle: Math.PI * 0.6,
            width: 3.5,
            length: 12.0,
            angle: angleToTarget,
            castTime: 0,
            totalCastTime: mob.isBoss ? 2.4 : 3.0,
            damage: Math.round(mob.damage * (mob.isBoss ? 1.5 : 1.25)),
            color: mob.isBoss ? '#ef4444' : '#f59e0b',
          };
          this.telegraphVisualizer.addTelegraph(telegraph);
          this.addFloatingText(`⚠️ ${mob.name} prepares ${tType.toUpperCase()}!`, mob.x, mob.y + 3.0, '#ef4444', 'lg');
        }
      }
    });

    // 6. Update Loot Drops & Check nearby interaction prompts (with Auto-Loot for common items)
    this.lootManager.update(delta);

    if (this.autoLootEnabled) {
      const autoLooted = this.lootManager.collectNearbyCommonLoot(
        this.player.position.x,
        this.player.position.z,
        4.0
      );
      if (autoLooted.length > 0) {
        soundSynth.playLootPickup();
        for (const loot of autoLooted) {
          this.player.inventory.push(loot.item);
          if (loot.goldAmount > 0) {
            this.player.stats.gold += loot.goldAmount;
          }
          this.addFloatingText(
            `+ Auto-Loot: ${loot.item.name}`,
            this.player.position.x + (Math.random() - 0.5) * 1.5,
            this.player.position.y + 2.2,
            loot.beamColor,
            'md'
          );
          this.addChatMessage(
            'system',
            'Auto-Loot',
            `📦 Automatisch aufgesammelt: [${loot.item.name}] (Gewöhnlich)${loot.goldAmount > 0 ? ` + ${loot.goldAmount} Gold` : ''}`
          );
        }
        this.progressQuests('collect_loot');
      }
    }

    this.nearbyLoot = this.lootManager.getNearbyLoot(this.player.position.x, this.player.position.z, 3.5);

    // Check nearby NPC
    this.nearbyNPC = null;
    for (const npc of this.npcs) {
      if (Math.hypot(npc.x - this.player.position.x, npc.z - this.player.position.z) <= 5.5) {
        this.nearbyNPC = npc;
        break;
      }
    }

    // 7. Update Active Projectiles
    const remainingProjs: ActiveProjectile[] = [];
    this.projectiles.forEach((proj) => {
      proj.progress += (proj.speed * delta) / proj.startPos.distanceTo(proj.targetPos);
      proj.mesh.position.lerpVectors(proj.startPos, proj.targetPos, Math.min(1.0, proj.progress));

      if (proj.progress >= 1.0) {
        this.scene.remove(proj.mesh);
        this.applyDamageToMob(proj.targetMobId, proj.damage, proj.isCrit);
      } else {
        remainingProjs.push(proj);
      }
    });
    this.projectiles = remainingProjs;

    // 8. Update AoE Effects
    const remainingAoE: ActiveAoEEffect[] = [];
    this.aoeEffects.forEach((aoe) => {
      aoe.timer -= delta;
      aoe.mesh.scale.multiplyScalar(1.0 + delta * 0.4);
      if (aoe.timer <= 0) {
        this.scene.remove(aoe.mesh);
      } else {
        remainingAoE.push(aoe);
      }
    });
    this.aoeEffects = remainingAoE;

    // 9. Update Simulated Players & Realtime Network Players
    this.simPlayers.update(delta);
    this.remotePlayers.update(delta, this.camera.position);

    // Sync Local Player via WebSocket (20Hz)
    const actionState: 'idle' | 'walk' | 'run' | 'hit' | 'attack' | 'cast' = this.player.isAttacking
      ? 'attack'
      : this.player.isMoving
      ? 'run'
      : 'idle';
    multiplayerClient.syncLocalPlayer({
      x: this.player.position.x,
      y: this.player.position.y,
      z: this.player.position.z,
      facingAngle: this.player.facingAngle,
      actionState,
      hp: this.player.stats.hp,
      maxHp: this.player.stats.maxHp,
      level: this.player.stats.level,
      isMounted: !!this.player.stats.isMounted,
      activeWeaponType: this.player.getActiveWeaponType(),
      equipment: this.player.equipment,
    });

    // Update Buffs / Debuffs System
    buffSystem.update(delta, (entityId, effect) => {
      if (entityId === 'hero_player_1') {
        if (effect.damage) {
          this.player.takeDamage(effect.damage);
          this.addDirectionalDamageIndicator(
            this.player.position.x + (Math.random() - 0.5) * 4,
            this.player.position.z + (Math.random() - 0.5) * 4,
            effect.damage,
            false,
            'hazard',
            effect.color || '#ef4444'
          );
          this.addFloatingText(
            `-${effect.damage}`,
            this.player.position.x,
            this.player.position.y + 1.8,
            effect.color || '#ef4444',
            'md',
            false,
            this.player.position.z,
            'player_damage',
            '🔥'
          );
        }
        if (effect.heal) {
          this.player.heal(effect.heal);
          this.addFloatingText(
            `+${effect.heal}`,
            this.player.position.x,
            this.player.position.y + 1.8,
            '#10b981',
            'md',
            false,
            this.player.position.z,
            'heal',
            '💚'
          );
        }
      }
    });
    this.activeBuffs = buffSystem.getActiveBuffs('hero_player_1').map((b) => ({
      id: b.id,
      name: b.name,
      icon: b.icon,
      color: b.color,
      duration: b.duration,
      stacks: b.stacks,
    }));

    // LOD & Frustum Culling update
    lodManager.update(this.camera);

    // Dynamic FPS computation
    if (delta > 0) {
      const currentFps = 1.0 / delta;
      this.frameTimes.push(currentFps);
      if (this.frameTimes.length > 20) this.frameTimes.shift();
      this.fpsCounter = Math.round(this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length);
    }

    // Update Combo State Timer & Decay
    if (this.comboState.timer > 0) {
      this.comboState.timer -= delta;
      if (this.comboState.timer <= 0) {
        if (this.comboState.count >= 5) {
          this.addFloatingText(
            'Combo Dropped',
            this.player.position.x,
            this.player.position.y + 2.0,
            '#94a3b8',
            'sm',
            false,
            this.player.position.z,
            'system'
          );
        }
        this.comboState.count = 0;
        this.comboState.totalDamage = 0;
        this.comboState.multiplier = 1.0;
        this.comboState.rank = 'NORMAL';
        this.comboState.rankName = 'COMBAT FLOW';
        this.comboState.rankColor = '#e2e8f0';
        this.comboState.recentHits = 0;
      }
    }

    // Update Directional Damage Indicators Lifespan
    this.directionalIndicators.forEach((ind) => {
      ind.lifespan -= delta;
      ind.opacity = Math.max(0, ind.lifespan / ind.maxLifespan);
    });
    this.directionalIndicators = this.directionalIndicators.filter((ind) => ind.lifespan > 0);

    // 10. Update Floating Combat Texts with real-time 3D camera projection
    const projVector = new THREE.Vector3();
    this.floatingTexts.forEach((t) => {
      t.y += t.vy * delta;
      t.lifespan -= delta;
      const maxLife = t.isCrit || t.size === 'xl' ? 1.8 : 1.4;
      t.opacity = Math.max(0, t.lifespan / maxLife);

      // Realtime 3D to 2D screen coordinate projection
      if (this.camera) {
        projVector.set(t.x, t.y, t.z ?? this.player.position.z);
        projVector.project(this.camera);
        if (projVector.z <= 1.0) {
          t.screenX = Math.round((projVector.x * 0.5 + 0.5) * 1000) / 10;
          t.screenY = Math.round((-(projVector.y * 0.5) + 0.5) * 1000) / 10;
        } else {
          t.screenX = -100;
          t.screenY = -100;
        }
      }
    });
    this.floatingTexts = this.floatingTexts.filter((t) => t.lifespan > 0);

    // 11. Update Particle System
    if (this.particleSystem && this.gmConfig.ambientParticles) {
      this.particleSystem.update(delta);
    }

    // 12. Dynamic Atmospheric Day-Night Cycle
    const dayNightInfo = this.updateDayNightCycle(delta);

    // 13. Update Party Manager & Synchronize Member Vitals
    this.partyManager.updatePlayerStats(
      this.player.stats.hp,
      this.player.stats.maxHp,
      this.player.stats.resource,
      this.player.stats.maxResource,
      this.player.stats.level,
      this.player.stats.currentZone
    );
    this.partyManager.update(delta, !!this.targetMob, this.targetMob);

    // 14. Update Companion Pet following Player
    if (this.petMeshGroup && this.activePet) {
      const offsetDist = 2.2;
      const angle = this.player.facingAngle + Math.PI * 0.75;
      const targetPetX = this.player.position.x + Math.sin(angle) * offsetDist;
      const targetPetZ = this.player.position.z + Math.cos(angle) * offsetDist;
      const targetPetY = this.player.position.y + (this.activePet.species === 'aether_wisp' ? 1.5 + Math.sin(performance.now() * 0.004) * 0.3 : 0.3);

      this.petPosition.lerp(new THREE.Vector3(targetPetX, targetPetY, targetPetZ), delta * 5.0);
      this.petMeshGroup.position.copy(this.petPosition);
      this.petMeshGroup.rotation.y = this.player.facingAngle;

      if (this.activePet.species === 'aether_wisp') {
        this.petMeshGroup.rotation.y += delta * 3.0;
      }
    }

    // Update Zone Name
    this.player.stats.currentZone = this.landscape.getZoneName(this.player.position.x, this.player.position.z);

    // 15. Dispatch State to React HUD & Synchronize Backend State
    this.stateUpdateTimer += delta;
    if (this.stateUpdateTimer >= 0.045) {
      this.stateUpdateTimer = 0;

      // Sync state with SyncManager
      syncManager.updateLocalState({
        stats: { ...this.player.stats },
        inventory: [...this.player.inventory],
        quests: [...this.quests],
        activePetId: this.activePet?.id,
        unlockedHouses: this.unlockedHouses.map((h) => h.id),
      });

      this.onStateUpdate?.({
        stats: { ...this.player.stats },
        equipment: { ...this.player.equipment },
        inventory: [...this.player.inventory],
        targetMob: this.targetMob,
        nearbyNPC: this.nearbyNPC,
        nearbyLoot: this.nearbyLoot,
        quests: [...this.quests],
        chatMessages: [...this.chatMessages],
        floatingTexts: [...this.floatingTexts],
        simPlayers: this.simPlayers.getPlayers(),
        partyMembers: this.partyManager.getMembers(),
        dayNightInfo,
        netStats: { ...this.netStats },
        activeBuffs: [...this.activeBuffs],
        engineMetrics: {
          fps: this.fpsCounter,
          lodStats: { ...lodManager.stats },
          simulationStats: {
            tickRate: this.fixedLoop.targetTickRate,
            currentTick: this.fixedLoop.getMetrics().currentTick,
            reconciledCount: clientPrediction.stats.totalReconciled,
            pendingPredictions: clientPrediction.getPendingCount(),
            occludedObjects: occlusionCulling.stats.totalOccluded,
            activeBallistics: this.ballisticPhysics.projectiles.length,
          },
          weatherState: {
            name: this.currentWeather.name,
            type: this.currentWeather.type,
            combatBuffDescription: this.currentWeather.combatBuffDescription,
            timeRemainingSec: this.currentWeather.timeRemainingSec,
          },
        },
        autoLootEnabled: this.autoLootEnabled,
        pityCounters: this.lootManager.getAllPityCounters(),
        facingAngle: this.player.facingAngle,
        cameraYaw: this.cameraYaw,
        activeMobs: this.mobManager.getAllMobs(),
        npcs: this.npcs,
        comboState: { ...this.comboState },
        directionalIndicators: [...this.directionalIndicators],
        dpsMeterStats: this.combatMetricsTracker.getStats(),
        combatLogs: this.combatMetricsTracker.getStats().recentLogs,
      });
    }
  }

  // --- Dynamic Day-Night Atmospheric Cycle Subsystem ---
  public updateDayNightCycle(delta: number): DayNightInfo {
    if (this.isDayNightActive) {
      this.timeOfDay = (this.timeOfDay + delta * this.dayNightSpeed) % 24.0;
    }

    const t = this.timeOfDay;
    const hours = Math.floor(t);
    const minutes = Math.floor((t - hours) * 60);
    const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    let phase: 'dawn' | 'day' | 'dusk' | 'night' = 'day';
    let phaseName = 'Golden Midday';
    let icon = '☀️';

    const targetSunColor = new THREE.Color();
    const targetHemiSky = new THREE.Color();
    const targetHemiGround = new THREE.Color();
    const targetFillColor = new THREE.Color();
    const targetSkyColor = new THREE.Color();

    let targetSunIntensity = 2.5;
    let targetHemiIntensity = 1.6;
    let targetFillIntensity = 1.0;
    let targetExposure = 1.35;

    // Solar angle: 0 at 6am, PI/2 at 12pm, PI at 6pm, 3PI/2 at 12am
    const solarAngle = ((t - 6.0) / 24.0) * Math.PI * 2;
    const sunDist = 120;
    const sunX = Math.cos(solarAngle) * sunDist;
    const sunY = Math.max(12, Math.sin(solarAngle) * sunDist);
    const sunZ = 50 + Math.cos(solarAngle * 0.5) * 30;

    this.sunLight.position.set(sunX, sunY, sunZ);
    this.fillLight.position.set(-sunX * 0.7, Math.max(15, -sunY * 0.4 + 45), -sunZ * 0.7);

    if (t >= 5.0 && t < 8.5) {
      // DAWN / SUNRISE (05:00 - 08:30)
      phase = 'dawn';
      phaseName = 'Amber Steam Dawn';
      icon = '🌅';
      const progress = (t - 5.0) / 3.5;

      targetSunColor.setHex(0xf59e0b).lerp(new THREE.Color(0xfffbeb), progress);
      targetHemiSky.setHex(0xf97316).lerp(new THREE.Color(0x93c5fd), progress);
      targetHemiGround.setHex(0x451a03).lerp(new THREE.Color(0x475569), progress);
      targetFillColor.setHex(0xc084fc).lerp(new THREE.Color(0x38bdf8), progress);
      targetSkyColor.setHex(0x2a1b2d).lerp(new THREE.Color(0x1e293b), progress);

      targetSunIntensity = 0.8 + progress * 1.7;
      targetHemiIntensity = 1.0 + progress * 0.6;
      targetFillIntensity = 0.6 + progress * 0.4;
      targetExposure = 1.1 + progress * 0.25;
    } else if (t >= 8.5 && t < 17.5) {
      // MIDDAY / DAY (08:30 - 17:30)
      phase = 'day';
      phaseName = 'Golden Sun Midday';
      icon = '☀️';

      targetSunColor.setHex(0xfffbeb);
      targetHemiSky.setHex(0x93c5fd);
      targetHemiGround.setHex(0x475569);
      targetFillColor.setHex(0x38bdf8);
      targetSkyColor.setHex(0x1e293b);

      targetSunIntensity = 2.6;
      targetHemiIntensity = 1.7;
      targetFillIntensity = 1.1;
      targetExposure = 1.35;
    } else if (t >= 17.5 && t < 21.0) {
      // DUSK / TWILIGHT (17:30 - 21:00)
      phase = 'dusk';
      phaseName = 'Crimson Aether Twilight';
      icon = '🌇';
      const progress = (t - 17.5) / 3.5;

      targetSunColor.setHex(0xea580c).lerp(new THREE.Color(0xa855f7), progress);
      targetHemiSky.setHex(0x7e22ce).lerp(new THREE.Color(0x1e1b4b), progress);
      targetHemiGround.setHex(0x7c2d12).lerp(new THREE.Color(0x0f172a), progress);
      targetFillColor.setHex(0xf59e0b).lerp(new THREE.Color(0x06b6d4), progress);
      targetSkyColor.setHex(0x27173a).lerp(new THREE.Color(0x0a0f1d), progress);

      targetSunIntensity = 2.2 - progress * 1.4;
      targetHemiIntensity = 1.5 - progress * 0.6;
      targetFillIntensity = 1.0 - progress * 0.2;
      targetExposure = 1.3 - progress * 0.3;
    } else {
      // NIGHT / MIDNIGHT (21:00 - 05:00)
      phase = 'night';
      phaseName = 'Starlit Aether Night';
      icon = '🌙';

      targetSunColor.setHex(0x7dd3fc); // Silvery moonlight
      targetHemiSky.setHex(0x1e1b4b); // Deep celestial indigo
      targetHemiGround.setHex(0x0f172a);
      targetFillColor.setHex(0x06b6d4); // Neon cyan aether glow
      targetSkyColor.setHex(0x080c18); // Midnight abyss

      targetSunIntensity = 0.95; // Moon radiance
      targetHemiIntensity = 0.95;
      targetFillIntensity = 0.85;
      targetExposure = 1.05;
    }

    // Smoothly blend light values
    const lerpRate = Math.min(1.0, delta * 4.0);
    this.sunLight.color.lerp(targetSunColor, lerpRate);
    this.sunLight.intensity = THREE.MathUtils.lerp(this.sunLight.intensity, targetSunIntensity, lerpRate);

    this.hemiLight.color.lerp(targetHemiSky, lerpRate);
    this.hemiLight.groundColor.lerp(targetHemiGround, lerpRate);
    this.hemiLight.intensity = THREE.MathUtils.lerp(this.hemiLight.intensity, targetHemiIntensity, lerpRate);

    this.fillLight.color.lerp(targetFillColor, lerpRate);
    this.fillLight.intensity = THREE.MathUtils.lerp(this.fillLight.intensity, targetFillIntensity, lerpRate);

    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(this.renderer.toneMappingExposure, targetExposure, lerpRate);

    this.currentSkyColor.lerp(targetSkyColor, lerpRate);
    this.renderer.setClearColor(this.currentSkyColor, 1.0);
    if (this.scene.fog) {
      this.scene.fog.color.copy(this.currentSkyColor);
    }

    return {
      timeOfDay: t,
      formattedTime,
      phase,
      phaseName,
      icon,
      sunIntensity: this.sunLight.intensity,
      skyColorHex: '#' + this.currentSkyColor.getHexString(),
    };
  }

  // --- Inventory Auto-Sorting Subsystem ---
  public sortInventory(mode: 'rarity' | 'name' | 'type') {
    const rarityWeight: Record<string, number> = {
      legendary: 5,
      epic: 4,
      rare: 3,
      uncommon: 2,
      common: 1,
    };
    const slotWeight: Record<string, number> = {
      weapon: 1,
      shield: 2,
      helmet: 3,
      chest: 4,
      boots: 5,
      relic: 6,
      mount: 7,
      consumable: 8,
    };

    if (mode === 'rarity') {
      this.player.inventory.sort((a, b) => (rarityWeight[b.rarity] || 0) - (rarityWeight[a.rarity] || 0));
    } else if (mode === 'name') {
      this.player.inventory.sort((a, b) => a.name.localeCompare(b.name));
    } else if (mode === 'type') {
      this.player.inventory.sort((a, b) => (slotWeight[a.slot] || 99) - (slotWeight[b.slot] || 99));
    }

    soundSynth.playItemEquip();
  }


  // --- Companion Pet Subsystem ---
  public tamePet(pet: CompanionPet) {
    this.activePet = pet;

    // Apply pet stat buffs
    this.player.stats.attackPower += pet.bonusAttack;
    this.player.stats.moveSpeedMultiplier += pet.bonusSpeed / 100;
    this.player.recalculateStats();

    // Spawn 3D Mesh
    this.spawnPetMesh(pet);

    // Particles and sounds
    this.particleSystem.emit('beacon_activate', this.player.position, pet.color, 1.4);
    soundSynth.playQuestComplete();
    this.addFloatingText(`★ Pet Companion [${pet.name}] Bound! ★`, this.player.position.x, this.player.position.y + 2.8, pet.color, 'xl');
    this.addChatMessage('system', 'Beast Tamer', `Successfully bonded with companion pet [${pet.name}]! (+${pet.bonusAttack} Atk, +${pet.bonusSpeed}% Spd).`);

    this.progressQuests('tame_pet');
  }

  private spawnPetMesh(pet: CompanionPet) {
    if (this.petMeshGroup) {
      this.scene.remove(this.petMeshGroup);
      this.petMeshGroup = null;
    }

    const group = new THREE.Group();
    this.petPosition.set(this.player.position.x + 2, 0.3, this.player.position.z + 2);
    group.position.copy(this.petPosition);

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(pet.color),
      metalness: pet.species === 'clockwork_hound' ? 0.9 : 0.4,
      roughness: 0.3,
    });

    if (pet.species === 'aether_wisp') {
      const coreGeo = new THREE.SphereGeometry(0.4, 16, 16);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 2.0,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      group.add(core);

      const ringGeo = new THREE.TorusGeometry(0.7, 0.08, 8, 24);
      const ring = new THREE.Mesh(ringGeo, coreMat);
      ring.rotation.x = Math.PI / 3;
      group.add(ring);
    } else if (pet.species === 'clockwork_hound') {
      const bodyGeo = new THREE.BoxGeometry(0.8, 0.6, 1.2);
      const body = new THREE.Mesh(bodyGeo, mat);
      body.position.y = 0.5;
      group.add(body);

      const headGeo = new THREE.BoxGeometry(0.5, 0.45, 0.6);
      const head = new THREE.Mesh(headGeo, mat);
      head.position.set(0, 0.8, 0.6);
      group.add(head);

      const earL = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), mat);
      earL.position.set(-0.2, 1.1, 0.6);
      const earR = earL.clone();
      earR.position.x = 0.2;
      group.add(earL);
      group.add(earR);
    } else {
      // Drake / Gryphon miniature
      const bodyGeo = new THREE.ConeGeometry(0.5, 1.2, 6);
      bodyGeo.rotateX(Math.PI / 2);
      const body = new THREE.Mesh(bodyGeo, mat);
      body.position.y = 0.6;
      group.add(body);

      const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.4), mat);
      wingL.position.set(-0.6, 0.8, 0);
      wingL.rotation.z = Math.PI / 6;
      const wingR = wingL.clone();
      wingR.position.x = 0.6;
      wingR.rotation.z = -Math.PI / 6;
      group.add(wingL);
      group.add(wingR);
    }

    this.petMeshGroup = group;
    this.scene.add(group);
  }

  // --- Homestead House Subsystem ---
  public buildHomestead(blueprint: HomesteadBlueprint) {
    if (this.unlockedHouses.some((h) => h.id === blueprint.id)) return;
    this.unlockedHouses.push(blueprint);

    // Apply House Perks
    this.player.stats.maxHp += blueprint.tier === 1 ? 50 : blueprint.tier === 2 ? 150 : 300;
    this.player.stats.hp = this.player.stats.maxHp;
    this.player.recalculateStats();

    // Spawn 3D Architecture in the West Homestead district
    const houseGroup = new THREE.Group();
    const houseX = -26 - (this.unlockedHouses.length - 1) * 8;
    const houseZ = 16 + (this.unlockedHouses.length - 1) * 6;
    houseGroup.position.set(houseX, 0, houseZ);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
    const roofMat = new THREE.MeshStandardMaterial({ color: blueprint.tier === 3 ? 0x1e3a8a : 0x991b1b, roughness: 0.6 });

    // Foundation & Walls
    const wallGeo = new THREE.BoxGeometry(6, 4 + blueprint.tier * 1.5, 6);
    const walls = new THREE.Mesh(wallGeo, woodMat);
    walls.position.y = (4 + blueprint.tier * 1.5) / 2;
    houseGroup.add(walls);

    // Stone Base Trim
    const baseGeo = new THREE.BoxGeometry(6.4, 1.2, 6.4);
    const base = new THREE.Mesh(baseGeo, stoneMat);
    base.position.y = 0.6;
    houseGroup.add(base);

    // Roof
    const roofGeo = new THREE.ConeGeometry(5.2, 3.5, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 4 + blueprint.tier * 1.5 + 1.75;
    houseGroup.add(roof);

    // Chimney with steam smoke
    const chimneyGeo = new THREE.BoxGeometry(0.8, 4.0, 0.8);
    const chimney = new THREE.Mesh(chimneyGeo, stoneMat);
    chimney.position.set(2.0, 4 + blueprint.tier * 1.5, -1.5);
    houseGroup.add(chimney);

    this.particleSystem.registerSteamVent(houseX + 2.0, 4 + blueprint.tier * 1.5 + 2.0, houseZ - 1.5);

    this.houseMeshes.push(houseGroup);
    this.scene.add(houseGroup);

    // Particles and announcements
    this.particleSystem.emit('beacon_activate', houseGroup.position, '#eab308', 2.0);
    soundSynth.playQuestComplete();
    this.addFloatingText(`★ HOMESTEAD CONSTRUCTED: ${blueprint.name}! ★`, this.player.position.x, this.player.position.y + 3.2, '#eab308', 'xl');
    this.addChatMessage('system', 'Architect Silas', `Congratulations on building your [${blueprint.name}] in the West District! Perks unlocked.`);

    this.progressQuests('build_house');
  }

  // --- Admin / GM World Edit Tools ---
  public applyGMConfig(config: Partial<GMWorldConfig>) {
    this.gmConfig = { ...this.gmConfig, ...config };

    if (config.timeOfDay !== undefined) {
      const angle = ((this.gmConfig.timeOfDay - 6) / 24) * Math.PI * 2;
      this.sunLight.position.set(Math.cos(angle) * 90, Math.sin(angle) * 90, 60);
      const isNight = this.gmConfig.timeOfDay < 6 || this.gmConfig.timeOfDay > 19;
      this.sunLight.intensity = isNight ? 0.3 : 2.5;
      this.hemiLight.intensity = isNight ? 0.6 : 1.6;
    }

    if (config.weatherState) {
      if (config.weatherState === 'blood_moon') {
        this.scene.background = new THREE.Color(0x2a0808);
        this.sunLight.color = new THREE.Color(0xef4444);
      } else if (config.weatherState === 'aether_aurora') {
        this.scene.background = new THREE.Color(0x042f2e);
        this.sunLight.color = new THREE.Color(0x2dd4bf);
      } else if (config.weatherState === 'void_storm') {
        this.scene.background = new THREE.Color(0x1e1035);
        this.sunLight.color = new THREE.Color(0xa855f7);
      } else {
        this.scene.background = new THREE.Color(0x1e293b);
        this.sunLight.color = new THREE.Color(0xfffbeb);
      }
    }

    if (this.gmConfig.godMode) {
      this.player.stats.hp = this.player.stats.maxHp;
      this.player.stats.resource = this.player.stats.maxResource;
    }

    if (this.gmConfig.infiniteResources) {
      this.player.stats.gold = Math.max(this.player.stats.gold, 999999);
    }

    this.addFloatingText('GM World Configuration Updated', this.player.position.x, this.player.position.y + 2.0, '#38bdf8', 'md');
  }

  public spawnCustomMob(type: WorldMobEntity['type'], x?: number, z?: number) {
    const spawnX = x !== undefined ? x : this.player.position.x + (Math.random() - 0.5) * 10;
    const spawnZ = z !== undefined ? z : this.player.position.z + (Math.random() - 0.5) * 10;

    this.mobManager.spawnCustomMob(type, spawnX, spawnZ);
    this.particleSystem.emit('teleport_warp', { x: spawnX, y: 1.0, z: spawnZ }, '#a855f7', 1.5);
    this.addFloatingText(`GM Spawned [${type.toUpperCase()}]`, spawnX, 2.5, '#a855f7', 'lg');
  }

  public equipItem(item: RPGItem): RPGItem | null {
    const prev = this.player.equipItem(item);
    this.player.observeEquipmentState();
    return prev;
  }

  public unequipItem(slotName: string): RPGItem | null {
    const unequipped = this.player.unequipSlot(slotName as any);
    this.player.observeEquipmentState();
    return unequipped;
  }

  /**
   * Authoritative player death handler:
   * Resets all aggroed mobs directly to their fight start point on the map, restores their health,
   * hides aggro lines, and respawns the hero at Sanctum Plaza.
   */
  public handlePlayerDeath(): void {
    this.addFloatingText('💀 DEFEATED - Respawning at Sanctum...', this.player.position.x, this.player.position.y + 2.5, '#ef4444', 'xl');

    // Trigger authoritative aggro wipe and reset mobs to their fight start point
    const resetMobs = this.mobManager.handlePlayerDeath('hero_player_1');

    // Respawn hero at open city hub plaza
    this.player.position.set(0, 0, 8.0);
    this.player.stats.hp = this.player.stats.maxHp;
    this.player.isMoving = false;
    this.player.isAttacking = false;

    if (resetMobs.length > 0) {
      this.addFloatingText(`↺ ${resetMobs.length} Monster zum Startpunkt zurückgekehrt`, 0, 3.0, '#00f0ff', 'lg');
      this.addChatMessage(
        'system',
        'Aggro-Reset',
        `💀 [Held gefallen] ${resetMobs.length} Monster haben Aggro verloren und sind direkt zu ihrem Kampf-Startpunkt auf der Karte zurückgekehrt.`
      );
    }
  }

  /**
   * Taunt target or nearby mobs (Hotkeyed to 'T')
   */
  public tauntTarget(): void {
    if (this.targetMob) {
      this.mobManager.tauntMob(this.targetMob.id, 'hero_player_1', 'Hero Player');
      soundSynth.playHitSound();
      this.particleSystem.emit('beacon_activate', { x: this.targetMob.x, y: 1.0, z: this.targetMob.z }, '#fbbf24', 1.6);
      this.addFloatingText('⚔️ TAUNT! (Aggro gezogen)', this.targetMob.x, this.targetMob.y + 2.4, '#fbbf24', 'xl');
      this.addChatMessage('system', 'Spott', `[Spott] Du hast ${this.targetMob.name} verspottet! Bedrohung auf 125% des Spitzenwerts gesetzt.`);
    } else {
      const taunted = this.mobManager.tauntNearbyMobs('hero_player_1', this.player.position.x, this.player.position.z, 20.0, 'Hero Player');
      if (taunted.length > 0) {
        soundSynth.playHitSound();
        this.particleSystem.emit('beacon_activate', this.player.position, '#fbbf24', 1.8);
        this.addFloatingText(`⚔️ TAUNT! ${taunted.length} Monster verspottet`, this.player.position.x, this.player.position.y + 2.6, '#fbbf24', 'xl');
        this.addChatMessage('system', 'Flächenspott', `[Spott] ${taunted.length} Monster im Umkreis von 20m verspottet!`);
      } else {
        this.addFloatingText('Kein Ziel in Reichweite für Spott (T)', this.player.position.x, this.player.position.y + 2.0, '#94a3b8', 'md');
      }
    }
  }

  public observePlayerEquipment(callback: (equipment: EquipmentState) => void): () => void {
    return this.player.addEquipmentListener(callback);
  }

  public triggerDeterministicZoneTransition(): void {
    if (!this.player) return;
    const playerPos = this.player.position;
    const currentTick = this.fixedLoop.getMetrics().currentTick;
    const requestId = `trans_req_${currentTick}_${Date.now()}`;
    const res = aurionTransitionRuntime.requestTransition({
      playerId: 'hero_player_1',
      requestId,
      sequenceId: currentTick + 1,
      acceptedAtTick: currentTick,
      playerPosition: { x: playerPos.x, y: playerPos.z },
    });

    if (res.ok) {
      this.particleSystem.emit('beacon_activate', this.player.position, '#00f0ff', 2.5);
      soundSynth.playLevelUp();
      this.addFloatingText('🌀 DETERMINISTIC PORTAL QUEUED', playerPos.x, playerPos.y + 2.8, '#00f0ff', 'xl');
      this.addChatMessage('system', 'Gatekeeper', `Portal activation queued for deterministic tick resolution (Sequence #${currentTick + 1}).`);
    } else {
      this.addFloatingText(`Portal Error: ${res.code}`, playerPos.x, playerPos.y + 2.0, '#ef4444', 'md');
    }
  }

  public compileCityLayout(sector = 0) {
    const npcs = this.npcEconomy.npcs.map((npc) => ({
      id: `npc_${npc.id}`,
      type: 'building',
      role: 'forge',
      position: { x: npc.x, y: npc.z, z: 0 },
    }));
    return cityLayoutCompiler.compileSector(npcs, sector);
  }

  public queueUserCommand(
    actionType: UserActionType,
    payload: TimestampedActionPayload,
    forcedTargetTick?: number
  ): TimestampedUserCommand {
    const currentTick = this.fixedLoop.getMetrics().currentTick;
    return timestampedInputBuffer.enqueueCommand(
      'hero_player_1',
      actionType,
      payload,
      currentTick,
      forcedTargetTick
    );
  }

  public executeBufferedCommand(cmd: TimestampedUserCommand): void {
    if (!this.player) return;
    switch (cmd.actionType) {
      case 'CAST_SPELL': {
        const payload = cmd.payload as { skillIndex?: number };
        if (payload && typeof payload.skillIndex === 'number') {
          this.castClassSkill(payload.skillIndex, true);
        }
        break;
      }
      case 'DODGE_ROLL': {
        this.triggerPlayerDodge(true);
        break;
      }
      case 'ZONE_TRANSITION': {
        this.triggerDeterministicZoneTransition();
        break;
      }
      case 'INTERACT': {
        this.interactNearby();
        break;
      }
      case 'USE_ITEM': {
        const payload = cmd.payload as { itemId?: string };
        if (payload?.itemId) {
          const item = this.player.inventory.find((i) => i.id === payload.itemId);
          if (item) {
            this.equipItem(item);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  public getInputBufferStats() {
    const currentTick = this.fixedLoop.getMetrics().currentTick;
    return timestampedInputBuffer.getStats(currentTick);
  }

  private handleResize = () => {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth || 1280;
    const height = this.container.clientHeight || window.innerHeight || 720;
    if (height <= 0 || width <= 0) return;
    const aspect = width / height;
    if (!isFinite(aspect) || isNaN(aspect) || aspect <= 0) return;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };
}
