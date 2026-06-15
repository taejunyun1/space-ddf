-- Add Gwangju independent film/screening spaces for archive expansion.

INSERT OR IGNORE INTO priority_venues (id, name, normalized_name, city, city_label, priority)
VALUES
  ('gwangju-cinema', '광주극장', '광주극장', 'gwangju', '광주', 88),
  ('gwangju-untergang', '운터강', '운터강', 'gwangju', '광주', 82);
