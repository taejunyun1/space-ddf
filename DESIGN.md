# DDF Design System — Archive Index

Status: approved  
Direction: A — Archive Index  
Approved: 2026-08-07

## 1. Design intent

DDF는 일반적인 상업 갤러리 사이트가 아니라 전시 공간이자 지역 예술 기록 도구다. 화면은 포스터와 기록물을 주인공으로 두고, 검은 선과 인덱스 구조로 정보를 정확하게 조직한다. 장식적 카드 UI나 SaaS형 대시보드 문법은 사용하지 않는다.

핵심 원칙은 다음 네 가지다.

1. Poster first: 현재 전시와 Recent Updated는 포스터가 가장 먼저 보인다.
2. Information second: 날짜, 참여자, 역할, 장소와 설명은 명확한 순서로 이어진다.
3. One system: Show, Project, Archive, Route, Rental, Admin은 동일한 토큰과 정보 규칙을 사용한다.
4. Operable by admin: 공개 화면의 모든 정보는 어드민 입력 구조와 일대일로 대응한다.

## 2. Visual language

### Color

| Token | Value | Use |
| --- | --- | --- |
| `--ddf-ink` | `#171717` | 텍스트, 주요 선, 검은 면 |
| `--ddf-paper` | `#FFFFFF` | 기본 배경 |
| `--ddf-paper-soft` | `#F5F4EF` | 보조 영역, 탐색 도구 묶음 |
| `--ddf-muted` | `#706F69` | 날짜, 부가 정보 |
| `--ddf-line-soft` | `#D6D4CD` | 목록 내부 구분선 |
| `--ddf-signal` | `#EF4B2D` | 진행 상태와 모바일 대관 CTA |
| `--ddf-route` | `#CAFF36` | 위치·지도·경로 기능 강조 |

지역색과 상태색은 데이터 의미가 있을 때만 사용한다. 장식 목적으로 신호색을 반복하지 않는다.

### Typography

- Display: 기존 DDF 산세리프 계열, 매우 굵게, 좁은 자간.
- Body: 한국어 가독성이 높은 기존 본문 서체.
- Metadata: D2Coding 또는 프로젝트의 기존 monospace.
- 제목은 최대 2단계 크기로 제한하고, 날짜·번호·상태는 monospace로 구분한다.
- 모바일 본문 최소 크기는 15px, 조작 요소 최소 크기는 44px로 한다.

### Lines and surfaces

- 주요 외곽선: 1px, 검정.
- 선택·핵심 상태만 2px 이상을 허용한다.
- 그림자는 기본적으로 사용하지 않는다.
- 모서리는 사각형을 기본으로 하고, 필터·상태 태그만 pill 형태를 유지한다.
- 포스터 이미지는 임의의 그라데이션이나 오버레이로 변형하지 않는다.

### Spacing

- 기본 간격 단위: 4px.
- 주요 배수: 8, 12, 16, 24, 32, 48, 64px.
- 데스크톱 좌우 여백: `clamp(18px, 4vw, 56px)`.
- 모바일 좌우 여백: 12–16px.
- 목록은 고정 높이로 잘라내지 않는다. 필요한 경우 페이지네이션 또는 명시적 더보기 기능을 사용한다.

## 3. Global information hierarchy

메인 화면 순서는 다음과 같다.

1. Global navigation
2. Current exhibition poster
3. Current exhibition essential information and detail CTA
4. Recent Updated
5. Exhibition Field: Archive Map, Exhibition Radar, Route Builder
6. Space Rental CTA

모바일에서도 같은 순서를 유지한다. 대관은 별도의 카드가 아닌 전체 너비의 마지막 행으로 이동한다.

## 4. Navigation

Primary navigation:

- Show
- Project
- Archive
- About
- Rental

Archive는 다음 기능의 상위 진입점이다.

- 전시 아카이브 지도
- 전시 레이더
- 경로 만들기

`rental`, `manage`와 같은 과거 경로는 공개 메뉴에 두지 않는다. 관리 기능은 `/admin`으로 통일한다.

## 5. Content presentation

### Home hero

- 현재 진행 중인 대표 전시 1건을 표시한다.
- 포스터 영역을 데스크톱 히어로의 약 65–70%로 사용한다.
- 제목, 기간, 장소, 운영 시간, 짧은 문장, 상세 CTA만 노출한다.
- 종료된 전시는 히어로에 표시하지 않는다.

### Recent Updated

- 카드의 시각 요소는 포스터만 사용한다.
- 등록 또는 발행 시각 기준 최신순으로 위에서 아래로 정렬한다.
- Show와 Project 모두 발행되면 자동으로 Recent Updated 대상이 된다.
- 제목과 날짜는 접근성 및 탐색을 위한 텍스트로 유지하되, 별도의 설명 이미지나 갤러리는 표시하지 않는다.

### Show and Project index

- 날짜 기준 최신순으로 위에서 아래로 정렬한다.
- Show와 Project는 같은 카드 구조를 사용한다.
- 콘텐츠 타입은 어드민에서 선택한다.

### Detail

기본 순서:

1. Poster or lead image
2. Date
3. Essential metadata
4. Location
5. Description
6. Additional images or media

지원하는 메타데이터:

- Artists
- Curating / Planning
- Critic
- Graphic
- Support
- Archive
- Directing
- Location
- Hours

값이 없는 항목은 행 자체를 렌더링하지 않는다. 참여 작가 Instagram은 텍스트 URL 대신 공통 SVG 아이콘을 사용하고 명확한 접근성 라벨을 제공한다.

## 6. Exhibition Field

### Archive map

- 오늘 날짜가 전시 시작일과 종료일 사이인 전시만 지도 마커로 표시한다.
- 종료 전시는 목록 아카이브에는 남지만 지도에는 표시하지 않는다.
- 지도와 목록은 동일한 필터 결과를 사용한다.

### Radar

- 혼잡도는 사용하지 않는다.
- 현재 진행 전시, 거리, 오늘 운영 여부, 지역, 공간을 핵심 정보로 사용한다.

### Route builder

- 진입 즉시 현재 위치 권한을 요청하되, 거부 시 ACC와 광주비엔날레를 빠른 출발점으로 제공한다.
- 여러 전시장을 선택해 경유할 수 있다.
- 네이버 지도의 지원 한도를 UI에서 선제적으로 제한하고 선택 불가 상태와 토스트를 제공한다.
- 외부 지도 열기 버튼은 전체 너비에 가까운 고대비 CTA로 제공한다.
- 모바일에서는 네이버 지도 앱 딥링크를 우선하고 실패 시 웹 URL로 전환한다.

## 7. Rental

- 전시 공간, 예술 전시, 워크숍 대관에 집중한다.
- 촬영 팝업 중심의 문구는 사용하지 않는다.
- 데스크톱에서는 페이지 하단의 검은 전체 너비 행, 모바일에서는 콘텐츠 아래 신호색 전체 너비 행으로 표시한다.
- CTA는 `전시·워크숍 대관 문의`처럼 검색 의도와 사용자 행동을 동시에 설명한다.

## 8. Admin contract

관리자는 `/admin`에서 다음 작업을 할 수 있어야 한다.

- 콘텐츠 타입: Show 또는 Project
- 제목과 짧은 소개
- 시작일과 종료일
- 장소와 운영 시간
- 포스터 및 추가 이미지
- Artists와 각 Instagram 계정
- 역할별 메타데이터
- 본문
- 발행 여부

발행 시 Recent Updated에 자동 반영한다. 선택값과 필수값을 제외한 모든 빈 정보는 공개 화면에서 숨긴다. 입력 폼은 한국어 IME 조합 중 상태를 안전하게 보존해야 한다.

## 9. Accessibility and responsive rules

- 키보드 포커스가 항상 보이도록 한다.
- 아이콘 단독 버튼에는 `aria-label`을 제공한다.
- 색만으로 상태를 전달하지 않는다.
- 포스터에는 전시명 기반 대체 텍스트를 제공한다.
- 작은 화면에서 고정 높이와 내부 이중 스크롤을 사용하지 않는다.
- 모바일 대관 CTA는 아래쪽 흐름으로 이동하며 화면 콘텐츠를 가리지 않는다.

## 10. Review gate

각 화면 변경은 다음 순서로 검토한다.

1. Design system conformity
2. Content hierarchy
3. Responsive behavior
4. Accessibility
5. Admin-to-public data fidelity
6. Regression and build verification

Open Design의 refine 원칙에 따라 한 번에 가장 영향이 큰 문제를 작은 패치로 해결하고, 기존 DDF의 의도를 보존한다.
