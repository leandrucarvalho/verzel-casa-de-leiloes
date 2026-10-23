CREATE TABLE lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auctioneer_id uuid NOT NULL REFERENCES users (id),
  -- snapshot of the external item, so the lot survives an API outage
  external_id text NOT NULL,
  title text NOT NULL,
  image_url text,
  attributes jsonb NOT NULL DEFAULT '{}',
  starting_bid_cents bigint NOT NULL CHECK (starting_bid_cents > 0),
  min_increment_cents bigint NOT NULL CHECK (min_increment_cents > 0),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'cancelled', 'settled')),
  winner_id uuid REFERENCES users (id),
  winning_bid_cents bigint,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX lots_status_idx ON lots (status, starts_at, ends_at);

CREATE TABLE bids (
  id bigserial PRIMARY KEY,
  lot_id uuid NOT NULL REFERENCES lots (id),
  bidder_id uuid NOT NULL REFERENCES users (id),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  placed_at timestamptz NOT NULL,
  -- hash chain: each bid commits to the previous one
  seq integer NOT NULL,
  prev_hash text NOT NULL,
  hash text NOT NULL,
  UNIQUE (lot_id, seq)
);

CREATE TABLE receipts (
  lot_id uuid PRIMARY KEY REFERENCES lots (id),
  token text NOT NULL UNIQUE,
  final_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
