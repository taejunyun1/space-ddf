ALTER TABLE rental_requests
  ADD COLUMN notification_status TEXT NOT NULL DEFAULT 'not_applicable'
  CHECK (notification_status IN ('not_applicable', 'pending', 'sent', 'failed'));

ALTER TABLE rental_requests
  ADD COLUMN notification_attempted_at TEXT;

ALTER TABLE rental_requests
  ADD COLUMN notification_error_code TEXT;
