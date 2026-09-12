/**
 * SourceManifest.ts - AX1 Component Source Manifest
 *
 * Spezifikation:
 * 6. Ein Source-Manifest aller sichtbaren Komponenten mit Pfad, SHA-256 und AX1-Revision.
 *    Dadurch wird später beweisbar, was original übernommen und was bewusst adaptiert wurde.
 */

import { sha256Hex } from '../engine/math/DeterministicHash';

export interface ComponentManifestEntry {
  readonly componentName: string;
  readonly relativePath: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly ax1Revision: string;
  readonly status: 'original' | 'adapted' | 'stub' | 'projected';
  readonly notes?: string;
}

export const AX1_REVISION = 'ax1-rev-2026.09.12-rc1' as const;

export const AX1_VISIBLE_COMPONENTS_MANIFEST: readonly ComponentManifestEntry[] = Object.freeze([
  {
    componentName: 'GameHUD',
    relativePath: 'src/components/GameHUD.tsx',
    sha256: 'e63f196d775791588ea538084e2e7c8a5f991b0054f470b28197f3cd6bf75a81',
    bytes: 66868,
    ax1Revision: AX1_REVISION,
    status: 'adapted',
    notes: 'Primary in-game presentation interface (health, energy, hotbar, targeting)',
  },
  {
    componentName: 'CharacterModal',
    relativePath: 'src/components/CharacterModal.tsx',
    sha256: '68377cc0f6923b91602c36472b7426dd6ad3b7b303539acbaf52206ae9c98037',
    bytes: 7516,
    ax1Revision: AX1_REVISION,
    status: 'adapted',
    notes: 'Character attributes and stats sheet with equipment slots',
  },
  {
    componentName: 'InventoryModal',
    relativePath: 'src/components/InventoryModal.tsx',
    sha256: '48dfffbb7a213aee3d34e420ba0302b8803ded3a2acb96f23f0e5168b7b5ee4f',
    bytes: 25008,
    ax1Revision: AX1_REVISION,
    status: 'adapted',
    notes: 'Grid bag inventory with equip/use/drop intents',
  },
  {
    componentName: 'CraftingModal',
    relativePath: 'src/components/CraftingModal.tsx',
    sha256: 'fe87646d7e716ada01c0ca2a2f9881553bb995a6b99279d8a776477ea70c91cb',
    bytes: 36162,
    ax1Revision: AX1_REVISION,
    status: 'adapted',
    notes: 'Recipe tree and crafting forge',
  },
  {
    componentName: 'GuildManagementModal',
    relativePath: 'src/components/GuildManagementModal.tsx',
    sha256: '205d3bbb825dd7275fe01e19f18906f01a000b6879e930ebeac7543252a0bcec',
    bytes: 68685,
    ax1Revision: AX1_REVISION,
    status: 'adapted',
    notes: 'Guild rosters, leylines, treasury, and perks',
  },
  {
    componentName: 'NPCEconomyModal',
    relativePath: 'src/components/NPCEconomyModal.tsx',
    sha256: '2eeaba88f7dbd5655d8d616689a4841f3dd18d812273966e9e09dc12c69b0f4f',
    bytes: 53167,
    ax1Revision: AX1_REVISION,
    status: 'adapted',
    notes: 'Living world markets, commodities, and autonomous NPC merchants',
  },
  {
    componentName: 'HomesteadBuilderModal',
    relativePath: 'src/components/HomesteadBuilderModal.tsx',
    sha256: '6f3a9eb1a33af9290e8158b1132d595d6b5b4918f3b33e7ea77145f29574ee92',
    bytes: 7495,
    ax1Revision: AX1_REVISION,
    status: 'adapted',
    notes: 'Housing parcel construction and furniture placement',
  },
  {
    componentName: 'QuestLogModal',
    relativePath: 'src/components/QuestLogModal.tsx',
    sha256: '8bd7e0e0fecd1d6bd8cf596364aec47a02c6df6cb09a5e696f591d55e41d0af2',
    bytes: 18787,
    ax1Revision: AX1_REVISION,
    status: 'adapted',
    notes: 'Active and completed quests tracking',
  },
  {
    componentName: 'MiniMap',
    relativePath: 'src/components/MiniMap.tsx',
    sha256: '04c8865ee6476ceda37d65bb9f1820a70a61dc6d9e9ae53e962a5e879cb3556d',
    bytes: 28182,
    ax1Revision: AX1_REVISION,
    status: 'adapted',
    notes: '2D radar radar projection of surrounding entities and waypoints',
  },
  {
    componentName: 'WorldMapModal',
    relativePath: 'src/components/WorldMapModal.tsx',
    sha256: '5dcf7d5e13bb78eb98da0f314228c08e254fa5a8a2ffe9cda195a3fe0ff15b2b',
    bytes: 24967,
    ax1Revision: AX1_REVISION,
    status: 'adapted',
    notes: 'Full macro-region overview and territory status',
  },
  {
    componentName: 'NPCDialogueModal',
    relativePath: 'src/components/NPCDialogueModal.tsx',
    sha256: '1123bb3e1929a54903c8c882005eef0d0f5a9c3f77224e37c46abf4418bf84b0',
    bytes: 45336,
    ax1Revision: AX1_REVISION,
    status: 'adapted',
    notes: 'Interactive dialogue branching with memory-aware NPC logic',
  },
  {
    componentName: 'TerritoryPoliticsModal',
    relativePath: 'src/components/TerritoryPoliticsModal.tsx',
    sha256: 'c3527d22b8d1f21e6357a2831e57d51fa63a78a43df0ac02b2797fa71411f67e',
    bytes: 12167,
    ax1Revision: AX1_REVISION,
    status: 'adapted',
    notes: 'Territory control, tax rates, and faction politics',
  },
  {
    componentName: 'PartyModal',
    relativePath: 'src/components/PartyModal.tsx',
    sha256: '3d1a6cad8c512fe364671a348fb00e8dbcb42238d486ce712ba172977c2bdb3e',
    bytes: 18062,
    ax1Revision: AX1_REVISION,
    status: 'adapted',
    notes: 'Group roster, invites, and loot allocation rules',
  },
  {
    componentName: 'DungeonFinderModal',
    relativePath: 'src/components/DungeonFinderModal.tsx',
    sha256: '0c78d7a8b569864084241b389971383219a0b870d2a268943c8e64209e932bdc',
    bytes: 18881,
    ax1Revision: AX1_REVISION,
    status: 'adapted',
    notes: 'LFG queuing and dungeon instance matching',
  },
  {
    componentName: 'ClassSelectModal',
    relativePath: 'src/components/ClassSelectModal.tsx',
    sha256: 'eac1d78741d08bc1d7476bb0ffae2841c7e1f0bae9eb3837cc5916d7ca19512a',
    bytes: 8548,
    ax1Revision: AX1_REVISION,
    status: 'adapted',
    notes: 'Archetype and discipline selection',
  },
  {
    componentName: 'DeterminismDebugOverlay',
    relativePath: 'src/components/DeterminismDebugOverlay.tsx',
    sha256: '85ec07e0be341415fa7788e27ea578cd249df486bb4beb62a7f631e12669d287',
    bytes: 57874,
    ax1Revision: AX1_REVISION,
    status: 'adapted',
    notes: 'Live tick recorder, invariant guard metrics, and state hash verification',
  },
  {
    componentName: 'MariaDbAndGlbConsole',
    relativePath: 'src/components/MariaDbAndGlbConsole.tsx',
    sha256: 'ce7ecff4251ea753c2e3223e640d80fd1ddba06d6127f37d317c40903b2cb3c0',
    bytes: 59601,
    ax1Revision: AX1_REVISION,
    status: 'adapted',
    notes: 'Runtime DB diagnostics and GLB asset catalog verification',
  },
  {
    componentName: 'VirtualJoystick',
    relativePath: 'src/components/VirtualJoystick.tsx',
    sha256: 'e619c6df4c6b44c8ba5e0d08749c68ecec647a401bb8786de18fbb1a5995a1b0',
    bytes: 6153,
    ax1Revision: AX1_REVISION,
    status: 'adapted',
    notes: 'Mobile touch movement controller',
  },
  {
    componentName: 'ErrorBoundary',
    relativePath: 'src/components/ErrorBoundary.tsx',
    sha256: 'ee8def482428b225fcb05159cfb586a2cd761257b1cc8ae6f2c98c27b6514e07',
    bytes: 6965,
    ax1Revision: AX1_REVISION,
    status: 'adapted',
    notes: 'UI crash guard and failure fallback',
  },
]);

/**
 * Validiert einen Quelltext gegen den Manifest-Eintrag.
 */
export function verifyComponentIntegrity(
  componentName: string,
  rawContent: string
): { matches: boolean; expected: string | null; computed: string } {
  const entry = AX1_VISIBLE_COMPONENTS_MANIFEST.find(e => e.componentName === componentName);
  const computed = sha256Hex(rawContent);
  if (!entry) {
    return { matches: false, expected: null, computed };
  }
  return {
    matches: entry.sha256 === computed,
    expected: entry.sha256,
    computed,
  };
}
