-- Add archive type (visual-art exhibition / independent screening / workshop)
-- and a review reason so unknown-region records can be triaged instead of dropped.

ALTER TABLE exhibitions ADD COLUMN archive_type TEXT NOT NULL DEFAULT 'exhibition';
ALTER TABLE exhibitions ADD COLUMN region_confidence TEXT;
ALTER TABLE exhibitions ADD COLUMN review_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_exhibitions_type_status
  ON exhibitions(archive_type, status, start_date DESC);
