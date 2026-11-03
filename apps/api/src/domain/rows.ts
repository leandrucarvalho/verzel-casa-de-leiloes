// One type per query shape. node-postgres hands back bigint columns as strings,
// timestamptz as Date and uuid as string, so these types say exactly that.
export type LotStatus = "published" | "cancelled" | "settled";
export type Phase = "scheduled" | "live" | "ended";

export interface LotRow {
  id: string;
  auctioneer_id: string;
  external_id: string;
  title: string;
  image_url: string | null;
  attributes: Record<string, unknown>;
  starting_bid_cents: string;
  min_increment_cents: string;
  starts_at: Date;
  ends_at: Date;
  status: LotStatus;
  winner_id: string | null;
  winning_bid_cents: string | null;
  settled_at: Date | null;
  created_at: Date;
  anchor_seq: number | null;
  anchor_hash: string | null;
  anchor_sig: string | null;
}

// SELECT_LOTS: the lot plus its auctioneer, computed phase and bid summary.
export interface LotListRow extends LotRow {
  auctioneer_nickname: string;
  phase: Phase;
  current_bid_cents: string | null;
  bid_count: string;
}

export interface BidRow {
  id: string;
  lot_id: string;
  bidder_id: string;
  amount_cents: string;
  placed_at: Date;
  seq: number;
  prev_hash: string;
  hash: string;
}

export interface UserFundsRow {
  id: string;
  balance_cents: string;
  committed_cents: string;
}

export interface ReceiptRow {
  token: string;
  final_hash: string | null;
  created_at: Date;
  lot_id: string;
  title: string;
  image_url: string | null;
  attributes: Record<string, unknown>;
  winner_id: string;
  winning_bid_cents: string;
  settled_at: Date;
  auctioneer: string;
}

export interface WalletEntryRow {
  id: string;
  kind: string;
  amount_cents: string;
  lot_id: string | null;
  lot_title: string | null;
  created_at: Date;
}
