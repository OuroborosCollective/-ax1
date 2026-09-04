import React, { useState } from 'react';
import { Home, Hammer, CheckCircle, Lock, Shield, Package } from 'lucide-react';
import { HomesteadBlueprint, RPGItem } from '../types';

interface HomesteadBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  blueprints: HomesteadBlueprint[];
  inventory: RPGItem[];
  playerGold: number;
  onBuild: (blueprintId: string) => void;
}

export const HomesteadBuilderModal: React.FC<HomesteadBuilderModalProps> = ({
  isOpen,
  onClose,
  blueprints,
  inventory,
  playerGold,
  onBuild,
}) => {
  if (!isOpen) return null;

  const [selectedBlueprint, setSelectedBlueprint] = useState<HomesteadBlueprint>(blueprints[0]);

  // Check resources (we'll just use a proxy for wood/stone if exact items aren't mapped, but let's assume they are "mat_wood_oak" and "mat_ore_copper" for now)
  const getResourceCount = (name: string) => {
    return inventory
      .filter((it) => it.name.toLowerCase().includes(name.toLowerCase()))
      .reduce((sum, it) => sum + (it.quantity || 1), 0);
  };

  const woodCount = getResourceCount('holz');
  const stoneCount = getResourceCount('erz') + getResourceCount('stein');

  const canAfford = 
    playerGold >= selectedBlueprint.costGold && 
    woodCount >= selectedBlueprint.woodRequired && 
    stoneCount >= selectedBlueprint.stoneRequired;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#040d1a] border border-[#d4af37]/40 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Left Side: Blueprint List */}
        <div className="w-full md:w-1/3 bg-[#020813] border-r border-gray-800 p-4 flex flex-col h-full max-h-[80vh] overflow-y-auto">
          <div className="flex items-center gap-3 mb-6">
            <Home className="w-6 h-6 text-[#d4af37]" />
            <h2 className="text-lg font-serif font-bold text-[#d4af37] uppercase tracking-wider">Homestead Builder</h2>
          </div>
          
          <div className="space-y-3">
            {blueprints.map((bp) => (
              <button
                key={bp.id}
                onClick={() => setSelectedBlueprint(bp)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedBlueprint.id === bp.id
                    ? 'bg-[#00f0ff]/10 border-[#00f0ff]'
                    : 'bg-[#09111c] border-gray-800 hover:border-[#00f0ff]/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-bold font-serif ${selectedBlueprint.id === bp.id ? 'text-[#00f0ff]' : 'text-gray-300'}`}>
                    {bp.name}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-900/40 text-amber-500 border border-amber-500/30">
                    Tier {bp.tier}
                  </span>
                </div>
                <div className="text-xs text-gray-500 truncate">{bp.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Blueprint Details & Build Action */}
        <div className="w-full md:w-2/3 p-6 flex flex-col">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
            <Lock className="w-5 h-5 hidden" /> {/* Placeholder for close if we want X icon, but usually it's X */}
            <span className="text-xl font-bold">&times;</span>
          </button>

          <div className="flex-1">
            <h3 className="text-3xl font-serif font-bold text-white mb-2">{selectedBlueprint.name}</h3>
            <p className="text-sm text-[#00f0ff] mb-6 font-mono tracking-widest uppercase">Architektonischer Entwurf (Stufe {selectedBlueprint.tier})</p>

            <div className="bg-black/40 border border-gray-800 p-4 rounded-xl mb-6">
              <h4 className="text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#d4af37]" /> Heim-Vorteile & Boni
              </h4>
              <p className="text-sm text-gray-400 leading-relaxed">{selectedBlueprint.perks}</p>
            </div>

            <div className="bg-[#09111c] border border-gray-800 p-5 rounded-xl mb-8">
              <h4 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500" /> Benötigte Materialien
              </h4>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col items-center p-3 rounded-lg bg-black/60 border border-gray-800">
                  <span className="text-xs text-gray-500 mb-1">Goldmünzen</span>
                  <span className={`font-mono font-bold text-lg ${playerGold >= selectedBlueprint.costGold ? 'text-amber-400' : 'text-red-500'}`}>
                    {selectedBlueprint.costGold}
                  </span>
                  <span className="text-[10px] text-gray-600 mt-1">Haben: {playerGold}</span>
                </div>
                
                <div className="flex flex-col items-center p-3 rounded-lg bg-black/60 border border-gray-800">
                  <span className="text-xs text-gray-500 mb-1">Holz (Scheite)</span>
                  <span className={`font-mono font-bold text-lg ${woodCount >= selectedBlueprint.woodRequired ? 'text-green-400' : 'text-red-500'}`}>
                    {selectedBlueprint.woodRequired}
                  </span>
                  <span className="text-[10px] text-gray-600 mt-1">Haben: {woodCount}</span>
                </div>

                <div className="flex flex-col items-center p-3 rounded-lg bg-black/60 border border-gray-800">
                  <span className="text-xs text-gray-500 mb-1">Stein & Erz</span>
                  <span className={`font-mono font-bold text-lg ${stoneCount >= selectedBlueprint.stoneRequired ? 'text-gray-300' : 'text-red-500'}`}>
                    {selectedBlueprint.stoneRequired}
                  </span>
                  <span className="text-[10px] text-gray-600 mt-1">Haben: {stoneCount}</span>
                </div>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 italic text-center mb-4">
              Das Gebäude wird direkt an deiner aktuellen Position errichtet. Achte auf genügend Bauplatz!
            </p>
          </div>

          <button
            onClick={() => {
              if (canAfford) {
                onBuild(selectedBlueprint.id);
                onClose();
              }
            }}
            disabled={!canAfford}
            className={`w-full py-4 rounded-xl font-bold font-serif uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${
              canAfford
                ? 'bg-gradient-to-r from-[#d4af37] to-[#b8860b] text-black hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            {canAfford ? (
              <>
                <Hammer className="w-5 h-5" /> Gebäude Errichten
              </>
            ) : (
              'Materialien Fehlen'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
