-- Signed anchor of the newest bid, rewritten in the same transaction as every bid.
-- The signature needs HASH_SECRET, which is not in the database, so removing the last bid
-- (or the whole tail) leaves a chain shorter than the anchor and the audit catches it.
ALTER TABLE lots
  ADD COLUMN anchor_seq integer,
  ADD COLUMN anchor_hash text,
  ADD COLUMN anchor_sig text;
