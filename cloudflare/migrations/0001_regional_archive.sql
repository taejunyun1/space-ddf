-- D1 schema for Space DDF regional exhibition archive.
-- Keep UI-facing data normalized in exhibitions/venues, and preserve source
-- provenance in source_records so crawler updates can be audited.

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('crawl', 'manual', 'submission')),
  robots_notes TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS crawl_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  crawl_type TEXT NOT NULL,
  request_url TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  finished_at TEXT,
  records_found INTEGER NOT NULL DEFAULT 0,
  records_saved INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS venues (
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

CREATE TABLE IF NOT EXISTS source_records (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  external_id TEXT,
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  venue_name TEXT,
  city_hint TEXT,
  period_text TEXT,
  lat REAL,
  lng REAL,
  thumbnail_url TEXT,
  payload_json TEXT,
  content_hash TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (source_id, external_id)
);

CREATE TABLE IF NOT EXISTS exhibitions (
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

CREATE TABLE IF NOT EXISTS exhibition_sources (
  exhibition_id TEXT NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  source_record_id TEXT NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (exhibition_id, source_record_id)
);

CREATE TABLE IF NOT EXISTS exhibition_artists (
  exhibition_id TEXT NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  artist_name TEXT NOT NULL,
  normalized_artist_name TEXT NOT NULL,
  PRIMARY KEY (exhibition_id, normalized_artist_name)
);

CREATE TABLE IF NOT EXISTS exhibition_categories (
  exhibition_id TEXT NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  PRIMARY KEY (exhibition_id, category)
);

CREATE TABLE IF NOT EXISTS priority_venues (
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

CREATE INDEX IF NOT EXISTS idx_crawl_runs_source_status
  ON crawl_runs(source_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_source_records_source_seen
  ON source_records(source_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_venues_city_priority
  ON venues(city, priority DESC, name);

CREATE INDEX IF NOT EXISTS idx_exhibitions_city_status
  ON exhibitions(city, status, start_date DESC);

CREATE INDEX IF NOT EXISTS idx_exhibitions_dates
  ON exhibitions(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_exhibitions_visibility
  ON exhibitions(visibility, updated_at DESC);

INSERT OR IGNORE INTO sources (id, name, base_url, source_type, robots_notes)
VALUES
  ('artmap', '아트맵', 'https://art-map.co.kr', 'crawl', 'area=5 광주/전라 목록과 전시 상세 URL을 수집'),
  ('dmgj', '디어마이광주', 'https://dmgj.kr', 'crawl', 'robots.txt 허용 경로만 보강 소스로 사용'),
  ('space-ddf', 'Space DDF', 'https://www.spaceddf.xyz', 'manual', '자체 아카이브 및 수동 검수 데이터');

INSERT OR IGNORE INTO priority_venues (id, name, normalized_name, city, city_label, priority)
VALUES
  ('gwangju-yesulgonggan-jip', '예술공간집', '예술공간집', 'gwangju', '광주', 100),
  ('gwangju-space-ddf', '스페이스 디디에프', '스페이스디디에프', 'gwangju', '광주', 100),
  ('gwangju-ddf', '디디에프', '디디에프', 'gwangju', '광주', 95),
  ('gwangju-overlab', '오버랩', '오버랩', 'gwangju', '광주', 95),
  ('gwangju-museum-of-art', '광주시립미술관', '광주시립미술관', 'gwangju', '광주', 90),
  ('gwangju-horang-artpolygon', '호랑가시나무 아트폴리곤', '호랑가시나무아트폴리곤', 'gwangju', '광주', 90),
  ('gwangju-horang-creative', '호랑가시나무 창작소', '호랑가시나무창작소', 'gwangju', '광주', 90),
  ('gwangju-ppongppong-bridge', '뽕뽕브릿지', '뽕뽕브릿지', 'gwangju', '광주', 90),
  ('jeonnam-mokpo-culture-art-center', '목포문화예술회관', '목포문화예술회관', 'jeonnam', '목포', 80),
  ('jeonnam-mokpo-seongok', '성옥기념관', '성옥기념관', 'jeonnam', '목포', 75),
  ('jeonnam-mokpo-nojeokbong', '노적봉예술공원미술관', '노적봉예술공원미술관', 'jeonnam', '목포', 75),
  ('jeonju-art-gallery', '아트갤러리전주', '아트갤러리전주', 'jeonju', '전주', 80),
  ('jeonju-modern-art', '전주현대미술관', '전주현대미술관', 'jeonju', '전주', 80),
  ('jeonju-palbok', '팔복예술공장', '팔복예술공장', 'jeonju', '전주', 80),
  ('jeonnam-naju-rice-mill', '나주정미소', '나주정미소', 'jeonnam', '나주', 80),
  ('jeonnam-naju-mok-culture', '나주목문화관', '나주목문화관', 'jeonnam', '나주', 75),
  ('jeonnam-naju-image-theme-park', '나주영상테마파크 명화미술관', '나주영상테마파크명화미술관', 'jeonnam', '나주', 75),
  ('jeonnam-gwangyang-museum-of-art', '전남도립미술관', '전남도립미술관', 'jeonnam', '광양', 90),
  ('jeonnam-damyang-dambit', '담빛예술창고', '담빛예술창고', 'jeonnam', '담양', 75),
  ('jeonnam-damyang-haedong', '해동문화예술촌', '해동문화예술촌', 'jeonnam', '담양', 75),
  ('jeonnam-suncheon-art-platform', '순천부읍성 예술공간', '순천부읍성예술공간', 'jeonnam', '순천', 70),
  ('jeonnam-yeosu-expo', '여수세계박람회장', '여수세계박람회장', 'jeonnam', '여수', 70);
