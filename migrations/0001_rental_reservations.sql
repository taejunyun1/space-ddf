CREATE TABLE IF NOT EXISTS rental_windows (
  id TEXT PRIMARY KEY,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'blocked')),
  label TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS rental_requests (
  id TEXT PRIMARY KEY,
  applicant_name TEXT NOT NULL,
  contact TEXT NOT NULL,
  requested_start_date TEXT NOT NULL,
  requested_end_date TEXT NOT NULL,
  support_program TEXT NOT NULL CHECK (support_program IN ('none', 'k-art', 'gwangju-foundation', 'other')),
  project_description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('new', 'reviewing', 'approved', 'rejected', 'cancelled_by_user')),
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS rental_status_history (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL CHECK (to_status IN ('new', 'reviewing', 'approved', 'rejected', 'cancelled_by_user')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (request_id) REFERENCES rental_requests(id)
);

CREATE INDEX IF NOT EXISTS idx_rental_windows_dates
  ON rental_windows (status, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_rental_requests_status_dates
  ON rental_requests (status, requested_start_date, requested_end_date);

CREATE INDEX IF NOT EXISTS idx_rental_status_history_request
  ON rental_status_history (request_id, created_at);
