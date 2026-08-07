# DDF Archive Index Implementation Plan

Date: 2026-08-07  
Design source: `DESIGN.md`  
Status: ready for implementation

## Goal

승인된 Archive Index 목업을 DDF 전 화면에 적용하고, 어드민 입력 구조와 공개 화면이 동일한 데이터 계약을 사용하도록 정리한다. 기존 기능과 콘텐츠를 보존하면서 메인, 상세, 아카이브, 경로, 대관, 어드민의 시각 계층을 하나의 시스템으로 통합한다.

## Phase 1 — Baseline and tests

1. 현재 빌드, 단위 테스트, E2E 테스트 명령과 결과를 기록한다.
2. 홈, 상세, Regional Archive, Route, Rental, Admin의 데스크톱·모바일 기준 스크린샷을 만든다.
3. 다음 동작을 실패 테스트로 먼저 고정한다.
   - 발행 콘텐츠의 Recent Updated 자동 포함 및 최신순 정렬
   - 종료된 전시의 지도 마커 제외
   - 빈 상세 메타데이터 행 숨김
   - Show/Project 타입 저장 및 목록 반영
   - 한국어 IME 조합 중 입력값 보존
   - 경유지 상한 초과 선택 차단과 알림

## Phase 2 — Shared tokens and primitives

Primary files:

- `src/assets/styles/global.css`
- 신규 공통 레이아웃/인덱스 컴포넌트

Tasks:

1. `DESIGN.md`의 색상, 간격, 선, 타이포 토큰을 CSS custom properties로 정리한다.
2. 공통 `SectionIndex`, `MetadataList`, `FullWidthCta`, `ContentPoster` 계열을 최소 단위로 만든다.
3. 기존 pill, 필터, 버튼의 포커스와 최소 터치 크기를 통일한다.
4. 기존 컴포넌트와 충돌하지 않도록 단계적으로 교체한다.

Verification:

- CSS 빌드 성공
- 키보드 포커스 확인
- 375px, 768px, 1440px 뷰포트 시각 회귀 확인

## Phase 3 — Home Archive Index

Primary files:

- `src/views/HomeView.vue`
- `src/components/RecentComponent.vue`
- `src/components/ShowComponent.vue`
- `src/components/ProjectComponent.vue`
- `src/services/contents.js`

Tasks:

1. 현재 진행 전시 1건을 포스터 중심 히어로로 구성한다.
2. Recent Updated를 Show/Project 통합 발행 스트림으로 만든다.
3. Recent에는 포스터를 주요 시각 요소로만 표시한다.
4. 최신순 정렬 기준을 한 곳에서 정의한다.
5. Archive Map, Radar, Route를 Exhibition Field 묶음으로 배치한다.
6. 대관 CTA를 데스크톱 하단, 모바일 마지막 행으로 배치한다.

Verification:

- 대표 전시가 진행 중인 콘텐츠인지 테스트
- 동일 날짜의 안정 정렬 테스트
- 모바일 목록에 고정 높이 또는 내부 스크롤이 없는지 확인

## Phase 4 — Unified detail and admin schema

Primary files:

- `src/views/DetailView.vue`
- `src/components/ShowCard.vue`
- `src/components/ProjectCard.vue`
- `src/components/admin/ContentEditor.vue`
- `src/components/admin/ContentPreviewModal.vue`
- `src/components/admin/ContentPublishPanel.vue`
- `src/views/AdminContentsView.vue`
- `src/services/contents.js`

Tasks:

1. Show와 Project의 공통 상세 정보 모델을 정의한다.
2. 역할별 메타데이터 필드를 어드민에서 추가·편집 가능하게 한다.
3. 빈 필드는 저장 가능하되 공개 화면에서 행 전체를 숨긴다.
4. Artists 항목은 이름과 Instagram handle을 구조화해 저장한다.
5. Instagram SVG 아이콘과 접근성 라벨을 공통 컴포넌트로 사용한다.
6. IME composition 이벤트 중 자동 변환이나 저장이 입력 조합을 깨지 않도록 한다.
7. 발행 후 목록, Recent, 상세 미리보기가 동일한 정규화 데이터를 사용하게 한다.

Verification:

- 한국어 입력 E2E 테스트
- Show와 Project 각각 생성·미리보기·발행 테스트
- 모든 선택적 메타데이터 조합의 렌더링 테스트

## Phase 5 — Archive, radar, and route

Primary files:

- `src/views/RegionalArchiveView.vue`
- `src/views/ArchiveRouteView.vue`
- `src/components/archive/ArchiveMap.vue`
- `src/components/archive/ArchiveList.vue`
- `src/components/archive/ArchiveModeTabs.vue`
- `src/components/archive/ArchiveRouteSelectionBar.vue`
- `src/services/archive-api.js`

Tasks:

1. `startDate <= today <= endDate` 조건을 공통 활성 전시 판별 함수로 만든다.
2. 지도 마커에는 활성 전시만 전달하고 목록 아카이브는 전체 기록을 유지한다.
3. Archive와 Route 사이에 동일 스타일의 탭형 진입 UI를 적용한다.
4. Route 진입 시 한 번만 위치 권한을 요청하고 로딩 상태를 즉시 표시한다.
5. ACC와 광주비엔날레를 빠른 출발점으로 제공한다.
6. 경유지 수 상한을 상수로 정의하고 초과 선택을 비활성화하며 토스트로 이유를 알린다.
7. 네이버 앱 딥링크와 웹 fallback을 검증한다.

Verification:

- 시작일, 종료일, 자정 경계 테스트
- 0/1/최대/초과 경유지 테스트
- 위치 허용, 거부, 시간 초과 테스트
- 모바일 앱 설치/미설치 fallback 수동 QA

## Phase 6 — Rental and SEO continuity

Primary files:

- `src/views/RentalView.vue`
- 전역 메타데이터 및 구조화 데이터 관련 파일

Tasks:

1. 전시 공간, 예술 전시, 워크숍 중심 문구를 유지한다.
2. 메인과 상세의 대관 CTA를 Rental 페이지의 동일 전환 경로로 연결한다.
3. 기존 네이버 사이트 소유 확인, canonical, OG, JSON-LD를 보존한다.
4. 화면 구조 변경으로 검색용 제목 계층과 내부 링크가 약화되지 않는지 확인한다.

Verification:

- 페이지별 title/description/canonical 확인
- 구조화 데이터 검증
- Rental CTA 분석 이벤트 확인

## Phase 7 — Open Design review loop

각 주요 화면은 최대 3회 안에서 다음 관점으로 평가한다.

- Designer: 계층과 리듬
- Critic: 불명확하거나 과도한 요소
- Brand: DDF의 기록 공간 정체성
- Accessibility: 키보드, 대비, 터치, 의미 구조
- Copy: 한국어와 영문 레이블의 일관성

평균 8/10 이상이고 치명적 접근성 또는 데이터 불일치가 없을 때 다음 단계로 이동한다.

## Phase 8 — Final QA and deployment

1. 전체 테스트와 프로덕션 빌드를 실행한다.
2. 핵심 페이지의 데스크톱·모바일 시각 QA를 실행한다.
3. 어드민에서 테스트 Show와 Project를 생성해 전체 발행 경로를 확인한다.
4. Recent 정렬, 상세 정보, 지도 활성 전시, 경유 경로를 실제 배포 후보 환경에서 확인한다.
5. 실패 시 배포하지 않고 원인과 재현 절차를 기록한다.
6. QA 통과 후 기존 프로젝트 배포 절차로 배포한다.

## Done criteria

- 승인 목업의 정보 순서가 데스크톱과 모바일에 반영됨
- 어드민에서 모든 기본 정보를 입력하고 Show/Project를 선택할 수 있음
- 발행 콘텐츠가 Recent에 자동 반영되고 최신순으로 정렬됨
- 빈 상세 정보가 보이지 않음
- 지도에 진행 중 전시만 표시됨
- 다중 경유 경로와 상한 안내가 정상 동작함
- 한국어 입력, 접근성, SEO, 프로덕션 빌드 QA 통과
