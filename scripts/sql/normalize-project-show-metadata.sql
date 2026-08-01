UPDATE content_credits
SET label = CASE
  WHEN LOWER(TRIM(label)) IN ('artist', 'artists')
    OR TRIM(label) IN ('참여작가', '작가') THEN 'Artists'
  WHEN LOWER(TRIM(label)) IN ('curator', 'curating')
    OR TRIM(label) = '기획' THEN 'Curating'
  WHEN LOWER(TRIM(label)) = 'critic'
    OR TRIM(label) = '비평' THEN 'Critic'
  WHEN LOWER(TRIM(label)) = 'graphic'
    OR TRIM(label) = '그래픽' THEN 'Graphic'
  WHEN LOWER(TRIM(label)) = 'support'
    OR TRIM(label) = '후원' THEN 'Support'
  WHEN LOWER(TRIM(label)) = 'archive'
    OR TRIM(label) = '기록' THEN 'Archive'
  WHEN LOWER(TRIM(label)) = 'directing'
    OR TRIM(label) = '디렉팅' THEN 'Directing'
  ELSE TRIM(label)
END
WHERE (
  LOWER(TRIM(label)) IN (
    'artist', 'artists', 'curator', 'curating', 'critic', 'graphic',
    'support', 'archive', 'directing'
  )
  OR TRIM(label) IN (
    '참여작가', '작가', '기획', '비평', '그래픽', '후원', '기록', '디렉팅'
  )
)
  AND label NOT IN (
    'Artists', 'Curating', 'Critic', 'Graphic', 'Support', 'Archive', 'Directing'
  );

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
SET payload_json = json_set(
  payload_json,
  '$.credits',
  json((
    SELECT json_group_array(
      CASE
        WHEN value LIKE '참여작가 %' THEN 'Artists ' || SUBSTR(value, 6)
        WHEN value LIKE '작가 %' THEN 'Artists ' || SUBSTR(value, 4)
        WHEN value LIKE '기획 %' THEN 'Curating ' || SUBSTR(value, 4)
        WHEN value LIKE '비평 %' THEN 'Critic ' || SUBSTR(value, 4)
        WHEN value LIKE '그래픽 %' THEN 'Graphic ' || SUBSTR(value, 5)
        WHEN value LIKE '후원 %' THEN 'Support ' || SUBSTR(value, 4)
        WHEN value LIKE '기록 %' THEN 'Archive ' || SUBSTR(value, 4)
        WHEN value LIKE '디렉팅 %' THEN 'Directing ' || SUBSTR(value, 5)
        ELSE value
      END
    )
    FROM json_each(payload_json, '$.credits')
  ))
)
WHERE EXISTS (
  SELECT 1
  FROM json_each(payload_json, '$.credits')
  WHERE value LIKE '참여작가 %'
    OR value LIKE '작가 %'
    OR value LIKE '기획 %'
    OR value LIKE '비평 %'
    OR value LIKE '그래픽 %'
    OR value LIKE '후원 %'
    OR value LIKE '기록 %'
    OR value LIKE '디렉팅 %'
);

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
