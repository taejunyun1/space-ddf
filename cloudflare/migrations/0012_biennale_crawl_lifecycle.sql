ALTER TABLE biennale_editions ADD COLUMN claim_token TEXT;
ALTER TABLE biennale_editions ADD COLUMN claim_expires_at TEXT;

ALTER TABLE exhibitions ADD COLUMN biennale_last_seen_at TEXT;
ALTER TABLE exhibitions ADD COLUMN biennale_miss_count INTEGER NOT NULL DEFAULT 0
  CHECK (biennale_miss_count >= 0);

CREATE INDEX IF NOT EXISTS idx_exhibitions_biennale_reconciliation
  ON exhibitions(source_name, edition, active, biennale_miss_count);
