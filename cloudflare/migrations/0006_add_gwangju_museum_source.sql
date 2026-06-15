-- Add Gwangju Museum of Art official website as a crawl source candidate.

INSERT OR IGNORE INTO sources (id, name, base_url, source_type, robots_notes)
VALUES
  (
    'gwangju-museum-of-art',
    '광주시립미술관',
    'https://artmuse.gwangju.go.kr',
    'crawl',
    '공식 홈페이지 전시 메뉴. 현재/예정/지난전시 구조 확인 후 Artmap 보강 소스로 사용'
  );
