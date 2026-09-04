import React, { useState } from 'react';
import { X, Shield, Sparkles, Sword, Footprints, Heart, Package, Zap, ArrowUpDown, Tag } from 'lucide-react';
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
  onSortInventory?: (sortBy: 'rarity' | 'name' | 'type') => void;
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
}) => {
  const [selectedItem, setSelectedItem] = useState<RPGItem | null>(null);
  const [sortNotice, setSortNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalBagSlots = 24;
  const emptySlotsCount = Math.max(0, totalBagSlots - inventory.length);

  const handleSort = (mode: 'rarity' | 'name' | 'type') => {
    onSortInventory?.(mode);
    setSortNotice(
      mode === 'rarity'
        ? 'Sorted by Rarity (Legendary → Common)'
        : mode === 'name'
        ? 'Sorted by Name (A → Z)'
        : 'Sorted by Equipment Type'
    );
    setTimeout(() => setSortNotice(null), 2500);
  };


  const getRarityBadge = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return 'text-amber-400 bg-amber-950/70 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.3)]';
      case 'epic':
        return 'text-purple-400 bg-purple-950/70 border-purple-500/60 shadow-[0_0_8px_rgba(168,85,247,0.3)]';
      case 'rare':
        return 'text-blue-400 bg-blue-950/70 border-blue-500/60';
      case 'uncommon':
        return 'text-emerald-400 bg-emerald-950/70 border-emerald-500/60';
      default:
        return 'text-gray-300 bg-gray-900 border-gray-700';
    }
  };

  const renderEquipSlot = (slot: keyof EquipmentState, label: string, icon: React.ReactNode) => {
    const item = equipment[slot];
    return (
      <div
        onClick={() => item && setSelectedItem(item)}
        className={`relative p-2.5 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
          item
            ? `${getRarityBadge(item.rarity)} hover:scale-[1.02]`
            : 'bg-black/40 border-gray-800/80 hover:border-gray-700 text-gray-500'
        }`}
      >
        <div className="w-10 h-10 rounded-lg bg-black/60 border border-gray-700 flex items-center justify-center text-lg flex-shrink-0">
          {item ? item.icon : icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase font-mono text-gray-400 tracking-wider">{label}</div>
          <div className="text-xs font-bold text-gray-200 truncate">
            {item ? item.name : <span className="text-gray-600 font-normal italic">Empty Slot</span>}
          </div>
        </div>
        {item && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnequip(slot);
              if (selectedItem?.id === item.id) setSelectedItem(null);
            }}
            className="text-[10px] px-2 py-1 bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 rounded font-mono transition-colors"
          >
            Unequip
          </button>
        )}
      </div>
    );
  };

  return (
    <div id="inventory-modal-overlay" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div
        id="inventory-dialog"
        className="w-full max-w-5xl bg-[#11141a] border border-[#b8860b]/40 rounded-2xl p-5 sm:p-6 text-gray-200 shadow-[0_0_40px_rgba(184,134,11,0.15)] flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-black/80 border-2 border-[#b8860b] flex items-center justify-center text-[#b8860b] shadow-[0_0_12px_rgba(184,134,11,0.25)]">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-serif font-bold text-white flex items-center gap-2">
                INVENTORY & EQUIPMENT
              </h3>
              <p className="text-xs text-gray-400 font-sans">
                Manage your armaments, relics, and consumables
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-3.5 py-1.5 rounded-lg bg-black/70 border border-[#b8860b]/40 text-[#fbbf24] font-mono text-sm font-bold flex items-center gap-1.5">
              <span>🪙</span>
              <span>{gold.toLocaleString()} Gold</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-black/50 border border-gray-800 hover:border-[#b8860b] text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3-Column Layout: Equipment | Bag Grid | Item Inspector */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 py-4 min-h-0 overflow-y-auto">
          {/* Column 1: Equipped Gear (4 cols) */}
          <div className="lg:col-span-4 bg-black/50 rounded-xl border border-gray-800/90 p-3.5 flex flex-col space-y-2.5">
            <div className="text-[11px] font-serif font-bold text-[#b8860b] uppercase tracking-widest px-1 pb-1 border-b border-gray-800/80 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#b8860b]" /> Equipped Armaments
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              {renderEquipSlot('weapon', 'Main Hand Weapon', <Sword className="w-4 h-4" />)}
              {renderEquipSlot('shield', 'Off-Hand / Shield', <Shield className="w-4 h-4" />)}
              {renderEquipSlot('helmet', 'Helmet / Headgear', <Sparkles className="w-4 h-4" />)}
              {renderEquipSlot('shoulders', 'Pauldrons / Shoulders', <Shield className="w-4 h-4" />)}
              {renderEquipSlot('chest', 'Chest Cuirass / Armor', <Heart className="w-4 h-4" />)}
              {renderEquipSlot('arms', 'Gauntlets / Vambraces', <Sword className="w-4 h-4" />)}
              {renderEquipSlot('legs', 'Leg Greaves / Plating', <Footprints className="w-4 h-4" />)}
              {renderEquipSlot('boots', 'Mechanized Boots', <Footprints className="w-4 h-4" />)}
              {renderEquipSlot('relic', 'Ancient Relic / Ring', <Zap className="w-4 h-4" />)}
              {renderEquipSlot('mount', 'Summonable Mount', <span>♞</span>)}
            </div>
          </div>

          {/* Column 2: Bag Grid (5 cols) */}
          <div className="lg:col-span-5 bg-black/60 rounded-xl border border-gray-800/90 p-3.5 flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2 border-b border-gray-800/80">
              <div className="text-[11px] font-serif font-bold text-[#b8860b] uppercase tracking-widest flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-[#b8860b]" /> Adventurer Bag ({inventory.length} / {totalBagSlots})
              </div>

              {/* Auto-Sort Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleSort('rarity')}
                  title="Auto-sort inventory by Rarity (Legendary to Common)"
                  className="px-2 py-1 rounded bg-amber-950/70 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-[10px] font-mono flex items-center gap-1 transition-all cursor-pointer shadow-sm hover:scale-102"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" /> Sort Rarity
                </button>
                <button
                  onClick={() => handleSort('name')}
                  title="Auto-sort inventory by Name (A to Z)"
                  className="px-2 py-1 rounded bg-black/70 hover:bg-gray-800 border border-gray-700 text-gray-300 text-[10px] font-mono flex items-center gap-1 transition-all cursor-pointer"
                >
                  <ArrowUpDown className="w-3 h-3" /> Sort Name
                </button>
              </div>
            </div>

            {/* Sort Feedback Notice */}
            {sortNotice && (
              <div className="mt-2 py-1 px-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[10px] font-mono flex items-center gap-1.5 animate-in fade-in duration-150">
                <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{sortNotice}</span>
              </div>
            )}


            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-3 flex-1 overflow-y-auto pr-1">
              {inventory.map((item, index) => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <button
                    key={`${item.id}_${index}`}
                    onClick={() => setSelectedItem(item)}
                    className={`aspect-square rounded-xl border p-1.5 flex flex-col items-center justify-center transition-all cursor-pointer relative group ${
                      isSelected
                        ? 'border-[#fbbf24] bg-black/90 ring-2 ring-[#fbbf24]/50 shadow-[0_0_12px_rgba(251,191,36,0.3)]'
                        : `${getRarityBadge(item.rarity)} hover:scale-105`
                    }`}
                  >
                    <span className="text-2xl drop-shadow">{item.icon}</span>
                    <span className="text-[9px] font-mono truncate w-full text-center text-gray-300 mt-1 leading-none">
                      {item.name.split(' ')[0]}
                    </span>
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
          </div>

          {/* Column 3: Item Inspector & Actions (3 cols) */}
          <div className="lg:col-span-3 bg-black/70 rounded-xl border border-gray-800/90 p-4 flex flex-col justify-between shadow-inner">
            {selectedItem ? (
              <div className="space-y-3.5">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center text-2xl ${getRarityBadge(selectedItem.rarity)}`}>
                    {selectedItem.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-serif font-bold text-white leading-tight">{selectedItem.name}</h4>
                    <span className={`inline-block text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded border mt-1 ${getRarityBadge(selectedItem.rarity)}`}>
                      {selectedItem.rarity} {selectedItem.slot}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-400 font-sans italic leading-relaxed border-t border-gray-800 pt-2">
                  "{selectedItem.description}"
                </p>

                {/* Stats Breakdown */}
                <div className="bg-black/60 rounded-lg p-2.5 border border-gray-800/80 space-y-1 text-xs font-mono">
                  {selectedItem.stats.attack && <div className="text-amber-300">⚔️ +{selectedItem.stats.attack} Attack Power</div>}
                  {selectedItem.stats.spellPower && <div className="text-purple-300">🔮 +{selectedItem.stats.spellPower} Spell Power</div>}
                  {selectedItem.stats.armor && <div className="text-cyan-300">🛡️ +{selectedItem.stats.armor} Armor Rating</div>}
                  {selectedItem.stats.maxHp && <div className="text-red-300">❤️ +{selectedItem.stats.maxHp} Max Health</div>}
                  {selectedItem.stats.critChance && <div className="text-yellow-300">🎯 +{selectedItem.stats.critChance}% Crit Chance</div>}
                  {selectedItem.stats.moveSpeed && <div className="text-emerald-300">💨 +{selectedItem.stats.moveSpeed}% Movement Speed</div>}
                  {selectedItem.effectDescription && (
                    <div className="text-amber-400 text-[11px] font-sans pt-1 border-t border-gray-800">
                      ★ {selectedItem.effectDescription}
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-gray-400 font-mono flex items-center justify-between">
                  <span>Vendor Value:</span>
                  <span className="text-[#fbbf24] font-bold">🪙 {selectedItem.valueGold} Gold</span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 py-12">
                <Package className="w-10 h-10 mb-2 opacity-40 text-[#b8860b]" />
                <span className="text-xs font-serif">Select any gear or item to inspect stats and actions.</span>
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
                    className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-serif font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                  >
                    Drink / Consume
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onEquip(selectedItem);
                      setSelectedItem(null);
                    }}
                    className="w-full py-2 rounded-lg bg-gradient-to-r from-[#b8860b] to-[#8a6508] hover:from-[#d4af37] hover:to-[#b8860b] text-black font-serif font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(184,134,11,0.25)]"
                  >
                    Equip Item
                  </button>
                )}

                <button
                  onClick={() => {
                    onDiscard(selectedItem.id);
                    setSelectedItem(null);
                  }}
                  className="w-full py-1.5 rounded-lg bg-black/60 border border-red-900/60 hover:bg-red-950 text-red-400 font-mono text-xs transition-colors cursor-pointer"
                >
                  Discard Item
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
