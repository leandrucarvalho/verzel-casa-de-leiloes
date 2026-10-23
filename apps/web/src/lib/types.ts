export type LotStatus = "scheduled" | "live" | "ended";

export interface Lot {
  id: string;
  title: string;
  imageUrl: string | null;
  attributes: Record<string, string>;
  startingBidCents: number;
  minIncrementCents: number;
  startsAt: string;
  endsAt: string;
  status: LotStatus | "cancelled";
  auctioneer: string;
  currentBidCents: number | null;
  bidCount: number;
  result: "sold" | "unsold" | null;
  winningBidCents: number | null;
}

export interface RoomBid {
  seq: number;
  bidder: string;
  amountCents: number;
  placedAt: string;
  mine: boolean;
}

export interface Room {
  lot: Lot;
  serverTime: string;
  minimumNextBidCents: number;
  bids: RoomBid[];
  me: { leading: boolean; outbid: boolean; myBidCents: number | null } | null;
}
