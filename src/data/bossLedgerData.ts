import { WorldBossRecord } from '../types';

export const INITIAL_WORLD_BOSSES: WorldBossRecord[] = [
  {
    id: 'world_boss_titan_ignis',
    name: 'Titan Ignis the Overclocked',
    title: 'Ur-Feuerkoloss des Leerenkraters & Weltenvernichter',
    zone: 'Void Spire Perimeter / Void Crater',
    level: 15,
    maxHp: 5200,
    icon: '🔥',
    color: '#ef4444',
    coords: { x: 0, z: 65 },
    respawnIntervalSec: 900, // 15 minutes respawn cycle
    lastDefeatedTimestamp: Date.now() - 1000 * 60 * 18, // defeated 18 mins ago by default -> currently respawned/alive
    defeatCount: 3,
    lastSlayerName: 'Aethelgard High Sentinel & Hero Party',
    rareDrops: [
      'Titanen-Feuerkern (Legendär)',
      'Überladene Koloss-Klinge',
      'Flammenverstärkte Panzerung',
      'Glutstein-Amulett',
    ],
    status: 'alive',
  },
  {
    id: 'world_boss_aether_leviathan',
    name: 'Aether Leviathan of the Spire',
    title: 'Schwebender Himmelswurm der oberen Sphären',
    zone: 'Sunwatch Bastion Summit',
    level: 18,
    maxHp: 6800,
    icon: '⚡',
    color: '#00f0ff',
    coords: { x: 75, z: 120 },
    respawnIntervalSec: 1200, // 20 minutes
    lastDefeatedTimestamp: Date.now() - 1000 * 60 * 7, // defeated 7 mins ago -> respawning in 13 mins
    defeatCount: 1,
    lastSlayerName: 'Archmage Thorne & Guild Vanguard',
    rareDrops: [
      'Aether-Gespinst Schleier (Episch)',
      'Blitz-Katalysator Stab',
      'Türkis-Himmelskristall',
    ],
    status: 'respawning',
  },
  {
    id: 'world_boss_malakor_clockwork',
    name: 'Malakor the Clockwork Colossus',
    title: 'Uralter Uhrwerk-Belagerungsbrecher',
    zone: 'Clockwork Woods Sanctum Depth',
    level: 12,
    maxHp: 4400,
    icon: '⚙️',
    color: '#f59e0b',
    coords: { x: -80, z: -40 },
    respawnIntervalSec: 600, // 10 minutes
    lastDefeatedTimestamp: Date.now() - 1000 * 60 * 25, // defeated 25 mins ago -> alive
    defeatCount: 5,
    lastSlayerName: 'Master Artificer Silas',
    rareDrops: [
      'Zahnrad-Reliquie der Vorväter',
      'Bronze-Rampen-Schultern',
      'Dampf-Kolben-Hammer',
    ],
    status: 'alive',
  },
  {
    id: 'world_boss_shadow_reaper_nyx',
    name: 'Nyx, Sovereign of the Umbral Vale',
    title: 'Herrin des Schattenbruchs & Seelenfresserin',
    zone: 'Whispering Forest - Shadow Rift',
    level: 20,
    maxHp: 8500,
    icon: '👁️',
    color: '#a855f7',
    coords: { x: -110, z: 95 },
    respawnIntervalSec: 1800, // 30 minutes
    lastDefeatedTimestamp: null, // Never defeated on this server
    defeatCount: 0,
    lastSlayerName: 'Noch unbesiegt',
    rareDrops: [
      'Schattenkrone der Nacht (Legendär)',
      'Seelenklinge der Leere',
      'Umbral-Reitbestie',
    ],
    status: 'alive',
  },
];
