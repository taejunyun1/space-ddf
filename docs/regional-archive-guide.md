# 지역 전시 아카이브 가이드

## 목적

광주, 전주, 전남 전역의 전시와 상영 정보를 수집해 리스트와 Google Maps 기반 지도 형태로 보여준다. 상세 페이지는 내부에 새로 만들지 않고, 각 기록의 원문 링크를 새 탭으로 연결한다.

## 대상 지역

- 광주
- 전주
- 전남 전체

전남은 하나의 필터 버킷으로 관리하되, UI 카드와 지도 팝업에서는 실제 시군명을 `cityLabel`로 보여준다.

```txt
city: gwangju | jeonju | jeonnam
cityLabel: 광주 | 전주 | 목포 | 여수 | 순천 | 나주 | 광양 | 담양 | ...
```

## 전남 시군 기준

전남 판정에 사용하는 시군 키워드는 아래 22개다.

```txt
목포, 여수, 순천, 나주, 광양, 담양, 곡성, 구례, 고흥, 보성, 화순, 장흥, 강진, 해남, 영암, 무안, 함평, 영광, 장성, 완도, 진도, 신안
```

## 1차 수집 소스

### 아트맵

아트맵은 도시별 URL이 아니라 `광주/전라` 권역으로 묶인다. 먼저 권역 전체를 수집하고, 상세 페이지까지 확인한 뒤 주소, 공간명, 지역 표기, 우선 공간 키워드로 대상 지역만 남긴다.

목록 URL:

```txt
https://art-map.co.kr/exhibition/new_list.php?area=5&cate=0&od=0&type=ing
https://art-map.co.kr/exhibition/new_list.php?area=5&cate=0&od=0&type=exp
https://art-map.co.kr/exhibition/new_list.php?area=5&cate=0&od=0&type=end
```

AJAX 수집 엔드포인트:

```txt
POST https://art-map.co.kr/data/new_exhibition.php
```

파라미터:

```txt
start=0
wrap=0
type=ing | exp | end
area=5
cate=0
od=0
v_cnt=0
online=0
```

파라미터 의미:

```txt
area=5   광주/전라
cate=0   장르 전체
od=0     최신순
type=ing 현재전시
type=exp 예정전시
type=end 지난전시
```

상세 보강 URL:

```txt
https://art-map.co.kr/exhibition/view.php?idx={idx}
```

목록에서 먼저 저장하는 값:

```txt
전시명
공간명
지역 표기
기간
썸네일 URL
상세 idx
위도
경도
```

상세 페이지에서 보강하는 값:

```txt
주소
공간명 보정
작가명
소개글
외부 원문 링크
```

### 디어마이광주

`https://dmgj.kr/robots.txt` 기준 대부분의 경로가 차단되어 있고 아래 경로만 허용되어 있다. DMGJ는 광주 보강 소스로만 사용하고, 허용된 게시판/메뉴 경로 중심으로 확인한다.

```txt
/main/
/menu.es
/board.es
/gallery.es
/index.es
```

### 광주시립미술관 공식 홈페이지

광주시립미술관은 광주 핵심 기관이므로 아트맵 수집 결과를 보강하는 공식 출처로 둔다. 현재 자동 크롤러는 아트맵을 우선 실행하고, 공식 홈페이지는 전시 메뉴 구조를 확인한 뒤 별도 파서로 연결한다.

기본 URL:

```txt
https://artmuse.gwangju.go.kr/
```

전시 목록 후보 URL:

```txt
https://artmuse.gwangju.go.kr/pj/pjExhibit.php?action=list&exhiTp=N&pageID=artmuse0209000000
```

우선 수집할 값:

```txt
전시명
전시 기간
전시장소
관람료
주최 및 후원
전시 소개
상세 링크
```

## 지역 판정 기준

### 광주

아래 중 하나라도 충족하면 `city=gwangju`, `cityLabel=광주`로 저장한다.

```txt
주소에 광주 또는 광주광역시 포함
공간명/지역 표기에 광주 포함
광주 우선 공간명 포함
```

광주 핵심 대안공간:

```txt
예술공간집
스페이스 디디에프
디디에프
오버랩
대안공간 오버랩
호랑가시나무 창작소
호랑가시나무 아트폴리곤
뽕뽕브릿지
산수싸리
아크갤러리
대안공간 RGA
솅겐갤러리
```

광주 주요 미술관/기관:

```txt
국립아시아문화전당 ACC
광주비엔날레전시관
광주시립미술관
광주미디어아트플랫폼 GMAP
이강하미술관
하정웅미술관
의재미술관
은암미술관
국윤미술관
드영미술관
무등현대미술관
우제길미술관
양림미술관
한희원미술관
조선대미술관
소촌아트팩토리
이이남 스튜디오
미로센터
무등갤러리
```

광주 독립영화/상영 공간:

```txt
광주극장
운터강
```

광주 보조 갤러리/전시공간:

```txt
산수미술관
10년후그라운드
광주신세계갤러리
롯데갤러리 광주점
광주예술의전당 갤러리
광주여성전시관 Herstory
일곡갤러리
자미갤러리
```

광주 인스타그램 우선 모니터링 계정:

```txt
스페이스 디디에프: https://www.instagram.com/space.ddf
호랑가시나무: https://www.instagram.com/horanggasy_official
아크갤러리: 계정 확인 필요
```

### 전주

아래 중 하나라도 충족하면 `city=jeonju`, `cityLabel=전주`로 저장한다.

```txt
주소에 전주 또는 전주시 포함
공간명/지역 표기에 전주 포함
전주 우선 공간명 포함
```

전주 우선 공간:

```txt
서학동사진미술관
아트갤러리전주
전주현대미술관
교동미술관
우진문화공간
팔복예술공장
팔복 예술공장
전주부채문화관
국립전주박물관
전주영화제작소
```

### 전남

아래 중 하나라도 충족하면 `city=jeonnam`으로 저장한다. 시군명이 판정되면 `cityLabel`에는 해당 시군명을 넣고, 판정이 어려우면 `전남`으로 둔다.

```txt
주소에 전남 또는 전라남도 포함
주소/공간명/지역 표기에 전남 22개 시군명 포함
전남 우선 공간명 포함
```

전남 우선 공간:

```txt
전남도립미술관
담빛예술창고
해동문화예술촌
순천부읍성 예술공간
여수세계박람회장
목포문화예술회관
성옥기념관
노적봉예술공원미술관
국립해양문화재연구소
목포근대역사관
나주정미소
나주목문화관
나주영상테마파크 명화미술관
나주복암리고분전시관
```

## 제외 기준

아래 기록은 `source_records`에는 원본 보관 가능하지만, `exhibitions` 공개 데이터에는 올리지 않는다.

```txt
전북 지역이지만 전주가 아닌 기록
광주/전주/전남 판정 키워드가 없는 기록
상세 페이지에서 주소와 공간명이 모두 불완전한 기록
지난전시 중 sinceYear 이전에 종료된 기록
원문 링크 또는 상세 idx가 없는 기록
```

## 데이터 필드

```js
{
  id: '',
  title: '',
  archiveType: 'exhibition | screening',
  typeLabel: '전시 | 상영',
  city: 'gwangju | jeonju | jeonnam',
  cityLabel: '광주 | 전주 | 전남 시군명',
  venue: '',
  address: '',
  lat: null,
  lng: null,
  startDate: '',
  endDate: '',
  status: 'ongoing | upcoming | closed | unknown',
  screeningTime: '',
  director: '',
  organizer: '',
  artists: [],
  category: [],
  thumbnail: '',
  sourceName: '',
  sourceUrl: '',
  sourceType: 'crawl | manual | submission',
  scrapedAt: '',
  description: ''
}
```

## 상태 판정

오늘 날짜 기준으로 판정한다.

```txt
startDate > 오늘 = 예정
startDate <= 오늘 <= endDate = 진행
endDate < 오늘 = 종료
날짜 없음 = 상태 미정 / 검수 필요
```

## 지도 마커 기준

마커는 전시 위치 또는 공간 위치 기준으로 표시한다. 같은 공간에 여러 전시가 있으면 하나의 마커로 묶고 숫자를 표시한다.

```txt
광주: 초록
전주: 블루
전남: 보라
미정: 회색
전시: 원형 마커
상영: 사각형 마커
```

마커 클릭 시 표시:

```txt
전시명
유형
공간명
기간
주소
출처
원문 링크
```

## v1 운영 범위

```txt
아트맵 area=5 전체 수집
광주시립미술관 공식 홈페이지 현재/예정/지난전시 보강 수집
현재/예정/지난전시 모두 수집
지난전시는 2024년 이후만 공개 후보로 저장
광주, 전주, 전남 전체만 공개 데이터로 필터링
전남 상세 구분은 cityLabel로 처리
대표 이미지는 원문 URL만 보관
상세는 sourceUrl 아웃링크
DMGJ는 광주 보강 소스
```

## 크롤러 실행 기준

수동 실행 body 예시:

```json
{
  "sinceYear": 2024,
  "visibility": "public",
  "maxPages": {
    "ing": 8,
    "exp": 8,
    "end": 48
  },
  "endStalePageLimit": 16
}
```

기본 page limit:

```txt
ing: 8
exp: 8
end: 48
```

지난전시는 시작일 기준 정렬에 가까워 장기 전시가 뒤쪽에 섞일 수 있다. `endStalePageLimit`은 sinceYear 이전에 끝난 페이지만 연속으로 나온 횟수가 기준값에 도달했을 때 중단하는 안전장치다.

처리 순서:

```txt
1. area=5 목록에서 현재/예정/지난전시 카드 수집
2. source_records에 원본 raw record 우선 저장
3. 상세 페이지에서 주소/작가/소개/외부 링크 보강
4. 광주/전주/전남 지역 판정
5. sinceYear 이전 종료 기록 제외
6. venues, exhibitions, artists, categories 정규화 저장
7. 같은 전시는 title + venue + startDate dedupe_key로 병합
```

실행 이력의 `metadata`에는 스캔 페이지 수, 상세 fetch 실패 수, 지역 미매칭 수, 오래된 기록 skip 수, 일부 오류 샘플이 저장된다.

## Cloudflare 데이터베이스

크롤러 데이터베이스는 Cloudflare D1을 사용한다. Worker API가 D1을 읽어서 홈페이지가 JSON으로 가져오는 구조다.

현재 리소스:

```txt
D1 database name: space-ddf-archive
D1 database ID: 6dcaafeb-9681-47b9-9b30-7494eb6caffe
Worker name: space-ddf-archive-api
Worker URL: https://space-ddf-archive-api.taejunyun.workers.dev
```

주요 API:

```txt
GET /api/archive/exhibitions
GET /api/archive/exhibitions?city=gwangju&status=ongoing
GET /api/archive/venues
GET /api/archive/sources
GET /api/archive/health
GET /api/archive/crawl/runs
POST /api/archive/crawl/artmap
POST /api/archive/crawl/gwangju-museum
```

테이블:

```txt
sources
crawl_runs
source_records
venues
exhibitions
exhibition_sources
exhibition_artists
exhibition_categories
priority_venues
```

보안:

```txt
POST /api/archive/crawl/artmap 호출에는 x-crawl-secret 필요
Google Maps API key는 HTTP referrer 제한 필수
이미지는 저작권 검토 전 직접 저장하지 않고 원문 URL만 보관
```

## 업데이트 (v1.3) — 무료 자동 스크레이퍼 (GitHub Actions)

수동 입력 대신, JS 렌더링이 필요한 공간을 **GitHub Actions에서 헤드리스 브라우저(Playwright)로 무료 수집**해 manual API로 보낸다(Cloudflare Browser Rendering 같은 유료 기능 불필요). GitHub 러너는 Cloudflare가 아닌 IP라, 워커에서 막히던 광주시립미술관도 수집된다.

- 코드: `scrapers/` (Playwright) + `.github/workflows/archive-scrape.yml`(매일 + 수동).
- 활성화: repo Settings → Secrets → Actions에 `CRAWL_SECRET` 등록.
- 소스별 방식:

```txt
호랑가시나무(Google Sites)   브라우저 렌더 → 목록 추출        13건
예술공간 집(Wix)             브라우저 렌더 → 현재전시 1건      1건
광주시립미술관               단순 fetch + 기존 파서(브라우저 X)  32건
디어마이광주(DMGJ)           fetch (robots 허용 menu.es만)     전시 ~20건
```

DMGJ 주의:

```txt
robots.txt가 /event.es를 막고 /menu.es는 허용 → 반드시 menu.es만 사용(p_cate=0302=전시).
페이지네이션은 event.es라 1페이지(현재/최근 전시)만 수집.
dmgj.kr는 TLS 중간 인증서를 누락 → node:https로 해당 fetch만 rejectUnauthorized:false
  (공개 목록 읽기·자격증명 없음). 좌표는 비우고, 공유 공간은 dedupe COALESCE로 채워짐.
```

- 공간 추가: `scrapers/scrape.mjs`의 `VENUES`에 URL·좌표·추출기를 한 줄 추가. Google Sites류는 `extractExhibitions` 재사용, 레이아웃이 다르면 `customScrape`만 작성.

남은 곳:

```txt
Overlab(Creatorlink)   목록에 날짜 없음 + 비-광주 전시 섞임 → 보류/수동
뽕뽕브릿지·빈틀(인스타) 로그인 벽 → 가끔 수동
```

## 업데이트 (v1.2) — 하이브리드 소스

기관·갤러리는 아트맵에서 자동 수집하되, **아트맵에 없는 대안미술공간**(호랑가시나무·예술공간 집·뽕뽕브릿지·스페이스 DDF·Overlab·빈틀 등)은 사이트가 JS 렌더링이거나 인스타 전용이라 자동 크롤이 어렵다. 이들은 **수동/제보 입력 경로**로 같은 DB·지도에 통합한다.

### 입력 API

```txt
POST /api/archive/manual    (헤더: x-crawl-secret)
```

단건 또는 `{ "items": [ ... ] }` 배열. 저장 시 `source_type='manual'`, 기본 `visibility='public'`.

필드:

```txt
title*      전시명 (필수)
venue*      공간명 (필수)
city        gwangju | jeonju | jeonnam   (기본 gwangju)
cityLabel   표시용 (예: 광주, 목포)        (기본 city 라벨)
address     주소
lat, lng    지도 좌표 (없으면 마커 안 뜸)
startDate   2025.09.30  또는 2025-09-30
endDate     2025.10.12
artists     "신수와" 또는 ["a","b"]
archiveType exhibition | screening | workshop  (없으면 제목으로 추정)
sourceUrl   원문 링크
thumbnail   대표 이미지 URL
```

예시:

```bash
curl -X POST https://space-ddf-archive-api.taejunyun.workers.dev/api/archive/manual \
  -H "x-crawl-secret: <SECRET>" -H "content-type: application/json" \
  -d '{"title":"○○ 개인전","venue":"호랑가시나무 아트폴리곤","city":"gwangju",
       "address":"광주 남구 제중로47번길 20","lat":35.13,"lng":126.91,
       "startDate":"2026.06.01","endDate":"2026.06.30","artists":"작가명",
       "sourceUrl":"https://www.horang.art/art-polygon/exhibition/current"}'
```

같은 `dedupeKey`(제목+공간+시작일)면 덮어쓰므로, 같은 전시를 다시 보내면 갱신된다. 향후 간단한 관리 폼을 붙이면 이 API를 그대로 쓴다.

### 대안공간 등록 현황 (좌표 채워 입력 필요)

```txt
호랑가시나무 아트폴리곤/창작소  광주 남구 제중로
예술공간 집                    https://www.artspacehouse.com
뽕뽕브릿지                     인스타 @spaceppong
스페이스 DDF                   광주 동구 충장로46번길 8-8 (좌표 35.150331,126.909882) — 입력 완료
Overlab                       https://overlab.creatorlink.net
스페이스 빈틀                  인스타 @space_vintle
```

## 업데이트 (v1.1)

### 권역 확장: 광주 · 전북 · 전남 전역

수집 권역을 호남 전역(광주광역시 + 전라북도 + 전라남도)으로 확장한다. `jeonju` 버킷은 전주시뿐 아니라 **전라북도 전체**를 담고, 전남과 동일하게 `cityLabel`에 실제 시군명을 표시한다(`JEONBUK_AREAS`: 전주·군산·익산·완주·정읍·남원·김제·진안·무주·장수·임실·순창·고창·부안). 이전에 `전북` 라벨로 드롭되던 아트맵 기록(아트이슈프로젝트·전북도립미술관·서신갤러리·서학동사진관 등)이 모두 포함된다. 권역 밖(서울·경기·부산 등 타 시도)만 `OUT_OF_SCOPE_TERMS`로 제외한다.

```txt
city: gwangju | jeonju(전북 전역) | jeonnam
cityLabel: 광주 | 전주·군산·… | 목포·여수·…
```

UI 필터의 `전주` 칩은 `전북`으로 표기한다.

### 대안미술공간 포함

대안공간은 소스에 표기가 제각각이라 누락되기 쉬우므로 `VENUE_ALIASES`에 변형을 등록해 high 신뢰도로 매칭한다. 광주(스페이스 디디에프·오버랩·호랑가시나무·뽕뽕브릿지·솅겐갤러리·미테우그로·산수싸리·대안공간 RGA), 전북(서학동사진관·우주계란·아트이슈프로젝트·서신갤러리)을 포함하며, 새 공간은 이 목록에 추가한다.

### 아카이브 타입 (3종 고정)

수집 범위를 시각미술 전시, 독립영화 상영, 워크숍 3종으로 한정한다. `exhibitions.archive_type`에 저장하고, 매칭은 제목·공간명·소개 키워드로 추정한다.

```txt
exhibition  기본값 (시각미술 전시)
screening   광주극장/운터강 등 상영 공간 또는 상영·영화제·독립영화 키워드
workshop    워크숍/워크샵/workshop 키워드
```

API에 `type` 필터를 추가했다. 예: `GET /api/archive/exhibitions?type=screening`.

### 지역 판정 신뢰도와 검수 버킷

`detectTargetRegion`은 `confidence`를 함께 반환한다.

```txt
high    priority_venues 또는 공간명 별칭(VENUE_ALIASES) 일치
medium  지역/공간 키워드 일치
none    미매칭
```

미매칭(unknown) 기록은 무조건 버리지 않는다.

```txt
out-of-scope 라벨(전북/타 지역) 있음        → 제외 (skippedRegion)
disqualifying 라벨 없음(공간만 불명)         → visibility='review'로 저장, review_reason='unmatched-venue'
```

검수 화면은 `GET /api/archive/exhibitions?visibility=review`로 후보를 받아 사람이 승격(priority_venues 추가)한다.

### 공간명 별칭

소스 표기가 등록 표기와 달라 후보 공간을 놓치는 문제를 막기 위해 `VENUE_ALIASES`로 변형을 흡수한다. 예: `서학동사진관`↔`서학동사진미술관`, `스페이스 디디에프`/`SPACE DDF`/`space.ddf`. 대안공간(오버랩, 호랑가시나무, 뽕뽕브릿지, 솅겐갤러리 등)도 별칭으로 high 신뢰도 매칭한다.

### 크롤 관측성

`scheduled` 핸들러는 각 크롤러를 `runScheduledCrawl`로 감싸 조기 실패(import 오류 등)도 `crawl_runs`에 `failed`로 기록한다. 소스가 0건이 되어도 `/api/archive/crawl/runs`에서 드러난다.

### 운영 체크리스트

```txt
1. cd cloudflare && npx wrangler d1 migrations apply space-ddf-archive --remote
2. npx wrangler deploy
3. 시립미술관 1회 수동 실행: POST /api/archive/crawl/gwangju-museum (x-crawl-secret)
4. /api/archive/crawl/runs 에 gwangju-museum-* 성공 row 확인
5. /api/archive/exhibitions?visibility=review 로 검수 후보 확인
```
