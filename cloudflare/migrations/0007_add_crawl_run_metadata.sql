-- Store crawler quality counters and bounded error samples for run diagnostics.

ALTER TABLE crawl_runs ADD COLUMN metadata_json TEXT;
