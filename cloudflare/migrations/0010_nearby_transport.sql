CREATE TABLE IF NOT EXISTS transport_points (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('bus_stop', 'subway_station', 'public_parking')),
  name TEXT NOT NULL,
  address TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  routes_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  source_name TEXT NOT NULL,
  source_updated_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_transport_points_kind_lat_lng
  ON transport_points(kind, lat, lng);
