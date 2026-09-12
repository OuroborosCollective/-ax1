import React, { useState, useEffect } from 'react';
import { X, Search, Coins, ArrowUpRight, Package, Clock, Gavel, Tag, RefreshCw } from 'lucide-react';
import { AuctionListing, auctionHouseSystem } from '../engine/economy/AuctionHouseSystem';
import { MMOEngine } from '../core/MMOEngine';

interface Props {
  onClose: () => void;
  engine: MMOEngine;
}

export const AuctionHouseModal: React.FC<Props> = ({ onClose, engine }) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'sell' | 'my_auctions'>('browse');
  const [listings, setListings] = useState<AuctionListing[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sell Form
  const [sellItemIndex, setSellItemIndex] = useState<number>(-1);
  const [startingBid, setStartingBid] = useState<number>(100);
  const [buyoutPrice, setBuyoutPrice] = useState<number>(500);
  const [duration, setDuration] = useState<number>(24);

  const refreshListings = () => {
    setListings([...auctionHouseSystem.getListings()]);
  };

  useEffect(() => {
    refreshListings();
    const interval = setInterval(refreshListings, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleBuyout = (listing: AuctionListing) => {
    if (engine.player.stats.gold < listing.buyoutPrice) {
      engine.addFloatingText('Nicht genug Gold!', engine.player.position.x, engine.player.position.y + 2, '#ef4444');
      return;
    }
    const res = auctionHouseSystem.buyout(listing.id, 'hero_player_1', 'Hero');
    if (res.success && res.listing) {
      engine.player.stats.gold -= listing.buyoutPrice;
      
      const lootId = res.listing.item.id;
      engine.player.inventory[lootId] = (engine.player.inventory[lootId] || 0) + 1;
      
      engine.addChatMessage('system', 'Auktionshaus', `Du hast ${res.listing.item.name} für ${listing.buyoutPrice} Gold gekauft.`);
      refreshListings();
    } else {
      engine.addChatMessage('system', 'Fehler', res.reason || 'Kauf fehlgeschlagen.');
    }
  };

  const handleBid = (listing: AuctionListing, bidAmount: number) => {
    if (engine.player.stats.gold < bidAmount) return;
    const res = auctionHouseSystem.placeBid(listing.id, 'hero_player_1', 'Hero', bidAmount);
    if (res.success) {
      engine.player.stats.gold -= bidAmount;
      engine.addChatMessage('system', 'Auktionshaus', `Du hast ${bidAmount} Gold auf ${listing.item.name} geboten.`);
      refreshListings();
    } else {
      engine.addChatMessage('system', 'Fehler', res.reason || 'Gebot fehlgeschlagen.');
    }
  };

  const handleCreateListing = () => {
    if (sellItemIndex === -1) return;
    
    // Convert inventory key to item object - naive approach for mock
    const inventoryKeys = Object.keys(engine.player.inventory).filter(k => engine.player.inventory[k] > 0);
    const itemId = inventoryKeys[sellItemIndex];
    if (!itemId) return;

    // Remove from inventory
    engine.player.inventory[itemId] -= 1;
    if (engine.player.inventory[itemId] <= 0) {
      delete engine.player.inventory[itemId];
    }

    const mockItem = { id: itemId, name: itemId, type: 'material', rarity: 'common', description: 'Item for sale' };
    
    auctionHouseSystem.createListing('hero_player_1', 'Hero', mockItem as any, buyoutPrice, startingBid, duration);
    engine.addChatMessage('system', 'Auktionshaus', `${itemId} erfolgreich im Auktionshaus eingestellt.`);
    
    setSellItemIndex(-1);
    refreshListings();
    setActiveTab('my_auctions');
  };

  const filteredListings = listings.filter(l => 
    l.item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const inventoryKeys = Object.keys(engine.player.inventory).filter(k => engine.player.inventory[k] > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl h-[85vh] bg-slate-900 border border-slate-700 shadow-2xl rounded-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-900/30 text-amber-400 rounded-lg border border-amber-500/20">
              <Gavel className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-slate-100 text-shadow-sm">Aurion Auktionshaus</h2>
              <p className="text-xs text-slate-400 font-mono">Globales Handelsnetzwerk</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700 bg-slate-800/80">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors flex items-center gap-2 \${
              activeTab === 'browse' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Search className="w-4 h-4" /> Durchsuchen
          </button>
          <button
            onClick={() => setActiveTab('sell')}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors flex items-center gap-2 \${
              activeTab === 'sell' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Tag className="w-4 h-4" /> Verkaufen
          </button>
          <button
            onClick={() => setActiveTab('my_auctions')}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors flex items-center gap-2 \${
              activeTab === 'my_auctions' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Package className="w-4 h-4" /> Meine Auktionen
          </button>
          <div className="ml-auto text-sm font-bold font-mono text-amber-300 flex items-center gap-2">
            <Coins className="w-4 h-4" />
            {engine.player.stats.gold.toLocaleString()} Gold
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {activeTab === 'browse' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Gegenstand suchen..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <button onClick={refreshListings} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg">
                   <RefreshCw className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                {filteredListings.length === 0 ? (
                  <div className="text-center p-8 text-slate-500">Keine Auktionen gefunden.</div>
                ) : (
                  filteredListings.map(listing => (
                    <div key={listing.id} className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg flex items-center justify-between hover:border-amber-500/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-900 rounded border border-slate-700 flex items-center justify-center">
                          <Package className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-200">{listing.item.name}</div>
                          <div className="text-xs text-slate-400">Verkäufer: <span className="text-cyan-300">{listing.sellerName}</span></div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <div className="text-xs text-slate-400">Aktuelles Gebot</div>
                          <div className="font-mono text-sm text-slate-300">{listing.currentBid} G</div>
                          {listing.highestBidderName && <div className="text-[10px] text-cyan-500">{listing.highestBidderName}</div>}
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-400">Sofortkauf</div>
                          <div className="font-mono font-bold text-amber-400">{listing.buyoutPrice} G</div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button 
                            onClick={() => handleBuyout(listing)}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded"
                          >
                            Sofortkauf
                          </button>
                          <button 
                            onClick={() => handleBid(listing, listing.currentBid + Math.ceil(listing.currentBid * 0.1))}
                            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded"
                          >
                            Bieten (+10%)
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'sell' && (
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-300 border-b border-slate-700 pb-2">Gegenstand auswählen</h3>
                <div className="grid grid-cols-5 gap-2">
                  {inventoryKeys.length === 0 ? (
                    <div className="col-span-5 text-center p-4 text-slate-500 text-sm">Inventar ist leer.</div>
                  ) : (
                    inventoryKeys.map((key, idx) => (
                      <button
                        key={key}
                        onClick={() => setSellItemIndex(idx)}
                        className={`aspect-square bg-slate-800 rounded border \${sellItemIndex === idx ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-700 hover:border-slate-500'} flex flex-col items-center justify-center p-1 relative`}
                      >
                        <Package className={`w-6 h-6 \${sellItemIndex === idx ? 'text-amber-400' : 'text-slate-400'}`} />
                        <div className="text-[9px] text-slate-300 mt-1 truncate w-full text-center">{key}</div>
                        <div className="absolute top-1 right-1 bg-slate-900 px-1 rounded text-[10px] font-mono">{engine.player.inventory[key]}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-4 bg-slate-800/30 p-4 rounded-lg border border-slate-700">
                <h3 className="text-sm font-bold text-slate-300 border-b border-slate-700 pb-2">Auktionsdetails</h3>
                
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Startgebot (Gold)</label>
                  <input
                    type="number"
                    value={startingBid}
                    onChange={(e) => setStartingBid(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm text-white font-mono focus:border-amber-500 outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Sofortkaufpreis (Gold)</label>
                  <input
                    type="number"
                    value={buyoutPrice}
                    onChange={(e) => setBuyoutPrice(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm text-white font-mono focus:border-amber-500 outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Dauer (Stunden)</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-sm text-white focus:border-amber-500 outline-none"
                  >
                    <option value={12}>12 Stunden</option>
                    <option value={24}>24 Stunden</option>
                    <option value={48}>48 Stunden</option>
                  </select>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-700/50">
                  <button
                    onClick={handleCreateListing}
                    disabled={sellItemIndex === -1 || startingBid <= 0 || buyoutPrice <= startingBid}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded transition-colors"
                  >
                    Auktion erstellen
                  </button>
                  {sellItemIndex === -1 && <p className="text-xs text-rose-400 mt-2 text-center">Wähle einen Gegenstand aus.</p>}
                  {buyoutPrice <= startingBid && <p className="text-xs text-rose-400 mt-2 text-center">Sofortkauf muss höher als Startgebot sein.</p>}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'my_auctions' && (
            <div className="space-y-2">
              {listings.filter(l => l.sellerId === 'hero_player_1').length === 0 ? (
                <div className="text-center p-8 text-slate-500">Du hast keine aktiven Auktionen.</div>
              ) : (
                listings.filter(l => l.sellerId === 'hero_player_1').map(listing => (
                  <div key={listing.id} className="p-3 bg-slate-800/30 border border-slate-700 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-900 rounded border border-slate-700 flex items-center justify-center">
                        <Package className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-200">{listing.item.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Endet in {Math.max(1, Math.floor((listing.expiresAt - Date.now()) / 3600000))}h
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Aktuelles Gebot</div>
                        <div className="font-mono text-sm text-slate-300">{listing.currentBid} G</div>
                        <div className="text-[10px] text-cyan-500">{listing.highestBidderName || 'Kein Gebot'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Sofortkauf</div>
                        <div className="font-mono font-bold text-amber-400">{listing.buyoutPrice} G</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
