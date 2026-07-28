CREATE TABLE IF NOT EXISTS contents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('show', 'project')),
  slug TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  start_date TEXT,
  end_date TEXT,
  date_display TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'unpublished')),
  show_on_home INTEGER NOT NULL DEFAULT 1,
  is_featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  purge_after TEXT,
  UNIQUE(type, slug)
);

CREATE TABLE IF NOT EXISTS content_publications (
  content_id TEXT PRIMARY KEY REFERENCES contents(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  slug TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(type, slug)
);

CREATE TABLE IF NOT EXISTS content_credits (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS content_assets (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('poster', 'preview', 'gallery')),
  r2_key_original TEXT NOT NULL,
  r2_key_web TEXT,
  r2_key_thumbnail TEXT,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  alt_text TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  upload_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS content_slug_history (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  old_slug TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(type, old_slug)
);

CREATE INDEX IF NOT EXISTS idx_contents_manager
  ON contents(deleted_at, status, type, start_date DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_assets_content
  ON content_assets(content_id, role, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_assets_single_poster
  ON content_assets(content_id, role) WHERE role = 'poster' AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_assets_single_preview
  ON content_assets(content_id, role) WHERE role = 'preview' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_credits_content
  ON content_credits(content_id, sort_order);
