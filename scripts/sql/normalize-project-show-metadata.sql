DELETE FROM content_credits
WHERE content_id = (
  SELECT id FROM contents WHERE slug = 'community-chat-2025'
)
  AND label = 'Artists'
  AND TRIM(COALESCE(value, '')) = ''
  AND TRIM(COALESCE(url, '')) = '';

UPDATE contents
SET location = '', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug IN ('peer-up-2023', 'peer-up-2024')
  AND location LIKE 'http%';

INSERT INTO content_credits (id, content_id, label, value, url, sort_order)
SELECT
  'normalized-homepage-' || c.id,
  c.id,
  'Homepage',
  'peer-up.com',
  'https://www.peer-up.com/',
  COALESCE(MAX(cc.sort_order), -1) + 1
FROM contents c
LEFT JOIN content_credits cc ON cc.content_id = c.id
WHERE c.slug IN ('peer-up-2023', 'peer-up-2024')
  AND NOT EXISTS (
    SELECT 1
    FROM content_credits existing
    WHERE existing.content_id = c.id
      AND existing.label = 'Homepage'
  )
GROUP BY c.id;

UPDATE content_publications
SET payload_json = json_remove(payload_json, '$.credits[0]')
WHERE slug = 'community-chat-2025'
  AND json_extract(payload_json, '$.credits[0]') = 'Artists';

UPDATE content_publications
SET payload_json = json_set(payload_json, '$.location', '')
WHERE slug IN ('peer-up-2023', 'peer-up-2024')
  AND json_extract(payload_json, '$.location') LIKE 'http%';

UPDATE content_publications
SET payload_json = json_insert(
  payload_json,
  '$.credits[#]',
  'Homepage peer-up.com https://www.peer-up.com/'
)
WHERE slug IN ('peer-up-2023', 'peer-up-2024')
  AND NOT EXISTS (
    SELECT 1
    FROM json_each(payload_json, '$.credits')
    WHERE value LIKE 'Homepage %'
  );
