import * as THREE from 'three';
import { collisionSystem } from '../world/WorldCollisionSystem';
import { ArmorType, ArmorMastery,
  CharacterAttributes,
  CharacterClassId,
  ClassSkill,
  EquipmentState,
  MilestoneWeaponSkill,
  PlayerStats,
  RPGItem,
  WeaponMastery,
  WeaponType,
} from '../types';
import { DEFAULT_WEAPON_MASTERIES, DEFAULT_ARMOR_MASTERIES, MMORPG_CLASSES, RPG_ITEMS_DATABASE } from '../data/mmorpgData';
import { WEAPON_MASTERY_PERKS, ATTRIBUTE_BREAKPOINTS } from '../data/combatProgressionData';
import { glbManager, GLBModelEntry } from '../core/GLBModelManager';
import { ProceduralEquipmentVisuals } from '../core/ProceduralEquipmentVisuals';
import { AscensionSystem } from '../engine/ascension/AscensionSystem';

export class OpenWorldPlayer {
  public scene: THREE.Scene;
  public group: THREE.Group;
  public currentClassId: CharacterClassId = 'knight';
  public proceduralVisuals: ProceduralEquipmentVisuals = new ProceduralEquipmentVisuals();

  // --- Articulated 3D Visual Model Hierarchy ---
  public rootGroup: THREE.Group;
  public pelvisGroup: THREE.Group;
  public torsoGroup: THREE.Group;
  public headGroup: THREE.Group;

  // Limbs & Joints
  public leftHipPivot: THREE.Group;
  public leftKneePivot: THREE.Group;
  public leftFootMesh: THREE.Mesh | null = null;

  public rightHipPivot: THREE.Group;
  public rightKneePivot: THREE.Group;
  public rightFootMesh: THREE.Mesh | null = null;

  public leftShoulderPivot: THREE.Group;
  public rightShoulderPivot: THREE.Group;
  public leftArmPivot: THREE.Group;
  public leftForearmPivot: THREE.Group;
  public offhandMesh: THREE.Group;

  public rightArmPivot: THREE.Group;
  public rightForearmPivot: THREE.Group;
  public weaponPivot: THREE.Group;
  public weaponMesh: THREE.Group;

  // Mount & Combat FX
  private mountMesh: THREE.Group;
  private mountLegs: THREE.Mesh[] = [];
  private gallopPhase: number = 0;
  private shieldBubble: THREE.Mesh;
  private classAura: THREE.Points;
  private spellGlyphRing: THREE.Mesh;
  private buffShockwaveRing: THREE.Mesh;

  // --- Kinematics & Animation State ---
  public walkCyclePhase: number = 0;
  public idleTime: number = 0;
  public isAttacking: boolean = false;
  public attackAnimTimer: number = 0;
  public attackAnimDuration: number = 0.55;
  public activeAttackType: 'melee' | 'projectile' | 'aoe' | 'buff' | 'utility' | 'turret' = 'melee';
  public weaponSlashTrail: THREE.Mesh | null = null;
  public isDodging: boolean = false;
  public dodgeTimer: number = 0;

  // --- Active Dodge-Roll Mechanics & I-Frames ---
  public isDodgeRolling: boolean = false;
  public dodgeRollTimer: number = 0;
  public iFrameTimer: number = 0;
  public dodgeCooldownTimer: number = 0;
  public dodgeDirection: THREE.Vector3 = new THREE.Vector3(0, 0, 1);

  // --- Action Buffering & Skill Queuing ---
  public bufferedSkillIndex: number | null = null;
  public bufferTimer: number = 0;

  // --- Bulwark Aegis (Defense 75 Breakpoint) ---
  public bulwarkShieldActive: boolean = false;
  public bulwarkShieldAmount: number = 0;
  public bulwarkShieldCooldown: number = 0;

  // --- Open Classless Progression & Stats ---
  public stats: PlayerStats;
  public equipment: EquipmentState;
  public inventory: RPGItem[] = [];

  // Physics & Movement
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 8.0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public facingAngle: number = Math.PI;
  public targetAngle: number = Math.PI;
  public isMoving: boolean = false;
  public baseMoveSpeed: number = 9.5;

  // Active Buffs
  public isShieldActive: boolean = false;
  public shieldTimer: number = 0;
  public buffAttackMultiplier: number = 1.0;
  public buffSpeedMultiplier: number = 1.0;
  public buffTimer: number = 0;

  // Equipment Observer & Real-time Visual Pipeline
  private lastEquipmentSignature: Record<string, string | null> = {};
  private equipmentListeners: Array<(equipment: EquipmentState) => void> = [];

  // External GLB Avatar Support
  public glbAvatarGroup: THREE.Group = new THREE.Group();
  public activeGlbModelId: string | null = null;
  private glbMixer: THREE.AnimationMixer | null = null;
  private activeGlbAction: THREE.AnimationAction | null = null;

  constructor(scene: THREE.Scene, startingClass: CharacterClassId = 'knight') {
    this.scene = scene;
    this.group = new THREE.Group();
    this.currentClassId = startingClass;

    const classDef = MMORPG_CLASSES[startingClass];
    const initialMasteries: Record<WeaponType, WeaponMastery> = JSON.parse(
      JSON.stringify(DEFAULT_WEAPON_MASTERIES)
    );

    // Initial RuneScape-style Attributes & Stats
    const initialAttributes: CharacterAttributes = {
      strength: 10,
      agility: 10,
      intelligence: 10,
      defense: 10,
    };

    this.stats = {
      hp: classDef.baseHp,
      maxHp: classDef.baseHp,
      resource: classDef.baseResource,
      maxResource: classDef.baseResource,
      resourceName: classDef.resourceName,
      resourceColor: classDef.resourceColor,
      level: 1,
      xp: 0,
      maxXp: 100,
      xpToNextLevel: 100,
      gold: 50,
      attackPower: classDef.baseAttack,
      spellPower: classDef.baseSpellPower,
      armor: classDef.baseArmor,
      critChance: 10,
      dodgeChance: 6,
      moveSpeed: 100,
      moveSpeedMultiplier: 1.0,
      isMounted: false,
      activeMountName: 'Clockwork Brass Stallion',
      score: 0,
      kills: 0,
      bossKills: 0,
      currentZone: 'Aethelgard Sanctum',
      x: 0,
      y: 0,
      z: 8,
      statPoints: 3, // Start with 3 free stat points for immediate customization!
      attributes: initialAttributes,
      activeWeaponType: 'blade',
      weaponMasteries: initialMasteries, armorMasteries: DEFAULT_ARMOR_MASTERIES,
      equippedSkills: [...classDef.skills],
      unlockedMilestoneSkills: [],
      totalMasteryLevel: 4,
      politicsLevel: 1,
      politicsXp: 0,
      ascensionLevel: 0,
      ascensionXp: 0,
      ascensionMaxXp: 10000,
      ascensionPoints: 0,
      ascensionTalents: {},
      prestigeTitle: 'Aspirant',
    };

    // Initial Modular Equipment Slots
    this.equipment = {
      weapon: RPG_ITEMS_DATABASE.find((i) => i.id === 'item_sword_starter') || null,
      shield: RPG_ITEMS_DATABASE.find((i) => i.id === 'item_shield_starter') || null,
      helmet: RPG_ITEMS_DATABASE.find((i) => i.id === 'item_helm_starter') || null,
      shoulders: RPG_ITEMS_DATABASE.find((i) => i.id === 'item_shoulder_starter') || null,
      chest: RPG_ITEMS_DATABASE.find((i) => i.id === 'item_chest_starter') || null,
      arms: RPG_ITEMS_DATABASE.find((i) => i.id === 'item_arms_starter') || null,
      legs: RPG_ITEMS_DATABASE.find((i) => i.id === 'item_legs_starter') || null,
      boots: RPG_ITEMS_DATABASE.find((i) => i.id === 'item_boots_starter') || null,
      cape: null,
      relic: null,
      mount: RPG_ITEMS_DATABASE.find((i) => i.id === 'item_mount_horse') || null,
    };

    // Initial Bag Inventory
    this.inventory = [
      RPG_ITEMS_DATABASE.find((i) => i.id === 'item_helm_rare') || RPG_ITEMS_DATABASE.find((i) => i.id === 'item_sword_rare')!,
      RPG_ITEMS_DATABASE.find((i) => i.id === 'item_shoulder_rare') || RPG_ITEMS_DATABASE.find((i) => i.id === 'item_sword_rare')!,
      RPG_ITEMS_DATABASE.find((i) => i.id === 'item_chest_epic') || RPG_ITEMS_DATABASE.find((i) => i.id === 'item_staff_starter')!,
      RPG_ITEMS_DATABASE.find((i) => i.id === 'item_arms_rare') || RPG_ITEMS_DATABASE.find((i) => i.id === 'item_bow_starter')!,
      RPG_ITEMS_DATABASE.find((i) => i.id === 'item_legs_rare') || RPG_ITEMS_DATABASE.find((i) => i.id === 'item_cannon_starter')!,
      RPG_ITEMS_DATABASE.find((i) => i.id === 'item_boots_rare') || RPG_ITEMS_DATABASE.find((i) => i.id === 'item_potion_hp')!,
      RPG_ITEMS_DATABASE.find((i) => i.id === 'item_katana_epic') || RPG_ITEMS_DATABASE.find((i) => i.id === 'item_sword_rare')!,
      RPG_ITEMS_DATABASE.find((i) => i.id === 'item_staff_epic') || RPG_ITEMS_DATABASE.find((i) => i.id === 'item_potion_hp')!,
      RPG_ITEMS_DATABASE.find((i) => i.id === 'item_potion_hp')!,
      RPG_ITEMS_DATABASE.find((i) => i.id === 'item_potion_elixir')!,
    ].filter(Boolean) as RPGItem[];

    // Build Rig Structure
    this.rootGroup = new THREE.Group();
    this.pelvisGroup = new THREE.Group();
    this.torsoGroup = new THREE.Group();
    this.headGroup = new THREE.Group();

    this.leftHipPivot = new THREE.Group();
    this.leftKneePivot = new THREE.Group();
    this.rightHipPivot = new THREE.Group();
    this.rightKneePivot = new THREE.Group();

    this.leftShoulderPivot = new THREE.Group();
    this.rightShoulderPivot = new THREE.Group();
    this.leftArmPivot = new THREE.Group();
    this.leftForearmPivot = new THREE.Group();
    this.offhandMesh = new THREE.Group();

    this.rightArmPivot = new THREE.Group();
    this.rightForearmPivot = new THREE.Group();
    this.weaponPivot = new THREE.Group();
    this.weaponMesh = new THREE.Group();

    this.mountMesh = new THREE.Group();

    // Assemble Skeletal Tree
    this.group.add(this.rootGroup);
    this.rootGroup.add(this.pelvisGroup);
    this.rootGroup.add(this.mountMesh);

    this.pelvisGroup.add(this.torsoGroup);
    this.pelvisGroup.add(this.leftHipPivot);
    this.pelvisGroup.add(this.rightHipPivot);

    this.torsoGroup.add(this.headGroup);
    this.torsoGroup.add(this.leftShoulderPivot);
    this.torsoGroup.add(this.rightShoulderPivot);
    this.torsoGroup.add(this.leftArmPivot);
    this.torsoGroup.add(this.rightArmPivot);

    this.leftHipPivot.add(this.leftKneePivot);
    this.rightHipPivot.add(this.rightKneePivot);

    this.leftArmPivot.add(this.leftForearmPivot);
    this.leftForearmPivot.add(this.offhandMesh);

    this.rightArmPivot.add(this.rightForearmPivot);
    this.rightForearmPivot.add(this.weaponPivot);
    this.weaponPivot.add(this.weaponMesh);

    // Build Shield Bubble
    const shieldGeo = new THREE.SphereGeometry(2.4, 24, 24);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x00f2ff,
      emissive: 0x00bcd4,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.0,
      wireframe: true,
    });
    this.shieldBubble = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldBubble.position.set(0, 1.4, 0);
    this.group.add(this.shieldBubble);

    // Spell Glyph Ground Circle (for spellcasting animation)
    const glyphGeo = new THREE.RingGeometry(1.2, 1.9, 32);
    glyphGeo.rotateX(-Math.PI / 2);
    const glyphMat = new THREE.MeshBasicMaterial({
      color: 0x00f2ff,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
    });
    this.spellGlyphRing = new THREE.Mesh(glyphGeo, glyphMat);
    this.spellGlyphRing.position.set(0, 0.05, 0);
    this.group.add(this.spellGlyphRing);

    // Buff Shockwave Ring (for buff/shout animation)
    const shockwaveGeo = new THREE.RingGeometry(0.5, 1.2, 32);
    shockwaveGeo.rotateX(-Math.PI / 2);
    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
    });
    this.buffShockwaveRing = new THREE.Mesh(shockwaveGeo, shockwaveMat);
    this.buffShockwaveRing.position.set(0, 0.08, 0);
    this.group.add(this.buffShockwaveRing);

    // Class Aura Particles
    const auraGeo = new THREE.BufferGeometry();
    const auraCount = 24;
    const auraPositions = new Float32Array(auraCount * 3);
    for (let i = 0; i < auraCount * 3; i += 3) {
      auraPositions[i] = (Math.random() - 0.5) * 1.6;
      auraPositions[i + 1] = Math.random() * 2.3;
      auraPositions[i + 2] = (Math.random() - 0.5) * 1.6;
    }
    auraGeo.setAttribute('position', new THREE.BufferAttribute(auraPositions, 3));
    const auraMat = new THREE.PointsMaterial({
      color: new THREE.Color(classDef.color),
      size: 0.25,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    this.classAura = new THREE.Points(auraGeo, auraMat);
    this.group.add(this.classAura);

    // External GLB Avatar Mount Group
    this.group.add(this.glbAvatarGroup);

    // Construct Rigged Visual Meshes
    this.buildCharacterMesh();
    this.buildMountModel();

    this.group.position.copy(this.position);
    this.group.rotation.y = this.facingAngle;

    this.scene.add(this.group);
    this.recalculateStats();
  }

  // --- RuneScape-Style Stat Point Allocation Engine ---
  public allocateStatPoint(attribute: keyof CharacterAttributes): { success: boolean; message: string } {
    if (this.stats.statPoints <= 0) {
      return { success: false, message: 'No attribute points available! Level up weapon masteries to earn more.' };
    }

    this.stats.statPoints -= 1;
    this.stats.attributes[attribute] += 1;
    this.recalculateStats();

    const attrNames: Record<keyof CharacterAttributes, string> = {
      strength: 'Strength (Damage & Crit Bonus)',
      agility: 'Agility (Attack Speed & Dodge)',
      intelligence: 'Intelligence (Mana & Spell Power)',
      defense: 'Defense (Armor & Max HP)',
    };

    return {
      success: true,
      message: `Allocated +1 Point to ${attrNames[attribute]}! (Total: ${this.stats.attributes[attribute]})`,
    };
  }

  // --- Milestone Weapon Skill Unlocking Engine (10 Gold at Level 10, 20, 30, 40) ---
  public unlockMilestoneSkill(skillId: string): { success: boolean; message: string; skill?: MilestoneWeaponSkill } {
    if (this.stats.unlockedMilestoneSkills.includes(skillId)) {
      return { success: false, message: 'This skill is already unlocked!' };
    }

    // Find the skill across all weapon masteries
    let foundSkill: MilestoneWeaponSkill | undefined;
    for (const mastery of Object.values(this.stats.weaponMasteries)) {
      const match = mastery.milestoneSkills?.find((s) => s.id === skillId);
      if (match) {
        foundSkill = match;
        break;
      }
    }

    if (!foundSkill) {
      return { success: false, message: 'Skill not found in the mastery grimoire.' };
    }

    const currentMastery = this.stats.weaponMasteries[foundSkill.weaponType];
    if (currentMastery.level < foundSkill.requiredMasteryLevel) {
      return {
        success: false,
        message: `Requires ${currentMastery.name} Level ${foundSkill.requiredMasteryLevel} (Current: Level ${currentMastery.level}).`,
      };
    }

    if (this.stats.gold < foundSkill.unlockCostGold) {
      return {
        success: false,
        message: `Not enough gold! Unlocking requires ${foundSkill.unlockCostGold} 🪙 Gold (You have ${this.stats.gold} 🪙).`,
      };
    }

    // Deduct Gold and Unlock
    this.stats.gold -= foundSkill.unlockCostGold;
    this.stats.unlockedMilestoneSkills.push(skillId);

    return {
      success: true,
      message: `Unlocked "${foundSkill.name}" for ${foundSkill.unlockCostGold} 🪙! You can now equip it to your action bar.`,
      skill: foundSkill,
    };
  }

  public allocateMasteryPerk(weaponType: WeaponType, perkId: string): { success: boolean; message: string } {
    const mastery = this.stats.weaponMasteries[weaponType];
    if (!mastery) return { success: false, message: 'Weapon mastery not found.' };

    if (!mastery.allocatedPerks) mastery.allocatedPerks = [];
    if (mastery.allocatedPerks.includes(perkId)) {
      return { success: false, message: 'This perk is already unlocked.' };
    }

    if ((mastery.perkPoints || 0) <= 0) {
      return {
        success: false,
        message: 'No perk points available for this mastery! Earn more by reaching ranks 5, 10, 15, 20, 25, 30.',
      };
    }

    const available = mastery.availablePerks || WEAPON_MASTERY_PERKS[weaponType] || [];
    const perk = available.find((p) => p.id === perkId);
    if (!perk) return { success: false, message: 'Perk definition not found.' };

    if (mastery.level < perk.requiredMasteryLevel) {
      return {
        success: false,
        message: `Requires ${mastery.name} Rank ${perk.requiredMasteryLevel} (Current: ${mastery.level}).`,
      };
    }

    mastery.perkPoints -= 1;
    mastery.allocatedPerks.push(perkId);
    this.recalculateStats();

    return {
      success: true,
      message: `Mastery Perk "${perk.name}" activated! ${perk.description}`,
    };
  }

  // --- Open Classless Progression Engine ---
  public getActiveWeaponType(): WeaponType {
    if (this.equipment.weapon && this.equipment.weapon.weaponType) {
      return this.equipment.weapon.weaponType;
    }
    return this.stats.activeWeaponType || 'blade';
  }

  public gainWeaponMasteryXp(
    type: WeaponType,
    amount: number
  ): { leveledUp: boolean; newLevel: number; mastery: WeaponMastery } {
    const mastery = this.stats.weaponMasteries[type];
    if (!mastery) return { leveledUp: false, newLevel: 1, mastery: this.stats.weaponMasteries.blade };

    mastery.xp += amount;
    let leveledUp = false;

    while (mastery.xp >= mastery.maxXp) {
      mastery.xp -= mastery.maxXp;
      mastery.level += 1;
      mastery.maxXp = Math.round(mastery.maxXp * 1.45);
      leveledUp = true;

      this.stats.statPoints += 1;

      // Award 1 Perk Point every 5 ranks (Rank 5, 10, 15, 20, 25, 30)
      if (mastery.level % 5 === 0 && mastery.level <= 30) {
        mastery.perkPoints = (mastery.perkPoints || 0) + 1;
      }

      if (mastery.level % 10 === 0) {
        if (mastery.bonusStats.attack !== undefined) mastery.bonusStats.attack += 10;
        if (mastery.bonusStats.critChance !== undefined) mastery.bonusStats.critChance += 0.10;
      } else {
        if (mastery.bonusStats.attack !== undefined) mastery.bonusStats.attack += 2;
      }
      this.stats.totalMasteryLevel += 1;
    }
    if (leveledUp) this.recalculateStats();
    return { leveledUp, newLevel: mastery.level, mastery };
  }


  
  public gainArmorMasteryXp(
    type: ArmorType,
    amount: number
  ): { leveledUp: boolean; newLevel: number; mastery: ArmorMastery } {
    const mastery = this.stats.armorMasteries[type];
    if (!mastery) return { leveledUp: false, newLevel: 1, mastery: this.stats.armorMasteries.chest };

    mastery.xp += amount;
    let leveledUp = false;

    while (mastery.xp >= mastery.maxXp) {
      mastery.xp -= mastery.maxXp;
      mastery.level += 1;
      mastery.maxXp = Math.round(mastery.maxXp * 1.45);
      leveledUp = true;

      this.stats.statPoints += 1;

      if (mastery.level % 10 === 0) {
          mastery.bonusStats.armor += 5; 
          mastery.bonusStats.health += 50;
          mastery.bonusStats.dodgeChance += 0.1;
      } else {
          mastery.bonusStats.armor += 1;
          mastery.bonusStats.health += 10;
      }
      this.stats.totalMasteryLevel += 1;
    }
    if (leveledUp) this.recalculateStats();
    return { leveledUp, newLevel: mastery.level, mastery };
  }


  public equipSkillToHotbar(slotIndex: number, skill: ClassSkill) {
    if (slotIndex >= 0 && slotIndex < 5) {
      this.stats.equippedSkills[slotIndex] = { ...skill, keybind: String(slotIndex + 1) };
    }
  }

  public setClass(classId: CharacterClassId) {
    this.currentClassId = classId;
    const def = MMORPG_CLASSES[classId];
    this.stats.resourceName = def.resourceName;
    this.stats.resourceColor = def.resourceColor;
    this.stats.equippedSkills = [...def.skills];
    this.buildCharacterMesh();
    this.recalculateStats();
  }

  // --- Dynamic 3D Character Construction (Head, Arms, Shoulders, Chest, Legs, Boots, Weapon, Offhand) ---
  public buildCharacterMesh() {
    // Clear old visual meshes while strictly preserving structural bone pivots
    this.clearVisualMeshes(this.torsoGroup, [
      this.headGroup,
      this.leftShoulderPivot,
      this.rightShoulderPivot,
      this.leftArmPivot,
      this.rightArmPivot,
    ]);
    this.clearVisualMeshes(this.headGroup);
    this.clearVisualMeshes(this.leftShoulderPivot);
    this.clearVisualMeshes(this.rightShoulderPivot);
    this.clearVisualMeshes(this.leftHipPivot, [this.leftKneePivot]);
    this.clearVisualMeshes(this.rightHipPivot, [this.rightKneePivot]);
    this.clearVisualMeshes(this.leftKneePivot);
    this.clearVisualMeshes(this.rightKneePivot);
    this.clearVisualMeshes(this.leftArmPivot, [this.leftForearmPivot]);
    this.clearVisualMeshes(this.rightArmPivot, [this.rightForearmPivot]);
    this.clearVisualMeshes(this.leftForearmPivot, [this.offhandMesh]);
    this.clearVisualMeshes(this.rightForearmPivot, [this.weaponPivot]);
    this.clearVisualMeshes(this.weaponPivot, [this.weaponMesh]);
    this.clearVisualMeshes(this.weaponMesh);
    this.clearVisualMeshes(this.offhandMesh);

    // 100% guarantee structural skeletal graph hierarchy connection
    if (this.rootGroup.parent !== this.group) this.group.add(this.rootGroup);
    if (this.pelvisGroup.parent !== this.rootGroup) this.rootGroup.add(this.pelvisGroup);
    if (this.mountMesh.parent !== this.rootGroup) this.rootGroup.add(this.mountMesh);

    if (this.torsoGroup.parent !== this.pelvisGroup) this.pelvisGroup.add(this.torsoGroup);
    if (this.leftHipPivot.parent !== this.pelvisGroup) this.pelvisGroup.add(this.leftHipPivot);
    if (this.rightHipPivot.parent !== this.pelvisGroup) this.pelvisGroup.add(this.rightHipPivot);

    if (this.headGroup.parent !== this.torsoGroup) this.torsoGroup.add(this.headGroup);
    if (this.leftShoulderPivot.parent !== this.torsoGroup) this.torsoGroup.add(this.leftShoulderPivot);
    if (this.rightShoulderPivot.parent !== this.torsoGroup) this.torsoGroup.add(this.rightShoulderPivot);
    if (this.leftArmPivot.parent !== this.torsoGroup) this.torsoGroup.add(this.leftArmPivot);
    if (this.rightArmPivot.parent !== this.torsoGroup) this.torsoGroup.add(this.rightArmPivot);

    if (this.leftKneePivot.parent !== this.leftHipPivot) this.leftHipPivot.add(this.leftKneePivot);
    if (this.rightKneePivot.parent !== this.rightHipPivot) this.rightHipPivot.add(this.rightKneePivot);

    if (this.leftForearmPivot.parent !== this.leftArmPivot) this.leftArmPivot.add(this.leftForearmPivot);
    if (this.offhandMesh.parent !== this.leftForearmPivot) this.leftForearmPivot.add(this.offhandMesh);

    if (this.rightForearmPivot.parent !== this.rightArmPivot) this.rightArmPivot.add(this.rightForearmPivot);
    if (this.weaponPivot.parent !== this.rightForearmPivot) this.rightForearmPivot.add(this.weaponPivot);
    if (this.weaponMesh.parent !== this.weaponPivot) this.weaponPivot.add(this.weaponMesh);

    // Anatomical hierarchy positions
    this.pelvisGroup.position.set(0, 0.95, 0);
    this.torsoGroup.position.set(0, 0.15, 0);
    this.headGroup.position.set(0, 0.94, 0.04);

    this.leftShoulderPivot.position.set(-0.52, 0.72, 0);
    this.rightShoulderPivot.position.set(0.52, 0.72, 0);

    this.leftHipPivot.position.set(-0.25, 0, 0);
    this.rightHipPivot.position.set(0.25, 0, 0);

    this.leftKneePivot.position.set(0, -0.48, 0);
    this.rightKneePivot.position.set(0, -0.48, 0);

    this.leftArmPivot.position.set(-0.52, 0.68, 0);
    this.rightArmPivot.position.set(0.52, 0.68, 0);

    this.leftForearmPivot.position.set(0, -0.38, 0);
    this.rightForearmPivot.position.set(0, -0.38, 0);

    this.weaponPivot.position.set(0, -0.28, 0.1);

    const activeWep = this.getActiveWeaponType();
    const classDef = MMORPG_CLASSES[this.currentClassId];

    // Rich Aesthetic Materials
    const bronzeArmorMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.85,
      roughness: 0.28,
    });
    const steelArmorMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.9,
      roughness: 0.25,
    });
    const darkLeatherMat = new THREE.MeshStandardMaterial({
      color: 0x292524,
      roughness: 0.75,
    });
    const clothMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.85,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.5,
    });
    const aetherGlowMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(classDef.color || 0x00f2ff),
      emissive: new THREE.Color(classDef.color || 0x00f2ff),
      emissiveIntensity: 1.6,
    });
    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.2,
    });

    // Resolve equipped items across all 8 slots (supporting both standard names and aliases)
    const equippedHelmet = this.equipment.helmet || (this.equipment as any).head || null;
    const equippedShoulders = this.equipment.shoulders || null;
    const equippedChest = this.equipment.chest || null;
    const equippedArms = this.equipment.arms || null;
    const equippedLegs = this.equipment.legs || null;
    const equippedBoots = this.equipment.boots || (this.equipment as any).shoes || null;
    const equippedWeapon = this.equipment.weapon || null;
    const equippedOffhand = this.equipment.shield || (this.equipment as any).offhand || null;

    // Clear procedural animated nodes for fresh attachments
    this.proceduralVisuals.clearAnimatedNodes();

    // 1. HEAD & HELMET (Kopf)
    this.buildHeadAndHelmet(equippedHelmet, skinMat, bronzeArmorMat, steelArmorMat, aetherGlowMat, goldTrimMat);

    // 2. SHOULDERS (Schultern)
    this.buildShoulders(equippedShoulders);

    // 3. TORSO & CHESTPLATE (Brust)
    this.buildTorsoAndChest(equippedChest);

    // 4. ARMS & GAUNTLETS (Arme & Hände)
    this.buildArmsAndGauntlets(equippedArms, skinMat);

    // 5. LEGS & GREAVES (Beine)
    this.buildLegsAndPants(equippedLegs);

    // 6. FEET & BOOTS (Schuhe)
    this.buildFeetAndBoots(equippedBoots);

    // 7. WEAPON (Waffe)
    this.buildWeaponMesh(activeWep, equippedWeapon);

    // 8. OFFHAND (Nebenhand)
    this.buildOffhandMesh(equippedOffhand, activeWep);
  }

  // === 1. HEAD & HELMET BUILDER ===
  private buildHeadAndHelmet(
    helmet: RPGItem | null,
    skinMat: THREE.Material,
    bronzeMat: THREE.Material,
    steelMat: THREE.Material,
    glowMat: THREE.Material,
    goldMat: THREE.Material
  ) {
    // Anatomical Neck & Armor Collar (attached to torsoGroup)
    const neckGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.24, 10);
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.position.set(0, 0.80, 0.02);
    this.torsoGroup.add(neckMesh);

    const gorgetGeo = new THREE.TorusGeometry(0.19, 0.04, 6, 16);
    const gorgetMesh = new THREE.Mesh(gorgetGeo, bronzeMat);
    gorgetMesh.rotation.x = Math.PI / 2;
    gorgetMesh.position.set(0, 0.74, 0.02);
    this.torsoGroup.add(gorgetMesh);

    // Base Cranium & Head Shape - Stylized octagonal cranium
    const headGeo = new THREE.CylinderGeometry(0.20, 0.18, 0.40, 8);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.position.set(0, 0.02, 0.02);
    this.headGroup.add(headMesh);

    // Sculpted Jaw & Chin
    const jawGeo = new THREE.BoxGeometry(0.26, 0.14, 0.18);
    const jawMesh = new THREE.Mesh(jawGeo, skinMat);
    jawMesh.position.set(0, -0.14, 0.12);
    this.headGroup.add(jawMesh);

    // Piercing Aurion-Türkis Glowing Eyes
    const eyeGeo = new THREE.BoxGeometry(0.07, 0.035, 0.03);
    const leftEye = new THREE.Mesh(eyeGeo, glowMat);
    leftEye.position.set(-0.09, 0.04, 0.19);
    const rightEye = new THREE.Mesh(eyeGeo, glowMat);
    rightEye.position.set(0.09, 0.04, 0.19);
    this.headGroup.add(leftEye);
    this.headGroup.add(rightEye);

    // Stylized Eyebrows
    const browGeo = new THREE.BoxGeometry(0.09, 0.025, 0.03);
    const browMat = new THREE.MeshStandardMaterial({ color: 0x27170e, roughness: 0.8 });
    const leftBrow = new THREE.Mesh(browGeo, browMat);
    leftBrow.position.set(-0.09, 0.07, 0.195);
    leftBrow.rotation.z = -0.1;
    const rightBrow = new THREE.Mesh(browGeo, browMat);
    rightBrow.position.set(0.09, 0.07, 0.195);
    rightBrow.rotation.z = 0.1;
    this.headGroup.add(leftBrow);
    this.headGroup.add(rightBrow);

    // Stylized Brow / Nose detail
    const noseGeo = new THREE.BoxGeometry(0.05, 0.11, 0.06);
    const noseMesh = new THREE.Mesh(noseGeo, skinMat);
    noseMesh.position.set(0, 0.01, 0.20);
    this.headGroup.add(noseMesh);

    // Procedural Helmet / Headpiece
    this.proceduralVisuals.buildHeadpiece(this.headGroup, helmet, skinMat);
  }

  // === 2. SHOULDERS BUILDER ===
  private buildShoulders(shoulders: RPGItem | null) {
    this.proceduralVisuals.buildShoulders(this.leftShoulderPivot, this.rightShoulderPivot, shoulders);
  }

  // === 3. TORSO & CHESTPLATE BUILDER ===
  private buildTorsoAndChest(chest: RPGItem | null) {
    this.proceduralVisuals.buildChestplate(this.torsoGroup, chest);
  }

  // === 4. ARMS & GAUNTLETS BUILDER ===
  private buildArmsAndGauntlets(arms: RPGItem | null, skinMat: THREE.Material) {
    this.proceduralVisuals.buildArms(
      this.leftArmPivot,
      this.rightArmPivot,
      this.leftForearmPivot,
      this.rightForearmPivot,
      arms,
      skinMat
    );
  }

  // === 5. LEGS & GREAVES BUILDER ===
  private buildLegsAndPants(legs: RPGItem | null) {
    this.proceduralVisuals.buildLegs(
      this.leftHipPivot,
      this.rightHipPivot,
      this.leftKneePivot,
      this.rightKneePivot,
      legs
    );
  }

  // === 6. FEET & BOOTS BUILDER ===
  private buildFeetAndBoots(boots: RPGItem | null) {
    const feet = this.proceduralVisuals.buildBoots(
      this.leftKneePivot,
      this.rightKneePivot,
      boots
    );
    this.leftFootMesh = feet.leftFoot;
    this.rightFootMesh = feet.rightFoot;
  }

  // === 7. DYNAMIC WEAPON BUILDER ===
  private buildWeaponMesh(type: WeaponType, weaponItem: RPGItem | null) {
    this.proceduralVisuals.buildWeapon(this.weaponMesh, type, weaponItem);
  }

  // === 8. DYNAMIC OFFHAND BUILDER ===
  private buildOffhandMesh(shieldItem: RPGItem | null, activeWeaponType: WeaponType) {
    this.proceduralVisuals.buildOffhand(this.offhandMesh, shieldItem, activeWeaponType);
  }

  private clearVisualMeshes(group: THREE.Group, preserveNodes: THREE.Object3D[] = []) {
    const toRemove: THREE.Object3D[] = [];
    for (const child of group.children) {
      if (!preserveNodes.includes(child)) {
        toRemove.push(child);
      }
    }
    for (const child of toRemove) {
      group.remove(child);
      if ((child as THREE.Mesh).geometry) {
        (child as THREE.Mesh).geometry.dispose();
      }
    }
  }

  private buildMountModel() {
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });
    const obsidianMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7 });

    const bodyGeo = new THREE.CylinderGeometry(0.55, 0.7, 2.2, 8);
    bodyGeo.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeo, brassMat);
    body.position.set(0, 1.1, 0);
    this.mountMesh.add(body);

    const neckGeo = new THREE.BoxGeometry(0.4, 0.9, 0.5);
    neckGeo.rotateX(-Math.PI / 6);
    const neck = new THREE.Mesh(neckGeo, brassMat);
    neck.position.set(0, 1.7, 0.9);
    this.mountMesh.add(neck);

    const headGeo = new THREE.BoxGeometry(0.45, 0.5, 0.8);
    const head = new THREE.Mesh(headGeo, brassMat);
    head.position.set(0, 2.1, 1.2);
    this.mountMesh.add(head);

    const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 1.1, 6);
    const legPositions = [
      { x: -0.45, z: 0.75 },
      { x: 0.45, z: 0.75 },
      { x: -0.45, z: -0.75 },
      { x: 0.45, z: -0.75 },
    ];

    legPositions.forEach((pos) => {
      const leg = new THREE.Mesh(legGeo, obsidianMat);
      leg.position.set(pos.x, 0.55, pos.z);
      this.mountMesh.add(leg);
      this.mountLegs.push(leg);
    });

    this.mountMesh.visible = false;
  }

  public toggleMount(): boolean {
    this.stats.isMounted = !this.stats.isMounted;
    this.mountMesh.visible = this.stats.isMounted;

    if (this.stats.isMounted) {
      this.pelvisGroup.position.y = 1.65;
      this.leftHipPivot.rotation.x = Math.PI / 3;
      this.rightHipPivot.rotation.x = Math.PI / 3;
      this.leftKneePivot.rotation.x = Math.PI / 4;
      this.rightKneePivot.rotation.x = Math.PI / 4;
    } else {
      this.pelvisGroup.position.y = 0.95;
      this.leftHipPivot.rotation.set(0, 0, 0);
      this.rightHipPivot.rotation.set(0, 0, 0);
      this.leftKneePivot.rotation.set(0, 0, 0);
      this.rightKneePivot.rotation.set(0, 0, 0);
    }

    this.recalculateStats();
    return this.stats.isMounted;
  }

  public recalculateStats() {
    const classDef = MMORPG_CLASSES[this.currentClassId];

    let bonusAttack = 0;
    let bonusSpell = 0;
    let bonusArmor = 0;
    let bonusHp = 0;
    let bonusSpeed = 0;
    let bonusCrit = 0;
    let bonusResource = 0;
    let bonusDodge = 0;

    // 1. Sum weapon masteries bonuses
    Object.entries(this.stats.weaponMasteries).forEach(([wKey, m]) => {
      if (m.bonusStats.attack) bonusAttack += m.bonusStats.attack;
      if (m.bonusStats.spellPower) bonusSpell += m.bonusStats.spellPower;
      if (m.bonusStats.armor) bonusArmor += m.bonusStats.armor;
      if (m.bonusStats.maxHp) bonusHp += m.bonusStats.maxHp;
      if (m.bonusStats.maxResource) bonusResource += m.bonusStats.maxResource;
      if (m.bonusStats.critChance) bonusCrit += m.bonusStats.critChance;
      if (m.bonusStats.moveSpeed) bonusSpeed += m.bonusStats.moveSpeed;
      if (m.bonusStats.dodgeChance) bonusDodge += m.bonusStats.dodgeChance;

      // Sum allocated mastery perks
      if (m.allocatedPerks && m.allocatedPerks.length > 0) {
        const available = m.availablePerks || WEAPON_MASTERY_PERKS[wKey as WeaponType] || [];
        m.allocatedPerks.forEach((perkId) => {
          const perk = available.find((p) => p.id === perkId);
          if (perk) {
            if (perk.effectType === 'damage_mult') bonusAttack += Math.round(perk.value * 120);
            if (perk.effectType === 'crit_damage') bonusCrit += Math.round(perk.value * 20);
          }
        });
      }
    });

    // 2. Sum equipment stats
    Object.values(this.equipment).forEach((item) => {
      if (item && item.stats) {
        if (item.stats.attack) bonusAttack += item.stats.attack;
        if (item.stats.spellPower) bonusSpell += item.stats.spellPower;
        if (item.stats.armor) bonusArmor += item.stats.armor;
        if (item.stats.maxHp) bonusHp += item.stats.maxHp;
        if (item.stats.maxResource) bonusResource += item.stats.maxResource;
        if (item.stats.moveSpeed) bonusSpeed += item.stats.moveSpeed;
        if (item.stats.critChance) bonusCrit += item.stats.critChance;
      }
    });

    // 3. Sum RuneScape-Style Attribute scaling & Breakpoints!
    const { strength, agility, intelligence, defense } = this.stats.attributes;

    // Strength: +3.5 Attack per point, +0.5% crit chance
    const strengthBonusAttack = (strength - 10) * 3.5;
    const strengthBonusCrit = (strength - 10) * 0.5;

    // Agility: +0.75% Dodge per point, +0.8% move speed
    const agilityBonusDodge = (agility - 10) * 0.75;
    const agilityBonusSpeed = (agility - 10) * 0.8;

    // Intelligence: +12 Max Mana / Resource, +3.5 Spell Power per point
    const intBonusResource = (intelligence - 10) * 12;
    const intBonusSpell = (intelligence - 10) * 3.5;

    // Defense: +4.5 Armor, +22 Max HP per point
    const defBonusArmor = (defense - 10) * 4.5;
    const defBonusHp = (defense - 10) * 22;

    // Passive Attribute Breakpoints
    if (strength >= 25) bonusAttack += 15;
    if (strength >= 50) bonusCrit += 6;
    if (strength >= 100) bonusAttack += 35;
    if (agility >= 25) bonusSpeed += 8;
    if (agility >= 75) bonusDodge += 10;
    if (intelligence >= 25) bonusResource += 60;
    if (intelligence >= 75) bonusSpell += 25;
    if (defense >= 25) bonusArmor += 20;
    if (defense >= 50) bonusHp += 200;

    const levelMult = 1 + (this.stats.level - 1) * 0.12;
    this.stats.maxHp = Math.round((classDef.baseHp + bonusHp + defBonusHp) * levelMult);
    this.stats.maxResource = Math.round(classDef.baseResource + bonusResource + intBonusResource);
    this.stats.attackPower = Math.round(
      (classDef.baseAttack + bonusAttack + strengthBonusAttack) * levelMult * this.buffAttackMultiplier
    );
    this.stats.spellPower = Math.round(
      (classDef.baseSpellPower + bonusSpell + intBonusSpell) * levelMult * this.buffAttackMultiplier
    );
    this.stats.armor = Math.round(classDef.baseArmor + bonusArmor + defBonusArmor);
    this.stats.critChance = Math.min(75, Math.round(10 + bonusCrit + strengthBonusCrit));
    this.stats.dodgeChance = Math.min(50, Math.round(6 + bonusDodge + agilityBonusDodge));

    // Agility also reduces weapon attack animation time for faster attacks!
    this.attackAnimDuration = Math.max(0.28, 0.55 - (agility - 10) * 0.008);

    // Movement speed
    let speedMult = 1.0 + (bonusSpeed + agilityBonusSpeed) / 100;
    if (this.stats.isMounted) speedMult += 1.0;
    speedMult *= this.buffSpeedMultiplier;
    this.stats.moveSpeedMultiplier = speedMult;

    // Detect weapon switch and rebuild visual
    const activeWep = this.getActiveWeaponType();
    if (this.stats.activeWeaponType !== activeWep) {
      this.stats.activeWeaponType = activeWep;
    }

    // Apply Long-Term Ascension (Endlich Level) Paragon Bonuses
    AscensionSystem.recalculateAscensionBonuses(this.stats);
  }

  // --- Real-time Equipment State Observer System ---
  public static normalizeSlot(slotName: string): keyof EquipmentState {
    const s = slotName.toLowerCase().trim();
    if (s === 'head') return 'helmet';
    if (s === 'shoes') return 'boots';
    if (s === 'offhand') return 'shield';
    return s as keyof EquipmentState;
  }

  public addEquipmentListener(listener: (equipment: EquipmentState) => void): () => void {
    this.equipmentListeners.push(listener);
    return () => {
      this.equipmentListeners = this.equipmentListeners.filter((l) => l !== listener);
    };
  }

  public emitEquipmentAura() {
    if (this.shieldBubble) {
      const mat = this.shieldBubble.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.45;
      setTimeout(() => {
        if (this.shieldBubble) {
          (this.shieldBubble.material as THREE.MeshStandardMaterial).opacity = 0.0;
        }
      }, 300);
    }
  }

  public observeEquipmentState(): boolean {
    const primarySlots: { key: keyof EquipmentState; alias?: string }[] = [
      { key: 'helmet', alias: 'head' },
      { key: 'chest' },
      { key: 'arms' },
      { key: 'shoulders' },
      { key: 'legs' },
      { key: 'boots', alias: 'shoes' },
      { key: 'shield', alias: 'offhand' },
      { key: 'weapon' },
    ];

    let hasChanged = false;
    for (const slotInfo of primarySlots) {
      const item = this.equipment[slotInfo.key] || (slotInfo.alias ? (this.equipment as any)[slotInfo.alias] : null);
      const currentId = item ? item.id : null;
      const lastId = this.lastEquipmentSignature[slotInfo.key];

      if (currentId !== lastId) {
        hasChanged = true;
        this.lastEquipmentSignature[slotInfo.key] = currentId;
      }
    }

    if (hasChanged) {
      this.buildCharacterMesh();
      this.recalculateStats();
      this.emitEquipmentAura();
      for (const listener of this.equipmentListeners) {
        try {
          listener(this.equipment);
        } catch (err) {
          console.error('[OpenWorldPlayer] Error in equipment listener:', err);
        }
      }
      return true;
    }
    return false;
  }

  public equipItem(item: RPGItem): RPGItem | null {
    if (item.slot === 'consumable') {
      this.useConsumable(item);
      return null;
    }
    const slot = OpenWorldPlayer.normalizeSlot(item.slot);

    const previousEquipped = this.equipment[slot];
    this.equipment[slot] = item;
    if (slot === 'helmet') (this.equipment as any).head = item;
    if (slot === 'boots') (this.equipment as any).shoes = item;
    if (slot === 'shield') (this.equipment as any).offhand = item;

    // Remove equipped item from bag, add previous item if existed
    this.inventory = this.inventory.filter((i) => i.id !== item.id);
    if (previousEquipped) {
      this.inventory.push(previousEquipped);
    }

    if (slot === 'weapon' && item.weaponType) {
      this.stats.activeWeaponType = item.weaponType;
    }

    // Dynamic Visual Update for every equipped piece!
    this.observeEquipmentState();
    return previousEquipped;
  }

  public unequipItem(slotName: string): RPGItem | null {
    const slot = OpenWorldPlayer.normalizeSlot(slotName);
    const item = this.equipment[slot] || (slotName === 'head' ? (this.equipment as any).head : null) || (slotName === 'shoes' ? (this.equipment as any).shoes : null) || (slotName === 'offhand' ? (this.equipment as any).offhand : null);
    if (item) {
      this.equipment[slot] = null;
      if (slot === 'helmet') (this.equipment as any).head = null;
      if (slot === 'boots') (this.equipment as any).shoes = null;
      if (slot === 'shield') (this.equipment as any).offhand = null;
      this.inventory.push(item);
      this.observeEquipmentState();
      return item;
    }
    return null;
  }

  public unequipSlot(slotName: string): RPGItem | null {
    return this.unequipItem(slotName);
  }

  public useConsumable(item: RPGItem) {
    if (item.id === 'item_potion_hp') {
      this.heal(250);
    } else if (item.id === 'item_potion_elixir') {
      this.buffAttackMultiplier = 1.35;
      this.buffTimer = 30.0;
      this.recalculateStats();
    }
    this.inventory = this.inventory.filter((i) => i.id !== item.id);
  }

  public takeDamage(amount: number): { damageTaken: number; isDead: boolean; dodged: boolean; iFrame?: boolean } {
    // 1. Check Active I-Frames from Dodge-Roll
    if (this.iFrameTimer > 0 || this.isDodgeRolling) {
      return { damageTaken: 0, isDead: false, dodged: true, iFrame: true };
    }

    // 2. Check Agility-based Passive Dodge Chance
    const roll = Math.random() * 100;
    if (roll < this.stats.dodgeChance) {
      this.triggerDodge();
      return { damageTaken: 0, isDead: false, dodged: true };
    }

    // 3. Hyperbolic Armor Formula with Diminishing Returns: DR % = Armor / (Armor + 120 + 12 * Level)
    const armorFactor = this.stats.armor / (this.stats.armor + 120 + this.stats.level * 12);
    let effectiveDmg = amount * (1.0 - Math.min(0.85, armorFactor));

    // Defense 100 Breakpoint (Unyielding Juggernaut): -15% total damage taken
    if (this.stats.attributes.defense >= 100) {
      effectiveDmg *= 0.85;
    }

    // Active Knight Shield: -75% damage
    if (this.isShieldActive) {
      effectiveDmg *= 0.25;
    }

    // Bulwark Aegis Shield (Defense 75 Breakpoint)
    if (this.bulwarkShieldActive && this.bulwarkShieldAmount > 0) {
      if (effectiveDmg <= this.bulwarkShieldAmount) {
        this.bulwarkShieldAmount -= effectiveDmg;
        effectiveDmg = 0;
      } else {
        effectiveDmg -= this.bulwarkShieldAmount;
        this.bulwarkShieldAmount = 0;
        this.bulwarkShieldActive = false;
      }
    }

    effectiveDmg = Math.max(1, Math.round(effectiveDmg));
    this.stats.hp = Math.max(0, this.stats.hp - effectiveDmg);

    // Check Bulwark Aegis Trigger (< 30% HP)
    if (
      this.stats.attributes.defense >= 75 &&
      !this.bulwarkShieldActive &&
      this.bulwarkShieldCooldown <= 0 &&
      this.stats.hp > 0 &&
      this.stats.hp < this.stats.maxHp * 0.3
    ) {
      this.bulwarkShieldActive = true;
      this.bulwarkShieldAmount = 250;
      this.bulwarkShieldCooldown = 60.0;
    }

    // Intelligence 100 Breakpoint (Mind Over Matter): 15% damage converted to resource
    if (this.stats.attributes.intelligence >= 100 && effectiveDmg > 0) {
      this.restoreResource(Math.round(effectiveDmg * 0.15));
    }

    return {
      damageTaken: effectiveDmg,
      isDead: this.stats.hp <= 0,
      dodged: false,
    };
  }

  public triggerDodge() {
    this.isDodging = true;
    this.dodgeTimer = 0.35;
  }

  // --- Active Tactical Dodge-Roll with I-Frames ---
  public triggerDodgeRoll(dirX?: number, dirZ?: number): boolean {
    if (this.dodgeCooldownTimer > 0 || this.isDodgeRolling) return false;

    const resourceCost = this.stats.attributes.agility >= 50 ? 10 : 15;
    if (!this.consumeResource(resourceCost)) {
      return false;
    }

    this.isDodgeRolling = true;
    this.dodgeRollTimer = 0.35;
    this.iFrameTimer = this.stats.attributes.agility >= 75 ? 0.38 : 0.28;
    this.dodgeCooldownTimer = this.stats.attributes.agility >= 50 ? 0.55 : 0.85;

    const len = Math.hypot(dirX || 0, dirZ || 0);
    if (len > 0.05) {
      this.dodgeDirection.set((dirX || 0) / len, 0, (dirZ || 0) / len);
    } else {
      this.dodgeDirection.set(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle));
    }

    return true;
  }

  // --- Action Buffering / Skill Queuing ---
  public queueSkill(skillIndex: number) {
    this.bufferedSkillIndex = skillIndex;
    this.bufferTimer = 0.22; // 220ms window
  }

  public clearBufferedSkill(): number | null {
    const queued = this.bufferedSkillIndex;
    this.bufferedSkillIndex = null;
    this.bufferTimer = 0;
    return queued;
  }

  public heal(amount: number) {
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
  }

  public restoreResource(amount: number) {
    this.stats.resource = Math.min(this.stats.maxResource, this.stats.resource + amount);
  }

  public consumeResource(amount: number): boolean {
    if (this.stats.resource >= amount) {
      this.stats.resource -= amount;
      return true;
    }
    return false;
  }

  public gainXp(amount: number): {
    leveledUp: boolean;
    ascensionLeveledUp: boolean;
    newAscensionLevel: number;
    pointsAwarded: number;
  } {
    const result = AscensionSystem.awardExperience(this.stats, amount);

    if (result.standardLevelUp) {
      this.stats.score += 250;
      this.stats.hp = this.stats.maxHp;
      this.stats.resource = this.stats.maxResource;
    }

    if (result.ascensionLevelUp) {
      this.stats.score += 1000;
      this.stats.hp = this.stats.maxHp;
      this.stats.resource = this.stats.maxResource;
    }

    this.recalculateStats();

    return {
      leveledUp: result.standardLevelUp,
      ascensionLeveledUp: result.ascensionLevelUp,
      newAscensionLevel: result.newAscensionLevel,
      pointsAwarded: result.pointsAwarded,
    };
  }

  public triggerShield(duration: number = 5.0) {
    this.isShieldActive = true;
    this.shieldTimer = duration;
    (this.shieldBubble.material as THREE.MeshStandardMaterial).opacity = 0.75;
  }

  // --- Real Combat Weapon Swing & Spell Trigger ---
  public triggerAttackAnimation(
    type: 'melee' | 'projectile' | 'aoe' | 'buff' | 'utility' | 'turret' = 'melee',
    duration?: number
  ) {
    this.isAttacking = true;
    this.activeAttackType = type;
    const dur = duration || this.attackAnimDuration;
    this.attackAnimTimer = dur;

    if (type === 'aoe' || type === 'projectile') {
      (this.spellGlyphRing.material as THREE.MeshBasicMaterial).opacity = 0.85;
    } else if (type === 'buff') {
      (this.buffShockwaveRing.material as THREE.MeshBasicMaterial).opacity = 0.9;
    }
  }

  // --- Kinematics & Animation Update Loop ---
  public update(delta: number, moveInput: { x: number; z: number }) {
    this.idleTime += delta;

    if (this.glbMixer) {
      this.glbMixer.update(delta);
    }

    // 1. Buffs Countdown
    if (this.buffTimer > 0) {
      this.buffTimer -= delta;
      if (this.buffTimer <= 0) {
        this.buffAttackMultiplier = 1.0;
        this.buffSpeedMultiplier = 1.0;
        this.recalculateStats();
      }
    }

    // 2. Shield Countdown
    if (this.isShieldActive) {
      this.shieldTimer -= delta;
      this.shieldBubble.rotation.y += delta * 2.0;
      if (this.shieldTimer <= 0) {
        this.isShieldActive = false;
        (this.shieldBubble.material as THREE.MeshStandardMaterial).opacity = 0.0;
      }
    }

    // 3. Spell / Buff Visual FX Fading & Rotation
    if ((this.spellGlyphRing.material as THREE.MeshBasicMaterial).opacity > 0) {
      const mat = this.spellGlyphRing.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, mat.opacity - delta * 2.0);
      this.spellGlyphRing.rotation.y += delta * 3.0;
    }

    if ((this.buffShockwaveRing.material as THREE.MeshBasicMaterial).opacity > 0) {
      const mat = this.buffShockwaveRing.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, mat.opacity - delta * 2.2);
      this.buffShockwaveRing.scale.addScalar(delta * 2.5);
      if (mat.opacity <= 0) {
        this.buffShockwaveRing.scale.set(1, 1, 1);
      }
    }

    // 4. Dodge Timer & Active Dodge Roll Kinematics
    if (this.dodgeCooldownTimer > 0) {
      this.dodgeCooldownTimer -= delta;
    }
    if (this.iFrameTimer > 0) {
      this.iFrameTimer -= delta;
    }
    if (this.bulwarkShieldCooldown > 0) {
      this.bulwarkShieldCooldown -= delta;
    }
    if (this.bufferTimer > 0) {
      this.bufferTimer -= delta;
      if (this.bufferTimer <= 0) {
        this.bufferedSkillIndex = null;
      }
    }

    if (this.isDodgeRolling) {
      this.dodgeRollTimer -= delta;
      // High-speed evasive tumble
      this.velocity.x = this.dodgeDirection.x * 22.0;
      this.velocity.z = this.dodgeDirection.z * 22.0;
      this.pelvisGroup.rotation.x -= delta * 22.0;

      if (this.dodgeRollTimer <= 0) {
        this.isDodgeRolling = false;
        this.pelvisGroup.rotation.x = 0;
      }
    }

    if (this.isDodging) {
      this.dodgeTimer -= delta;
      this.pelvisGroup.rotation.y += delta * 18.0;
      if (this.dodgeTimer <= 0) {
        this.isDodging = false;
        this.pelvisGroup.rotation.y = 0;
      }
    }

    // 5. Passive Resource Regeneration (Scaled by Intelligence + Breakpoints)
    let intRegen = 10 + (this.stats.attributes.intelligence - 10) * 1.2;
    if (this.stats.attributes.intelligence >= 25) {
      intRegen += 2.5; // Aether Flow breakpoint
    }
    this.restoreResource(delta * intRegen);

    // Passive HP Regeneration from Defense 50 (Vigorous Vitality)
    if (this.stats.attributes.defense >= 50 && this.stats.hp < this.stats.maxHp) {
      this.heal(delta * 5.0);
    }

    // 6. Real-time Equipment Observer Check (Guarantees immediate 3D re-render on equipment mutation)
    this.observeEquipmentState();
    this.proceduralVisuals.updateAnimations(delta, this.idleTime);

    // 7. Movement Physics & Articulated Kinematics (if not in active dodge roll)
    if (!this.isDodgeRolling) {
      const inputLen = Math.hypot(moveInput.x, moveInput.z);
      this.isMoving = inputLen > 0.05;
      const speed = this.baseMoveSpeed * this.stats.moveSpeedMultiplier;

      if (this.isMoving) {
        const normX = moveInput.x / inputLen;
        const normZ = moveInput.z / inputLen;

        this.velocity.x = normX * speed;
        this.velocity.z = normZ * speed;

        // Rotate character towards movement
        this.targetAngle = Math.atan2(normX, normZ);
        let angleDiff = this.targetAngle - this.facingAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        this.facingAngle += angleDiff * Math.min(1.0, delta * 14.0);

        // --- Feet & Leg Walking / Running Gait Kinematics ---
        if (!this.stats.isMounted) {
          const gaitSpeed = 10.5 * (speed / this.baseMoveSpeed);
          this.walkCyclePhase += delta * gaitSpeed;

          const strideExtent = 0.65;
          const leftLegCycle = Math.sin(this.walkCyclePhase);
          const rightLegCycle = -leftLegCycle;

          // Hip swing forward & backward
          this.leftHipPivot.rotation.x = leftLegCycle * strideExtent;
          this.rightHipPivot.rotation.x = rightLegCycle * strideExtent;

          // Natural knee bend on backstroke, straightens when planting foot forward
          this.leftKneePivot.rotation.x = Math.max(0, -leftLegCycle) * 1.15;
          this.rightKneePivot.rotation.x = Math.max(0, -rightLegCycle) * 1.15;

          // Torso & Pelvic Vertical Bounce and subtle sway
          const bounce = Math.abs(Math.sin(this.walkCyclePhase * 2)) * 0.07;
          this.pelvisGroup.position.y = 0.95 - bounce;
          this.torsoGroup.rotation.z = Math.sin(this.walkCyclePhase) * 0.04;
          this.torsoGroup.rotation.x = 0.08; // Forward sprint lean

          // Counter-arm swing when moving (keeping weapon held firmly in hand)
          if (!this.isAttacking) {
            this.leftArmPivot.rotation.x = -leftLegCycle * 0.55;
            this.rightArmPivot.rotation.x = -rightLegCycle * 0.55;
            this.leftForearmPivot.rotation.x = -0.3;
            this.rightForearmPivot.rotation.x = -0.3;
            this.weaponPivot.rotation.x = THREE.MathUtils.lerp(this.weaponPivot.rotation.x, 0.2, delta * 8);
          }
        } else {
          // Mount Gallop animation
          this.gallopPhase += delta * 15.0;
          this.mountLegs.forEach((leg, index) => {
            leg.rotation.x = Math.sin(this.gallopPhase + (index % 2) * Math.PI) * 0.5;
          });
        }
      } else {
        // Decelerate
        this.velocity.x *= 0.65;
        this.velocity.z *= 0.65;
      }

    // --- Articulated Combat Idle & Weapon-Holding Kinematics ---
      if (!this.stats.isMounted) {
        this.walkCyclePhase = 0;
        const breathCycle = Math.sin(this.idleTime * 2.4);
        const breathSlow = Math.sin(this.idleTime * 1.2);

        // Pelvis breathing lift & fall
        this.pelvisGroup.position.y = 0.95 + breathCycle * 0.02;

        // Torso martial lean, expansion, and breathing sway
        this.torsoGroup.rotation.x = THREE.MathUtils.lerp(this.torsoGroup.rotation.x, 0.04 + breathCycle * 0.015, delta * 8);
        this.torsoGroup.rotation.y = THREE.MathUtils.lerp(this.torsoGroup.rotation.y, breathSlow * 0.025, delta * 8);
        this.torsoGroup.rotation.z = THREE.MathUtils.lerp(this.torsoGroup.rotation.z, breathCycle * 0.01, delta * 8);

        // Head attentive level scan keeping eye contact forward
        this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, -0.04 - breathCycle * 0.015, delta * 8);
        this.headGroup.rotation.y = THREE.MathUtils.lerp(this.headGroup.rotation.y, Math.sin(this.idleTime * 0.6) * 0.05, delta * 6);

        // Grounded martial ready footing (left foot slightly forward, right foot braced back)
        this.leftHipPivot.rotation.x = THREE.MathUtils.lerp(this.leftHipPivot.rotation.x, 0.08, delta * 8);
        this.rightHipPivot.rotation.x = THREE.MathUtils.lerp(this.rightHipPivot.rotation.x, -0.08, delta * 8);
        this.leftKneePivot.rotation.x = THREE.MathUtils.lerp(this.leftKneePivot.rotation.x, 0.12, delta * 8);
        this.rightKneePivot.rotation.x = THREE.MathUtils.lerp(this.rightKneePivot.rotation.x, 0.14, delta * 8);

        // Weapon-Holding Combat Idle Stances (when not actively executing an attack swing)
        if (!this.isAttacking) {
          const activeWep = this.getActiveWeaponType();

          if (activeWep === 'blade') {
            // Blade Stance: Weapon held poised diagonally in high ready guard, blade tilted forward
            this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, -0.45 + breathCycle * 0.03, delta * 8);
            this.rightArmPivot.rotation.y = THREE.MathUtils.lerp(this.rightArmPivot.rotation.y, -0.15, delta * 8);
            this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, 0.2, delta * 8);

            this.rightForearmPivot.rotation.x = THREE.MathUtils.lerp(this.rightForearmPivot.rotation.x, -0.7 + breathCycle * 0.02, delta * 8);
            this.rightForearmPivot.rotation.y = THREE.MathUtils.lerp(this.rightForearmPivot.rotation.y, 0.12, delta * 8);

            this.weaponPivot.rotation.x = THREE.MathUtils.lerp(this.weaponPivot.rotation.x, 0.35 + breathCycle * 0.04, delta * 8);
            this.weaponPivot.rotation.y = THREE.MathUtils.lerp(this.weaponPivot.rotation.y, 0.1, delta * 8);
            this.weaponPivot.rotation.z = THREE.MathUtils.lerp(this.weaponPivot.rotation.z, -0.12, delta * 8);

            // Left Arm / Shield
            if (this.equipment.shield || (this.equipment as any).offhand) {
              this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, -0.38 + breathCycle * 0.03, delta * 8);
              this.leftArmPivot.rotation.y = THREE.MathUtils.lerp(this.leftArmPivot.rotation.y, 0.18, delta * 8);
              this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, -0.28, delta * 8);

              this.leftForearmPivot.rotation.x = THREE.MathUtils.lerp(this.leftForearmPivot.rotation.x, -0.85 + breathCycle * 0.02, delta * 8);
              this.leftForearmPivot.rotation.y = THREE.MathUtils.lerp(this.leftForearmPivot.rotation.y, -0.2, delta * 8);
            } else {
              this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, -0.28 + breathCycle * 0.02, delta * 8);
              this.leftArmPivot.rotation.y = THREE.MathUtils.lerp(this.leftArmPivot.rotation.y, 0.08, delta * 8);
              this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, -0.18, delta * 8);

              this.leftForearmPivot.rotation.x = THREE.MathUtils.lerp(this.leftForearmPivot.rotation.x, -0.5, delta * 8);
              this.leftForearmPivot.rotation.y = THREE.MathUtils.lerp(this.leftForearmPivot.rotation.y, 0, delta * 8);
            }
          } else if (activeWep === 'arcane') {
            // Arcane Stance: Staff held tall, left hand channeling mystic energy
            this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, -0.32 + breathCycle * 0.03, delta * 8);
            this.rightArmPivot.rotation.y = THREE.MathUtils.lerp(this.rightArmPivot.rotation.y, -0.05, delta * 8);
            this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, 0.14, delta * 8);

            this.rightForearmPivot.rotation.x = THREE.MathUtils.lerp(this.rightForearmPivot.rotation.x, -0.48 + breathCycle * 0.02, delta * 8);
            this.rightForearmPivot.rotation.y = 0;

            this.weaponPivot.rotation.x = THREE.MathUtils.lerp(this.weaponPivot.rotation.x, 0.12 + breathCycle * 0.02, delta * 8);
            this.weaponPivot.rotation.y = 0;
            this.weaponPivot.rotation.z = 0;

            this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, -0.45 + breathCycle * 0.04, delta * 8);
            this.leftArmPivot.rotation.y = THREE.MathUtils.lerp(this.leftArmPivot.rotation.y, 0.22, delta * 8);
            this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, -0.3, delta * 8);

            this.leftForearmPivot.rotation.x = THREE.MathUtils.lerp(this.leftForearmPivot.rotation.x, -0.72 + breathCycle * 0.03, delta * 8);
            this.leftForearmPivot.rotation.y = -0.1;

            if (this.offhandMesh) {
              this.offhandMesh.rotation.y += delta * 1.5;
            }
          } else if (activeWep === 'marksmanship') {
            // Marksmanship Stance: Crossbow held raised in two-handed tactical ready stance
            this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, -0.8 + breathCycle * 0.02, delta * 8);
            this.rightArmPivot.rotation.y = THREE.MathUtils.lerp(this.rightArmPivot.rotation.y, -0.12, delta * 8);
            this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, 0.22, delta * 8);

            this.rightForearmPivot.rotation.x = THREE.MathUtils.lerp(this.rightForearmPivot.rotation.x, -0.55, delta * 8);
            this.weaponPivot.rotation.x = THREE.MathUtils.lerp(this.weaponPivot.rotation.x, 0.1, delta * 8);

            this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, -0.75 + breathCycle * 0.02, delta * 8);
            this.leftArmPivot.rotation.y = THREE.MathUtils.lerp(this.leftArmPivot.rotation.y, 0.32, delta * 8);
            this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, -0.15, delta * 8);

            this.leftForearmPivot.rotation.x = THREE.MathUtils.lerp(this.leftForearmPivot.rotation.x, -0.68, delta * 8);
          } else {
            // Heavy Tech Stance: Underslung Gatling / Cannon braced ready stance
            this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, -0.62 + breathCycle * 0.03, delta * 8);
            this.rightArmPivot.rotation.y = THREE.MathUtils.lerp(this.rightArmPivot.rotation.y, -0.1, delta * 8);
            this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(this.rightArmPivot.rotation.z, 0.28, delta * 8);

            this.rightForearmPivot.rotation.x = THREE.MathUtils.lerp(this.rightForearmPivot.rotation.x, -0.48, delta * 8);
            this.weaponPivot.rotation.x = THREE.MathUtils.lerp(this.weaponPivot.rotation.x, 0.18 + breathCycle * 0.03, delta * 8);

            this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, -0.58 + breathCycle * 0.03, delta * 8);
            this.leftArmPivot.rotation.y = THREE.MathUtils.lerp(this.leftArmPivot.rotation.y, 0.28, delta * 8);
            this.leftArmPivot.rotation.z = THREE.MathUtils.lerp(this.leftArmPivot.rotation.z, -0.22, delta * 8);

            this.leftForearmPivot.rotation.x = THREE.MathUtils.lerp(this.leftForearmPivot.rotation.x, -0.62, delta * 8);
          }
        }
      }
    }

    // --- Dynamic Weapon Swing & Spell Casting Animations ---
    if (this.isAttacking && this.attackAnimTimer > 0) {
      this.attackAnimTimer -= delta;
      const progress = 1.0 - this.attackAnimTimer / this.attackAnimDuration; // 0.0 to 1.0

      if (this.activeAttackType === 'melee') {
        // Multi-stage realistic slashing arc: Windup -> Explosive Slash -> Follow-through
        if (progress < 0.28) {
          // Windup phase
          const p = progress / 0.28;
          this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(-0.2, -1.3, p);
          this.rightArmPivot.rotation.y = THREE.MathUtils.lerp(0, -0.6, p);
          this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(0.1, 0.5, p);
          this.rightForearmPivot.rotation.x = THREE.MathUtils.lerp(-0.4, -1.2, p);
          this.weaponPivot.rotation.x = THREE.MathUtils.lerp(0, -0.8, p);
          this.torsoGroup.rotation.y = THREE.MathUtils.lerp(0, -0.35, p);
        } else if (progress < 0.68) {
          // Explosive Slash phase
          const p = (progress - 0.28) / 0.4;
          const easeSlash = Math.sin(p * Math.PI * 0.5);
          this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(-1.3, 1.45, easeSlash);
          this.rightArmPivot.rotation.y = THREE.MathUtils.lerp(-0.6, 0.7, easeSlash);
          this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(0.5, -0.4, easeSlash);
          this.rightForearmPivot.rotation.x = THREE.MathUtils.lerp(-1.2, -0.2, easeSlash);
          this.weaponPivot.rotation.x = THREE.MathUtils.lerp(-0.8, 1.2, easeSlash);
          this.torsoGroup.rotation.y = THREE.MathUtils.lerp(-0.35, 0.45, easeSlash);
        } else {
          // Recovery phase
          const p = (progress - 0.68) / 0.32;
          this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(1.45, -0.2, p);
          this.rightArmPivot.rotation.y = THREE.MathUtils.lerp(0.7, 0, p);
          this.rightArmPivot.rotation.z = THREE.MathUtils.lerp(-0.4, 0.1, p);
          this.torsoGroup.rotation.y = THREE.MathUtils.lerp(0.45, 0, p);
        }
      } else if (this.activeAttackType === 'projectile' || this.activeAttackType === 'turret') {
        // Aim raise & sharp recoil kickback
        if (progress < 0.3) {
          this.rightArmPivot.rotation.x = -1.4;
          this.rightForearmPivot.rotation.x = -0.1;
          this.weaponPivot.rotation.x = 0.5;
        } else {
          const p = (progress - 0.3) / 0.7;
          this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(-1.4, -0.2, p);
          this.weaponPivot.rotation.x = THREE.MathUtils.lerp(0.5, 0, p);
        }
      } else if (this.activeAttackType === 'buff') {
        // Active Buff / Warcry: Stomp ground and raise arms outward
        const p = Math.sin(progress * Math.PI);
        this.leftArmPivot.rotation.z = -p * 1.2;
        this.rightArmPivot.rotation.z = p * 1.2;
        this.leftArmPivot.rotation.x = -p * 0.8;
        this.rightArmPivot.rotation.x = -p * 0.8;
      } else {
        // Spellcast (AoE / Chrono Magic): Raise staff overhead with dual channeling pose
        const arc = Math.sin(progress * Math.PI);
        this.rightArmPivot.rotation.x = -0.2 - arc * 1.5;
        this.leftArmPivot.rotation.x = -0.2 - arc * 1.5;
        this.weaponPivot.rotation.z = arc * 0.8;
        this.pelvisGroup.position.y += arc * 0.15; // Floating sensation while channeling!
      }

      if (this.attackAnimTimer <= 0) {
        this.isAttacking = false;
      }
    }

    // Update Position in World with Physical Solid Obstacle Collision & Wall-Sliding
    const displacement = {
      x: this.velocity.x * delta,
      z: this.velocity.z * delta,
    };

    if (Math.abs(displacement.x) > 0.0001 || Math.abs(displacement.z) > 0.0001) {
      const resolved = collisionSystem.resolveMovement(
        { x: this.position.x, z: this.position.z },
        displacement,
        0.65 // Player physical body collision radius
      );
      this.position.x = resolved.newPos.x;
      this.position.z = resolved.newPos.z;
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.facingAngle;

    this.stats.x = this.position.x;
    this.stats.y = this.position.y;
    this.stats.z = this.position.z;
    this.stats.facingAngle = this.facingAngle;

    // Aura floating
    this.classAura.rotation.y += delta * 0.5;
  }

  // --- External GLB Model Equipping ---
  public async equipGlbModel(modelId: string | null): Promise<boolean> {
    // Clear existing GLB avatar
    while (this.glbAvatarGroup.children.length > 0) {
      const child = this.glbAvatarGroup.children[0];
      this.glbAvatarGroup.remove(child);
    }
    if (this.glbMixer) {
      this.glbMixer.stopAllAction();
      this.glbMixer = null;
      this.activeGlbAction = null;
    }

    if (!modelId) {
      this.activeGlbModelId = null;
      this.rootGroup.visible = true;
      return true;
    }

    try {
      const { scene, animations } = await glbManager.loadModel(modelId);
      this.activeGlbModelId = modelId;
      this.rootGroup.visible = false; // Hide procedural model while GLB skin is active

      scene.position.set(0, 0, 0);
      scene.scale.set(1.0, 1.0, 1.0);
      this.glbAvatarGroup.add(scene);

      if (animations && animations.length > 0) {
        this.glbMixer = new THREE.AnimationMixer(scene);
        const clip = animations.find((a) => a.name.toLowerCase().includes('idle')) || animations[0];
        if (clip) {
          this.activeGlbAction = this.glbMixer.clipAction(clip);
          this.activeGlbAction.play();
        }
      }
      return true;
    } catch (err) {
      console.error(`Could not equip GLB model ${modelId}:`, err);
      this.rootGroup.visible = true;
      this.activeGlbModelId = null;
      return false;
    }
  }

  // Equips a registered GLB model directly to its corresponding equipment slot (Weapon, Shield, Helmet, Chest, Avatar)
  public async equipGlbAsEquipment(modelId: string, targetSlot?: any): Promise<boolean> {
    const catalog = glbManager.getCachedCatalog();
    let model = catalog.find((m) => m.id === modelId);
    if (!model) {
      const fresh = await glbManager.fetchCatalog();
      model = fresh.find((m) => m.id === modelId);
    }

    if (!model) {
      console.warn(`[OpenWorldPlayer] Model ${modelId} not found in catalog.`);
      return false;
    }

    if (model.category === 'character_avatar') {
      return this.equipGlbModel(modelId);
    }

    // Convert to RPGItem and dynamically equip
    const item = glbManager.convertToRpgItem(model);
    if (targetSlot) {
      item.slot = targetSlot;
    }
    this.equipItem(item);
    return true;
  }

  // Registers a newly scanned GLB model into the player's active MMORPG inventory
  public registerGlbItemToInventory(model: GLBModelEntry): RPGItem {
    const item = glbManager.convertToRpgItem(model);
    const existingIndex = this.inventory.findIndex((i) => i.id === item.id);
    if (existingIndex >= 0) {
      this.inventory[existingIndex] = item;
    } else {
      this.inventory.push(item);
    }
    this.observeEquipmentState();
    return item;
  }
}

export function createDefaultPlayerStats(startingClass: CharacterClassId = 'knight'): PlayerStats {
  const classDef = MMORPG_CLASSES[startingClass];
  const initialMasteries: Record<WeaponType, WeaponMastery> = JSON.parse(
    JSON.stringify(DEFAULT_WEAPON_MASTERIES)
  );
  const initialAttributes: CharacterAttributes = {
    strength: 10,
    agility: 10,
    intelligence: 10,
    defense: 10,
  };
  return {
    hp: classDef.baseHp,
    maxHp: classDef.baseHp,
    resource: classDef.baseResource,
    maxResource: classDef.baseResource,
    resourceName: classDef.resourceName,
    resourceColor: classDef.resourceColor,
    level: 1,
    xp: 0,
    maxXp: 100,
    xpToNextLevel: 100,
    gold: 250,
    attackPower: classDef.baseAttack,
    spellPower: classDef.baseSpellPower,
    armor: classDef.baseArmor,
    critChance: 10,
    dodgeChance: 6,
    moveSpeed: 100,
    moveSpeedMultiplier: 1.0,
    isMounted: false,
    activeMountName: 'Clockwork Brass Stallion',
    score: 0,
    kills: 0,
    bossKills: 0,
    currentZone: 'Aethelgard Sanctum',
    x: 0,
    y: 0,
    z: 8,
    statPoints: 3,
    attributes: initialAttributes,
    activeWeaponType: 'blade',
    weaponMasteries: initialMasteries, armorMasteries: DEFAULT_ARMOR_MASTERIES,
    equippedSkills: [...classDef.skills],
    unlockedMilestoneSkills: [],
    totalMasteryLevel: 4,
    politicsLevel: 1,
    politicsXp: 0,
    ascensionLevel: 0,
    ascensionXp: 0,
    ascensionMaxXp: 10000,
    ascensionPoints: 0,
    ascensionTalents: {},
    prestigeTitle: 'Aspirant',
  };
}
