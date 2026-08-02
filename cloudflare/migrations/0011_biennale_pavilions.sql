CREATE TABLE IF NOT EXISTS biennale_editions (
  edition INTEGER PRIMARY KEY,
  edition_year INTEGER NOT NULL UNIQUE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  crawl_completed_at TEXT,
  last_attempt_at TEXT,
  last_attempt_status TEXT CHECK (last_attempt_status IN ('success', 'failed') OR last_attempt_status IS NULL),
  last_error TEXT
);

INSERT INTO biennale_editions (edition, edition_year, start_date, end_date)
VALUES (16, 2026, '2026-09-05', '2026-11-15');

INSERT OR IGNORE INTO sources (id, name, base_url, source_type, robots_notes)
VALUES ('gwangju-biennale-pavilion', '광주비엔날레 파빌리온', 'https://www.gwangjubiennale.org', 'crawl', 'Official public pavilion and venue pages only');

ALTER TABLE exhibitions ADD COLUMN edition INTEGER;
ALTER TABLE exhibitions ADD COLUMN edition_year INTEGER;
ALTER TABLE exhibitions ADD COLUMN pavilion_name TEXT;
ALTER TABLE exhibitions ADD COLUMN venue_group_key TEXT;
ALTER TABLE exhibitions ADD COLUMN geocode_status TEXT CHECK (geocode_status IN ('verified', 'needs_review') OR geocode_status IS NULL);
ALTER TABLE exhibitions ADD COLUMN crawl_warning TEXT;

CREATE INDEX IF NOT EXISTS idx_exhibitions_edition_venue_group
  ON exhibitions(edition_year, venue_group_key, active);
