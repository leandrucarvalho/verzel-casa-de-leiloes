CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  nickname text NOT NULL,
  role text NOT NULL CHECK (role IN ('auctioneer', 'bidder')),
  -- all money is stored in cents
  balance_cents bigint NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  committed_cents bigint NOT NULL DEFAULT 0 CHECK (committed_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (committed_cents <= balance_cents)
);

CREATE TABLE wallet_entries (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  kind text NOT NULL CHECK (kind IN ('deposit', 'settlement_debit', 'settlement_credit', 'refund')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  lot_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wallet_entries_user_idx ON wallet_entries (user_id, created_at DESC);
