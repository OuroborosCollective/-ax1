import React, { useState } from 'react';
import {
  Package,
  Shield,
  Sword,
  Sparkles,
  Heart,
  Zap,
  Footprints,
  X,
  ArrowUpDown,
  Flame,
  Check,
  Tag,
  Boxes,
  Hammer,
} from 'lucide-react';
import { EquipmentState, ItemSlot, RPGItem } from '../types';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: EquipmentState;
  inventory: RPGItem[];
  gold: number;
  onEquip: (item: RPGItem) => void;
  onUnequip: (slot: keyof EquipmentState) => void;
  onUseConsumable: (item: RPGItem) => void;
  onDiscard: (itemId: string) => void;
  onSortInventory?: (sortBy: 'rarity' | 'name') => void;
  autoLootEnabled?: boolean;
  onToggleAutoLoot?: () => void;
  pityCounters?: Record<string, number>;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  equipment,
  inventory,
  gold,
  onEquip,
  onUnequip,
  onUseConsumable,
  onDiscard,
  onSortInventory,
  autoLootEnabled = true,
  onToggleAutoLoot,
  pityCounters = {},
}) => {
  const [selectedItem, setSelectedItem] = useState<RPGItem | null>(null);
  const [bagFilter, setBagFilter] = useState<'all' | 'gear' | 'materials' | 'consumables' | 'furniture'>('all');
  const [sortNotice, setSortNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalBagSlots = 30;
  const emptySlotsCount = Math.max(0, totalBagSlots - inventory.length);

  // Compute overall character Gear Score based on equipped armaments
  const calculateGearScore = (): number => {
    let score = 0;
    const slots: (keyof EquipmentState)[] = [
      'weapon',
      'shield',
      'helmet',
      'shoulders',
      'chest',
      'arms',
      'legs',
      'boots',
      'relic',
      'mount',
    ];

    for (const s of slots) {
      const it = equipment[s];
      if (it) {
        const statsSum = Object.values(it.stats || {}).reduce<number>(
          (acc, val) => acc + (typeof val === 'number' ? val : 0),
          0
        );
        const rarityMult =
          it.rarity === 'legendary'
            ? 3.5
            : it.rarity === 'epic'
            ? 2.5
            : it.rarity === 'rare'
            ? 1.8
            : it.rarity === 'uncommon'
            ? 1.3
            : 1.0;
        score += Math.round((it.levelReq * 10 + statsSum * 2) * rarityMult);
      }
    }
    return score;
  };

  const gearScore = calculateGearScore();

  const getRarityBadge = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return 'text-amber-400 border-amber-500/80 bg-amber-950/40 shadow-[0_0_10px_rgba(245,158,11,0.3)]';
      case 'epic':
        return 'text-purple-400 border-purple-500/80 bg-purple-950/40 shadow-[0_0_10px_rgba(168,85,247,0.3)]';
      case 'rare':
        return 'text-cyan-400 border-cyan-500/80 bg-cyan-950/40 shadow-[0_0_10px_rgba(6,182,212,0.3)]';
      case 'uncommon':
        return 'text-emerald-400 border-emerald-500/80 bg-emerald-950/40';
      default:
        return 'text-gray-300 border-gray-700 bg-gray-900/40';
    }
  };

  const handleSort = (type: 'rarity' | 'name') => {
    if (onSortInventory) {
      onSortInventory(type);
      setSortNotice(`Tasche sortiert nach: ${type === 'rarity' ? 'Seltenheit' : 'Alphabet'}`);
      setTimeout(() => setSortNotice(null), 2500);
    }
  };

  // Filter bag items
  const filteredInventory = inventory.filter((item) => {
    if (bagFilter === 'all') return true;
    if (bagFilter === 'gear')
      return [
        'weapon',
        'shield',
        'offhand',
        'helmet',
        'head',
        'shoulders',
        'chest',
        'arms',
        'gloves',
        'legs',
        'boots',
        'shoes',
        'relic',
        'ring',
        'amulet',
        'mount',
      ].includes(item.slot);
    if (bagFilter === 'materials') return item.slot === 'material' || item.slot === 'tool';
    if (bagFilter === 'consumables') return item.slot === 'consumable';
    if (bagFilter === 'furniture') return item.slot === 'furniture';
    return true;
  });

  // Render Paperdoll Slot
  const renderPaperdollSlot = (
    slot: keyof EquipmentState,
    label: string,
    defaultIcon: React.ReactNode,
    side: 'left' | 'right' | 'center'
  ) => {
    const item = equipment[slot];
    const isSelected = selectedItem?.id === item?.id && !!item;

    return (
      <div
        onClick={() => item && setSelectedItem(item)}
        className={`group relative p-1.5 rounded-xl border flex items-center gap-2 transition-all cursor-pointer select-none ${
          item
            ? isSelected
              ? 'border-amber-400 bg-amber-500/20 ring-2 ring-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.35)]'
              : `${getRarityBadge(item.rarity)} hover:border-amber-400/80 bg-black/60`
            : 'border-gray-800 bg-black/40 hover:border-gray-700'
        }`}
      >
        <div className="w-9 h-9 rounded-lg bg-black/70 border border-gray-800 flex items-center justify-center text-lg shrink-0 text-gray-500 group-hover:text-gray-300">
          {item ? item.icon : defaultIcon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase font-mono text-gray-400 tracking-wider flex items-center justify-between">
            <span>{label}</span>
            {item && (
              <span className="text-[8px] px-1 rounded bg-black/60 font-mono text-[#00f0ff]">
                Lvl {item.levelReq}
              </span>
            )}
          </div>
          <div className="text-[11px] font-serif font-bold text-gray-100 truncate">
            {item ? item.name : <span className="text-gray-600 italic font-normal">Leer</span>}
          </div>
        </div>

        {item && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnequip(slot);
              if (selectedItem?.id === item.id) setSelectedItem(null);
            }}
            title="Ausrüstung ablegen"
            className="text-[9px] px-1.5 py-1 bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 rounded font-mono transition-colors shrink-0"
          >
            Ablegen
          </button>
        )}
      </div>
    );
  };

  return (
    <div id="inventory-modal-overlay" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div
        id="inventory-dialog"
        className="w-full max-w-5xl bg-[#081a2e] border-2 border-amber-500/50 rounded-2xl p-4 sm:p-5 text-gray-200 shadow-[0_0_50px_rgba(0,240,255,0.2)] flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-serif font-bold text-white flex items-center gap-2 tracking-wide">
                INVENTAR & PAPERDOLL-RÜSTKAMMER
              </h3>
              <p className="text-[11px] text-gray-400 font-sans">
                Verwalte deine Waffen, Rüstungen, gesammelten Rohstoffe & gefertigten Möbel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-xl bg-black/70 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold flex items-center gap-1.5 shadow-inner">
              <span>🪙</span>
              <span>{gold.toLocaleString()} Gold</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-black/50 border border-gray-800 hover:border-amber-500 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3-Column Layout: Paperdoll Equipment | Bag Grid | Item Inspector */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 py-3 min-h-0 overflow-y-auto custom-scrollbar">
          
          {/* COLUMN 1: Paperdoll Equipment (5 cols) */}
          <div className="lg:col-span-5 bg-black/50 rounded-2xl border border-gray-800 p-3.5 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <div className="text-[11px] font-serif font-bold text-amber-300 uppercase tracking-widest flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#00f0ff]" /> Paperdoll-Ausrüstung
              </div>
              <div className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Gear Score: <strong className="text-[#00f0ff]">{gearScore}</strong>
              </div>
            </div>

            {/* Symmetrical Paperdoll Layout */}
            <div className="grid grid-cols-2 gap-2 flex-1 overflow-y-auto pr-1">
              {/* Left Column: Helm, Shoulders, Chest, Arms, Weapon */}
              <div className="space-y-1.5">
                {renderPaperdollSlot('helmet', 'Kopfschutz', <Sparkles className="w-3.5 h-3.5" />, 'left')}
                {renderPaperdollSlot('shoulders', 'Schultern', <Shield className="w-3.5 h-3.5" />, 'left')}
                {renderPaperdollSlot('chest', 'Brustharnisch', <Heart className="w-3.5 h-3.5" />, 'left')}
                {renderPaperdollSlot('arms', 'Armschienen', <Sword className="w-3.5 h-3.5" />, 'left')}
                {renderPaperdollSlot('weapon', 'Haupthand-Waffe', <Sword className="w-3.5 h-3.5" />, 'left')}
              </div>

              {/* Right Column: Relic, Off-Hand, Ring/Legs, Boots, Mount */}
              <div className="space-y-1.5">
                {renderPaperdollSlot('relic', 'Relikt / Amulett', <Zap className="w-3.5 h-3.5" />, 'right')}
                {renderPaperdollSlot('shield', 'Schild / Nebenhand', <Shield className="w-3.5 h-3.5" />, 'right')}
                {renderPaperdollSlot('legs', 'Beinschienen', <Footprints className="w-3.5 h-3.5" />, 'right')}
                {renderPaperdollSlot('boots', 'Stiefel', <Footprints className="w-3.5 h-3.5" />, 'right')}
                {renderPaperdollSlot('mount', 'Reittier', <span>♞</span>, 'center')}
              </div>
            </div>

            {/* Paperdoll Footer Stats Badge */}
            <div className="p-2 rounded-xl bg-black/60 border border-gray-800 text-[10px] font-mono text-gray-400 flex items-center justify-between">
              <span>Silhouetten-Harmonie: <strong className="text-emerald-400">Optimal</strong></span>
              <span className="text-[#00f0ff]">Aurion-Resonanz 100%</span>
            </div>
          </div>

          {/* COLUMN 2: Bag Grid & Categorized Tabs (4 cols) */}
          <div className="lg:col-span-4 bg-black/60 rounded-2xl border border-gray-800 p-3 flex flex-col">
            {/* Bag Header & Filter Tabs */}
            <div className="space-y-2 pb-2 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-serif font-bold text-amber-300 uppercase tracking-widest flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-[#00f0ff]" /> Abenteurertasche ({inventory.length}/{totalBagSlots})
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleSort('rarity')}
                    title="Nach Seltenheit sortieren"
                    className="p-1 rounded bg-black/60 hover:bg-gray-800 border border-gray-700 text-gray-300 text-[10px] font-mono cursor-pointer"
                  >
                    Seltenheit
                  </button>
                  <button
                    onClick={() => handleSort('name')}
                    title="Alphabetisch sortieren"
                    className="p-1 rounded bg-black/60 hover:bg-gray-800 border border-gray-700 text-gray-300 text-[10px] font-mono cursor-pointer"
                  >
                    Name
                  </button>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap gap-1 text-[10px] font-serif">
                {(
                  [
                    { id: 'all', label: 'Alle' },
                    { id: 'gear', label: 'Rüstung' },
                    { id: 'materials', label: 'Rohstoffe' },
                    { id: 'consumables', label: 'Tränke' },
                    { id: 'furniture', label: 'Möbel' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setBagFilter(f.id)}
                    className={`px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                      bagFilter === f.id
                        ? 'bg-[#00f0ff]/20 border-[#00f0ff] text-[#00f0ff] font-bold'
                        : 'bg-black/40 border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort Feedback */}
            {sortNotice && (
              <div className="mt-1.5 py-1 px-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[10px] font-mono flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>{sortNotice}</span>
              </div>
            )}

            {/* Bag Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 pt-2.5 flex-1 overflow-y-auto custom-scrollbar pr-1">
              {filteredInventory.map((item, index) => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <button
                    key={`${item.id}_${index}`}
                    onClick={() => setSelectedItem(item)}
                    className={`aspect-square rounded-xl border p-1 flex flex-col items-center justify-between transition-all cursor-pointer relative group ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/20 ring-2 ring-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                        : `${getRarityBadge(item.rarity)} hover:scale-105`
                    }`}
                  >
                    <span className="text-xl drop-shadow mt-1">{item.icon}</span>
                    <span className="text-[8.5px] font-mono truncate w-full text-center text-gray-300 leading-none pb-0.5">
                      {item.name.split(' ')[0]}
                    </span>
                    {(item.quantity || 1) > 1 && (
                      <span className="absolute top-1 right-1 text-[8px] font-mono px-1 rounded bg-black/90 text-[#00f0ff] border border-gray-800">
                        x{item.quantity}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Empty Bag Slots */}
              {Array.from({ length: emptySlotsCount }).map((_, idx) => (
                <div
                  key={`empty_${idx}`}
                  className="aspect-square rounded-xl border border-gray-800/40 bg-black/20 flex items-center justify-center text-gray-700 text-xs font-mono"
                >
                  ·
                </div>
              ))}
            </div>

            {/* Quality of Life: Auto-Loot & Pity System Control */}
            <div className="mt-2.5 pt-2 border-t border-gray-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-black/40 p-2 rounded-xl border border-gray-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <div className="text-[10px] font-mono leading-tight">
                  <span className="text-gray-200 font-bold">Auto-Loot (Gewöhnlich):</span>{' '}
                  <span className={autoLootEnabled ? 'text-emerald-400' : 'text-gray-500'}>
                    {autoLootEnabled ? 'AKTIVIERT' : 'DEAKTIVIERT'}
                  </span>
                </div>
              </div>

              {onToggleAutoLoot && (
                <button
                  id="btn-inventory-toggle-autoloot"
                  onClick={onToggleAutoLoot}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    autoLootEnabled
                      ? 'bg-emerald-950 border border-emerald-500/60 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                      : 'bg-gray-900 border border-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  {autoLootEnabled ? 'Eingeschaltet [U]' : 'Ausschalten [U]'}
                </button>
              )}
            </div>

            {/* Pity Counter Overview */}
            {Object.keys(pityCounters).length > 0 && (
              <div className="mt-1.5 p-2 rounded-xl bg-amber-950/20 border border-amber-500/30 text-[9px] font-mono">
                <div className="text-amber-300 font-bold flex items-center justify-between pb-1 border-b border-amber-500/20">
                  <span>★ Schicksals-Mitleid (Pity Guarantee)</span>
                  <span className="text-gray-400">Garantie bei 50</span>
                </div>
                <div className="space-y-1 pt-1 max-h-20 overflow-y-auto pr-1 no-scrollbar">
                  {Object.entries(pityCounters).map(([mobType, count]) => {
                    const pct = Math.min(100, Math.round((count / 50) * 100));
                    return (
                      <div key={mobType} className="flex items-center justify-between">
                        <span className="text-gray-300 capitalize truncate">{mobType}</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-black rounded-full border border-gray-800 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`font-bold ${count >= 40 ? 'text-amber-300 animate-pulse' : 'text-gray-400'}`}>
                            {count}/50
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* COLUMN 3: Item Inspector & Action Terminal (3 cols) */}
          <div className="lg:col-span-3 bg-black/70 rounded-2xl border border-gray-800 p-4 flex flex-col justify-between shadow-inner">
            {selectedItem ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl border flex items-center justify-center text-2xl ${getRarityBadge(
                      selectedItem.rarity
                    )}`}
                  >
                    {selectedItem.icon}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-serif font-bold text-white truncate leading-tight">
                      {selectedItem.name}
                    </h4>
                    <span
                      className={`inline-block text-[9px] font-mono uppercase font-bold px-1.5 py-0.5 rounded border mt-1 ${getRarityBadge(
                        selectedItem.rarity
                      )}`}
                    >
                      {selectedItem.rarity} • {selectedItem.slot}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-400 font-sans italic leading-relaxed border-t border-gray-800/80 pt-2">
                  "{selectedItem.description}"
                </p>

                {/* Stats Breakdown */}
                <div className="bg-black/60 rounded-xl p-2.5 border border-gray-800 space-y-1 text-xs font-mono">
                  {selectedItem.stats?.attack && (
                    <div className="text-amber-300">⚔️ +{selectedItem.stats.attack} Angriffskraft</div>
                  )}
                  {selectedItem.stats?.spellPower && (
                    <div className="text-purple-300">🔮 +{selectedItem.stats.spellPower} Zauberkraft</div>
                  )}
                  {selectedItem.stats?.armor && (
                    <div className="text-cyan-300">🛡️ +{selectedItem.stats.armor} Rüstung</div>
                  )}
                  {selectedItem.stats?.maxHp && (
                    <div className="text-red-300">❤️ +{selectedItem.stats.maxHp} Lebenspunkte</div>
                  )}
                  {selectedItem.stats?.critChance && (
                    <div className="text-yellow-300">🎯 +{selectedItem.stats.critChance}% Krit-Chance</div>
                  )}
                  {selectedItem.stats?.moveSpeed && (
                    <div className="text-emerald-300">💨 +{selectedItem.stats.moveSpeed}% Tempo</div>
                  )}
                  {selectedItem.effectDescription && (
                    <div className="text-amber-300 text-[11px] font-sans pt-1 border-t border-gray-800">
                      ★ {selectedItem.effectDescription}
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-gray-400 font-mono flex items-center justify-between pt-1">
                  <span>Händlerwert:</span>
                  <span className="text-amber-300 font-bold">🪙 {selectedItem.valueGold} Gold</span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 py-10">
                <Package className="w-10 h-10 mb-2 opacity-40 text-amber-500" />
                <span className="text-xs font-serif">
                  Wähle ein Rüstungsteil oder Item in der Tasche zur Inspektion aus.
                </span>
              </div>
            )}

            {/* Action Buttons */}
            {selectedItem && (
              <div className="space-y-2 pt-3 border-t border-gray-800">
                {selectedItem.slot === 'consumable' ? (
                  <button
                    onClick={() => {
                      onUseConsumable(selectedItem);
                      setSelectedItem(null);
                    }}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-serif font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                  >
                    Trinken / Anwenden
                  </button>
                ) : selectedItem.slot === 'furniture' || selectedItem.slot === 'material' ? (
                  <div className="p-2 rounded-xl bg-black/50 border border-gray-800 text-[11px] font-mono text-gray-400 text-center">
                    Handwerksgut / Mobiliar für Residenzen & Bauherren
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      onEquip(selectedItem);
                      setSelectedItem(null);
                    }}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:brightness-110 text-black font-serif font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                  >
                    Ausrüsten
                  </button>
                )}

                <button
                  onClick={() => {
                    onDiscard(selectedItem.id);
                    setSelectedItem(null);
                  }}
                  className="w-full py-1.5 rounded-xl bg-black/60 border border-red-900/60 hover:bg-red-950 text-red-400 font-mono text-xs transition-colors cursor-pointer"
                >
                  Gegenstand wegwerfen
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
