import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Crown, Coins, Package, MapPin, X, ArrowRight, Sword } from 'lucide-react';
import { NPCCharacter } from '../types';
import { OpenWorldPlayer } from '../entities/OpenWorldPlayer';

interface TerritoryPoliticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  npc: NPCCharacter;
  player: OpenWorldPlayer;
  onCompleteQuest: (questId: string, rewardXp: number, rewardPoints: number) => void;
  onClaimTerritory: (chunkKey: string, guardCount: number, ownerName: string) => void;
}

export const TerritoryPoliticsModal: React.FC<TerritoryPoliticsModalProps> = ({
  isOpen,
  onClose,
  npc,
  player,
  onCompleteQuest,
  onClaimTerritory
}) => {
  const [politicsData, setPoliticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Extract chunk key from NPC ID (e.g. 'politics_envoy_0,0')
  const chunkKey = npc.id.replace('politics_envoy_', '');

  useEffect(() => {
    if (isOpen) {
      fetchPoliticsData();
    }
  }, [isOpen]);

  const fetchPoliticsData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/world/politics/${chunkKey}`);
      if (res.ok) {
        const data = await res.json();
        setPoliticsData(data.politics);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const claimTerritory = async () => {
    if (!politicsData) return;
    const guardCount = player.stats.politicsLevel || 1;
    try {
      const res = await fetch(`/api/world/politics/${chunkKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...politicsData,
          ownerId: 'hero_player_1',
          ownerName: 'Hero',
          stability: 100,
          guardCount: guardCount
        })
      });
      if (res.ok) {
        fetchPoliticsData();
        onClaimTerritory(chunkKey, guardCount, 'Hero');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuestComplete = async (questId: string, xpReward: number, pointChange: number) => {
    if (!politicsData) return;
    const isDestabilize = questId.includes('destabilize');
    
    // Modify points & stability
    let newStability = politicsData.stability;
    const newPoints = { ...(politicsData.adminPoints || {}) };
    
    const myId = 'hero_player_1';
    const myLvl = player.stats.politicsLevel || 1;
    
    // Level scaling: more impact per level
    const impact = pointChange * (1 + (myLvl * 0.1));
    
    if (isDestabilize) {
      newStability = Math.max(0, newStability + impact);
      // If stability hits 0, ownership is lost
      if (newStability <= 0) {
        politicsData.ownerId = null;
        politicsData.ownerName = null;
        politicsData.guardCount = 0;
      }
    } else {
      newPoints[myId] = Math.min(15, (newPoints[myId] || 0) + impact);
    }

    try {
      const res = await fetch(`/api/world/politics/${chunkKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...politicsData,
          stability: newStability,
          adminPoints: newPoints
        })
      });
      if (res.ok) {
        fetchPoliticsData();
        onCompleteQuest(questId, xpReward, impact);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  const isOwner = politicsData?.ownerId === 'hero_player_1';
  const myPoints = politicsData?.adminPoints?.['hero_player_1'] || 0;
  const canClaim = myPoints >= 15 && !politicsData?.ownerId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#0b1320] border border-[#06b6d4]/50 rounded-2xl shadow-[0_0_40px_rgba(0,240,255,0.15)] text-gray-200 overflow-hidden font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#06b6d4]/30 bg-gradient-to-r from-[#06b6d4]/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#06b6d4]/20 border border-[#06b6d4]/50 flex items-center justify-center text-[#06b6d4]">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-[#fbbf24] tracking-wide">{npc.name}</h2>
              <p className="text-xs text-[#06b6d4]">Politische Verwaltung & Gebietskontrolle</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center text-gray-400 py-10">Lade Verwaltungsdaten...</div>
          ) : (
            <div className="space-y-6">
              
              {/* Ownership Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-black/40 border border-gray-800 flex items-center gap-4">
                  <Shield className={`w-8 h-8 ${isOwner ? 'text-emerald-400' : politicsData.ownerId ? 'text-red-400' : 'text-gray-500'}`} />
                  <div>
                    <p className="text-xs text-gray-400">Gebietsvorsitzender</p>
                    <p className="text-lg font-bold text-gray-100">{politicsData.ownerName || 'Unbeansprucht'}</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-black/40 border border-gray-800 flex items-center gap-4">
                  <ShieldAlert className="w-8 h-8 text-amber-400" />
                  <div>
                    <p className="text-xs text-gray-400">Stabilität</p>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 transition-all" style={{ width: `${politicsData.stability}%` }} />
                      </div>
                      <span className="text-sm font-bold">{politicsData.stability}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Player Influence */}
              <div className="p-4 rounded-xl bg-[#06b6d4]/5 border border-[#06b6d4]/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-[#06b6d4]">Dein Politischer Einfluss</h3>
                  <span className="text-xs font-mono bg-[#06b6d4]/20 text-[#06b6d4] px-2 py-1 rounded">
                    Politik-Level {player.stats.politicsLevel || 1} ({player.stats.politicsXp || 0} XP)
                  </span>
                </div>
                
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-300 mb-2">
                    <span>Verwaltungspunkte (PVP/PVE)</span>
                    <span className="font-mono font-bold text-[#fbbf24]">{myPoints} / 15</span>
                  </div>
                  <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-[#06b6d4] to-[#22d3ee] transition-all duration-500 ease-out" 
                      style={{ width: `${Math.min(100, (myPoints / 15) * 100)}%` }} 
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-[#06b6d4]/10 mb-4">
                  <Shield className="w-5 h-5 text-[#06b6d4]" />
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Deine aktuelle Autorität erlaubt es dir, <span className="font-bold text-white">{player.stats.politicsLevel || 1} Elite-Wache(n)</span> zu stationieren, falls du dieses Gebiet beanspruchst.
                  </p>
                </div>

                {canClaim && (
                  <button 
                    onClick={claimTerritory}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold font-serif flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(251,191,36,0.3)] transition-all"
                  >
                    <Crown className="w-5 h-5" />
                    Als Gouverneur beanspruchen
                  </button>
                )}
              </div>

              {/* Quests (Stabilization / Destabilization) */}
              <div>
                <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Verfügbare Politische Aktionen</h3>
                <div className="space-y-3">
                  {npc.quests.map((q) => {
                    const isDestabilize = q.id.includes('destabilize');
                    if (isDestabilize && (!politicsData.ownerId || isOwner)) return null; // Only show destabilize if someone else owns it
                    if (!isDestabilize && isOwner && politicsData.stability === 100) return null; // Max stability

                    return (
                      <div key={q.id} className={`p-4 rounded-xl border transition-colors flex items-center justify-between ${
                        isDestabilize ? 'bg-red-950/20 border-red-900/30 hover:border-red-500/50' : 'bg-[#09111c] border-gray-800 hover:border-[#06b6d4]/40'
                      }`}>
                        <div className="max-w-[70%]">
                          <h4 className={`font-bold text-sm mb-1 flex items-center gap-2 ${isDestabilize ? 'text-red-400' : 'text-[#06b6d4]'}`}>
                            {isDestabilize && <ShieldAlert className="w-4 h-4" />}
                            {q.title}
                          </h4>
                          <p className="text-xs text-gray-400 leading-relaxed">{q.description}</p>
                        </div>
                        <button 
                          onClick={() => handleQuestComplete(q.id, isDestabilize ? 20 : 15, isDestabilize ? -5 : 5)}
                          className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-lg transition-all ${
                            isDestabilize 
                              ? 'bg-red-900 text-red-100 hover:bg-red-800 border-b-2 border-red-950' 
                              : 'bg-[#06b6d4] text-[#040d1a] hover:bg-[#22d3ee] border-b-2 border-[#0092ab]'
                          }`}
                        >
                          {isDestabilize ? <Sword className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                          Aktion Ausführen
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Management Panels (Only for Owner) */}
              {isOwner && (
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <button className="p-4 rounded-xl bg-[#06b6d4]/10 border border-[#06b6d4]/30 hover:bg-[#06b6d4]/20 transition-colors flex flex-col items-center justify-center gap-2 text-[#06b6d4]">
                    <Coins className="w-6 h-6" />
                    <span className="font-bold text-sm">Händler Inventar Verwalten</span>
                  </button>
                  <button className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors flex flex-col items-center justify-center gap-2 text-amber-400">
                    <Package className="w-6 h-6" />
                    <span className="font-bold text-sm">Materialbank Öffnen</span>
                  </button>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
