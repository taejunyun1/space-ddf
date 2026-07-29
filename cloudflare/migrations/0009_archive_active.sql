ALTER TABLE exhibitions ADD COLUMN active INTEGER NOT NULL DEFAULT 1
  CHECK (active IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_exhibitions_public_active
  ON exhibitions (visibility, active, status, start_date);
