import { CharacterClassId, ItemRarity, RPGItem } from '../types';

export type GuildRole = 'Guild Master' | 'Officer' | 'Veteran' | 'Member' | 'Recruit';

export interface GuildMember {
  id: string;
  name: string;
  isNPC: boolean;
  role: GuildRole;
  classId: CharacterClassId;
  level: number;
  avatarIcon: string;
  zone: string;
  controlledTerritories: string[]; // Chunk keys e.g. ["0,0", "1,0"]
  contributedGold: number;
  contributedResources: {
    wood: number;
    stone: number;
    aether: number;
    crops: number;
  };
  joinedAt: string;
  isOnline: boolean;
}

export interface GuildBankItem {
  id: string;
  name: string;
  rarity: ItemRarity;
  icon: string;
  type: string;
  quantity: number;
  itemData: RPGItem;
  depositedBy: string;
  depositedAt: string;
}

export interface GuildBankLog {
  id: string;
  timestamp: string;
  action: 'deposit_gold' | 'withdraw_gold' | 'deposit_item' | 'withdraw_item' | 'donate_resource' | 'kingdom_upgrade';
  playerName: string;
  details: string;
}

export interface GuildBank {
  treasuryGold: number;
  items: GuildBankItem[];
  maxSlots: number;
  logs: GuildBankLog[];
}

export interface GuildAlliance {
  id: string;
  targetGuildName: string;
  targetGuildTag: string;
  leaderName: string;
  status: 'active' | 'pending' | 'truce';
  sharedTerritoriesCount: number;
  mutualDefense: boolean;
  bonusDescription: string;
  formedAt: string;
}

export interface GuildGoal {
  id: string;
  title: string;
  description: string;
  category: 'territory' | 'bank' | 'bosses' | 'resources';
  currentProgress: number;
  targetProgress: number;
  unit: string;
  rewardGuildXp: number;
  rewardGold: number;
  completed: boolean;
}

export interface KingdomBuilding {
  id: string;
  name: string;
  germanName: string;
  level: number;
  maxLevel: number;
  cost: {
    gold: number;
    wood: number;
    stone: number;
    aether: number;
  };
  description: string;
  perk: string;
  icon: string;
  built: boolean;
}

export interface ControlledTerritorySummary {
  chunkKey: string;
  chunkX: number;
  chunkZ: number;
  landmarkName: string;
  biome: string;
  ownerId: string;
  ownerName: string;
  ownerRole: 'player' | 'npc_ally';
  stability: number;
  guardCount: number;
  areaSqMeters: number;
  isSelected?: boolean;
}

export interface GuildKingdom {
  id: string;
  name: string;
  bannerIcon: string;
  bannerColor: string;
  capitalChunkKey: string;
  capitalLandmarkName: string;
  mergedChunkKeys: string[]; // Minimum 6 territories
  totalTerritoryAreaSqMeters: number;
  establishedAt: string;
  rulerName: string;
  rulerRole: string;
  kingdomLevel: number;
  buildings: KingdomBuilding[];
  resources: {
    wood: number;
    stone: number;
    aether: number;
    crops: number;
  };
  defenseRating: number;
  stabilityRating: number;
  passiveIncomeGoldPerHour: number;
  sovereignBuffs: string[];
}

export interface GuildData {
  id: string;
  name: string;
  tag: string;
  motd: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  members: GuildMember[];
  bank: GuildBank;
  alliances: GuildAlliance[];
  goals: GuildGoal[];
  kingdom: GuildKingdom | null;
  unlockedPerks: string[];
}
