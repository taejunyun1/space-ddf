ALTER TABLE rental_windows ADD COLUMN public_description TEXT;
ALTER TABLE rental_windows ADD COLUMN admin_notes TEXT;

UPDATE rental_windows
SET admin_notes = notes
WHERE notes IS NOT NULL AND admin_notes IS NULL;

ALTER TABLE rental_requests ADD COLUMN idempotency_key TEXT;
ALTER TABLE rental_requests ADD COLUMN privacy_policy_version TEXT;
ALTER TABLE rental_requests ADD COLUMN privacy_consent_at TEXT;
ALTER TABLE rental_requests ADD COLUMN deleted_at TEXT;
ALTER TABLE rental_requests ADD COLUMN purge_after TEXT;
ALTER TABLE rental_requests ADD COLUMN notification_message_id TEXT;
ALTER TABLE rental_requests ADD COLUMN notification_attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rental_requests ADD COLUMN notification_next_attempt_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rental_requests_idempotency
  ON rental_requests (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rental_requests_deleted_purge
  ON rental_requests (deleted_at, purge_after);

CREATE TABLE IF NOT EXISTS rental_notification_outbox (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  last_attempt_at TEXT,
  last_error_code TEXT,
  message_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (request_id) REFERENCES rental_requests(id)
);

CREATE INDEX IF NOT EXISTS idx_rental_notification_outbox_due
  ON rental_notification_outbox (status, next_attempt_at);
