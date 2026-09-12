import { RPGItem } from '../../types';

export interface AuctionListing {
  id: string;
  sellerId: string;
  sellerName: string;
  item: RPGItem;
  buyoutPrice: number;
  currentBid: number;
  highestBidderId?: string;
  highestBidderName?: string;
  expiresAt: number;
}

export class AuctionHouseSystem {
  private listings: AuctionListing[] = [];
  
  public getListings(): AuctionListing[] {
    const now = Date.now();
    return this.listings.filter(l => l.expiresAt > now);
  }

  public createListing(sellerId: string, sellerName: string, item: RPGItem, buyoutPrice: number, startingBid: number, durationHours: number): AuctionListing {
    const listing: AuctionListing = {
      id: `auction_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      sellerId,
      sellerName,
      item,
      buyoutPrice,
      currentBid: startingBid,
      expiresAt: Date.now() + durationHours * 3600000
    };
    this.listings.push(listing);
    return listing;
  }

  public placeBid(listingId: string, bidderId: string, bidderName: string, bidAmount: number): { success: boolean, reason?: string } {
    const listing = this.listings.find(l => l.id === listingId);
    if (!listing) return { success: false, reason: 'Auktion nicht gefunden.' };
    if (listing.expiresAt <= Date.now()) return { success: false, reason: 'Auktion ist bereits abgelaufen.' };
    if (listing.sellerId === bidderId) return { success: false, reason: 'Du kannst nicht auf deine eigenen Gegenstände bieten.' };
    if (bidAmount <= listing.currentBid) return { success: false, reason: 'Gebot muss höher als das aktuelle Gebot sein.' };

    // Return money to previous bidder if any (simulated here)
    // Actually, MMOEngine should handle the gold reduction/refund, here we just track state.

    listing.currentBid = bidAmount;
    listing.highestBidderId = bidderId;
    listing.highestBidderName = bidderName;

    return { success: true };
  }

  public buyout(listingId: string, buyerId: string, buyerName: string): { success: boolean, listing?: AuctionListing, reason?: string } {
    const listingIdx = this.listings.findIndex(l => l.id === listingId);
    if (listingIdx === -1) return { success: false, reason: 'Auktion nicht gefunden.' };
    const listing = this.listings[listingIdx];
    
    if (listing.expiresAt <= Date.now()) return { success: false, reason: 'Auktion ist abgelaufen.' };
    if (listing.sellerId === buyerId) return { success: false, reason: 'Du kannst nicht deine eigenen Gegenstände kaufen.' };
    if (listing.buyoutPrice <= 0) return { success: false, reason: 'Kein Sofortkaufpreis definiert.' };

    this.listings.splice(listingIdx, 1);
    
    return { success: true, listing };
  }

  public checkExpirations(): AuctionListing[] {
    const now = Date.now();
    const expired: AuctionListing[] = [];
    const active: AuctionListing[] = [];
    
    for (const listing of this.listings) {
      if (listing.expiresAt <= now) {
        expired.push(listing);
      } else {
        active.push(listing);
      }
    }
    
    this.listings = active;
    return expired;
  }
}

export const auctionHouseSystem = new AuctionHouseSystem();
