-- Add requested priority venues and spelling variants.

INSERT OR IGNORE INTO priority_venues (id, name, normalized_name, city, city_label, priority)
VALUES
  ('jeonju-seohakdong-photography-museum', '서학동사진미술관', '서학동사진미술관', 'jeonju', '전주', 85);
