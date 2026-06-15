-- Expand archive region buckets from individual Mokpo/Naju cities to all Jeonnam.
-- D1 enforces existing foreign keys while rebuilding tables, so preserve child
-- table rows first, rebuild parent tables in dependency order, then restore.

DROP INDEX IF EXISTS idx_venues_city_priority;
DROP INDEX IF EXISTS idx_exhibitions_city_status;
DROP INDEX IF EXISTS idx_exhibitions_dates;
DROP INDEX IF EXISTS idx_exhibitions_visibility;

DROP TABLE IF EXISTS migration_0002_exhibition_sources_backup;
DROP TABLE IF EXISTS migration_0002_exhibition_artists_backup;
DROP TABLE IF EXISTS migration_0002_exhibition_categories_backup;
DROP TABLE IF EXISTS migration_0002_exhibitions_backup;

CREATE TABLE migration_0002_exhibition_sources_backup AS
SELECT * FROM exhibition_sources;

CREATE TABLE migration_0002_exhibition_artists_backup AS
SELECT * FROM exhibition_artists;

CREATE TABLE migration_0002_exhibition_categories_backup AS
SELECT * FROM exhibition_categories;

CREATE TABLE migration_0002_exhibitions_backup AS
SELECT * FROM exhibitions;

DROP TABLE exhibition_sources;
DROP TABLE exhibition_artists;
DROP TABLE exhibition_categories;
DROP TABLE exhibitions;

CREATE TABLE venues_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  city TEXT NOT NULL CHECK (city IN ('gwangju', 'jeonju', 'jeonnam', 'unknown')),
  city_label TEXT NOT NULL,
  region_label TEXT,
  address TEXT,
  lat REAL,
  lng REAL,
  priority INTEGER NOT NULL DEFAULT 0,
  source_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (normalized_name, city)
);

INSERT OR IGNORE INTO venues_new (
  id,
  name,
  normalized_name,
  city,
  city_label,
  region_label,
  address,
  lat,
  lng,
  priority,
  source_url,
  created_at,
  updated_at
)
SELECT
  CASE
    WHEN city IN ('mokpo', 'naju') THEN 'venue-jeonnam-' || substr(id, length('venue-') + 1)
    ELSE id
  END,
  name,
  normalized_name,
  CASE
    WHEN city IN ('mokpo', 'naju') THEN 'jeonnam'
    ELSE city
  END,
  city_label,
  region_label,
  address,
  lat,
  lng,
  priority,
  source_url,
  created_at,
  updated_at
FROM venues;

DROP TABLE venues;
ALTER TABLE venues_new RENAME TO venues;

CREATE TABLE exhibitions (
  id TEXT PRIMARY KEY,
  dedupe_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  venue_id TEXT REFERENCES venues(id),
  venue_name TEXT NOT NULL,
  city TEXT NOT NULL CHECK (city IN ('gwangju', 'jeonju', 'jeonnam', 'unknown')),
  city_label TEXT NOT NULL,
  address TEXT,
  lat REAL,
  lng REAL,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL CHECK (status IN ('ongoing', 'upcoming', 'closed', 'unknown')),
  summary TEXT,
  description TEXT,
  thumbnail_url TEXT,
  canonical_source_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('crawl', 'manual', 'submission')),
  scraped_at TEXT,
  visibility TEXT NOT NULL DEFAULT 'review' CHECK (visibility IN ('public', 'review', 'hidden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO exhibitions (
  id,
  dedupe_key,
  title,
  normalized_title,
  venue_id,
  venue_name,
  city,
  city_label,
  address,
  lat,
  lng,
  start_date,
  end_date,
  status,
  summary,
  description,
  thumbnail_url,
  canonical_source_url,
  source_name,
  source_type,
  scraped_at,
  visibility,
  created_at,
  updated_at
)
SELECT
  id,
  dedupe_key,
  title,
  normalized_title,
  CASE
    WHEN city IN ('mokpo', 'naju') AND venue_id IS NOT NULL
      THEN 'venue-jeonnam-' || substr(venue_id, length('venue-') + 1)
    ELSE venue_id
  END,
  venue_name,
  CASE
    WHEN city IN ('mokpo', 'naju') THEN 'jeonnam'
    ELSE city
  END,
  city_label,
  address,
  lat,
  lng,
  start_date,
  end_date,
  status,
  summary,
  description,
  thumbnail_url,
  canonical_source_url,
  source_name,
  source_type,
  scraped_at,
  visibility,
  created_at,
  updated_at
FROM migration_0002_exhibitions_backup;

CREATE TABLE exhibition_sources (
  exhibition_id TEXT NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  source_record_id TEXT NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (exhibition_id, source_record_id)
);

INSERT OR IGNORE INTO exhibition_sources (
  exhibition_id,
  source_record_id,
  is_primary,
  created_at
)
SELECT
  backup.exhibition_id,
  backup.source_record_id,
  backup.is_primary,
  backup.created_at
FROM migration_0002_exhibition_sources_backup backup
JOIN exhibitions ON exhibitions.id = backup.exhibition_id
JOIN source_records ON source_records.id = backup.source_record_id;

CREATE TABLE exhibition_artists (
  exhibition_id TEXT NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  artist_name TEXT NOT NULL,
  normalized_artist_name TEXT NOT NULL,
  PRIMARY KEY (exhibition_id, normalized_artist_name)
);

INSERT OR IGNORE INTO exhibition_artists (
  exhibition_id,
  artist_name,
  normalized_artist_name
)
SELECT
  backup.exhibition_id,
  backup.artist_name,
  backup.normalized_artist_name
FROM migration_0002_exhibition_artists_backup backup
JOIN exhibitions ON exhibitions.id = backup.exhibition_id;

CREATE TABLE exhibition_categories (
  exhibition_id TEXT NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  PRIMARY KEY (exhibition_id, category)
);

INSERT OR IGNORE INTO exhibition_categories (
  exhibition_id,
  category
)
SELECT
  backup.exhibition_id,
  backup.category
FROM migration_0002_exhibition_categories_backup backup
JOIN exhibitions ON exhibitions.id = backup.exhibition_id;

CREATE TABLE priority_venues_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  city TEXT NOT NULL CHECK (city IN ('gwangju', 'jeonju', 'jeonnam')),
  city_label TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (normalized_name, city)
);

INSERT OR IGNORE INTO priority_venues_new (
  id,
  name,
  normalized_name,
  city,
  city_label,
  priority,
  notes,
  created_at
)
SELECT
  CASE
    WHEN city IN ('mokpo', 'naju') THEN 'jeonnam-' || id
    ELSE id
  END,
  name,
  normalized_name,
  CASE
    WHEN city IN ('mokpo', 'naju') THEN 'jeonnam'
    ELSE city
  END,
  city_label,
  priority,
  notes,
  created_at
FROM priority_venues;

DROP TABLE priority_venues;
ALTER TABLE priority_venues_new RENAME TO priority_venues;

INSERT OR IGNORE INTO priority_venues (id, name, normalized_name, city, city_label, priority)
VALUES
  ('jeonnam-gwangyang-museum-of-art', '전남도립미술관', '전남도립미술관', 'jeonnam', '광양', 90),
  ('jeonnam-damyang-dambit', '담빛예술창고', '담빛예술창고', 'jeonnam', '담양', 75),
  ('jeonnam-damyang-haedong', '해동문화예술촌', '해동문화예술촌', 'jeonnam', '담양', 75),
  ('jeonnam-suncheon-art-platform', '순천부읍성 예술공간', '순천부읍성예술공간', 'jeonnam', '순천', 70),
  ('jeonnam-yeosu-expo', '여수세계박람회장', '여수세계박람회장', 'jeonnam', '여수', 70);

DROP TABLE migration_0002_exhibition_sources_backup;
DROP TABLE migration_0002_exhibition_artists_backup;
DROP TABLE migration_0002_exhibition_categories_backup;
DROP TABLE migration_0002_exhibitions_backup;

CREATE INDEX IF NOT EXISTS idx_venues_city_priority
  ON venues(city, priority DESC, name);

CREATE INDEX IF NOT EXISTS idx_exhibitions_city_status
  ON exhibitions(city, status, start_date DESC);

CREATE INDEX IF NOT EXISTS idx_exhibitions_dates
  ON exhibitions(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_exhibitions_visibility
  ON exhibitions(visibility, updated_at DESC);
