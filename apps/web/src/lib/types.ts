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
