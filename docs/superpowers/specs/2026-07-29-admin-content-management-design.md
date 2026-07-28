# Admin 콘텐츠 관리 기능 설계

## 목표

Space DDF 관리자가 배포나 코드 수정 없이 Show와 Project 콘텐츠를 등록, 수정, 미리보기, 공개, 비공개, 복구할 수 있게 한다. 기존 `src/stores/content.js`와 `src/assets`의 모든 콘텐츠도 새 관리 시스템으로 이전한다.

공개 사이트의 현재 디자인과 URL 구조는 유지한다. 신규 시스템에 장애가 발생해도 기존 정적 콘텐츠를 읽어 사이트의 주요 콘텐츠가 사라지지 않게 한다.

## 범위

### 포함

- Show와 Project 콘텐츠의 등록, 조회, 수정, 복제
- 임시저장, 관리자 미리보기, 공개, 비공개
- 메인 목록 노출과 `Recent Updated` 대표 콘텐츠 지정
- 포스터, 프리뷰, 갤러리 이미지 업로드 및 순서 변경
- 이미지별 대체문구와 캡션
- 반복 가능한 크레딧 항목
- slug 생성, 중복 검증, 이전 slug 리다이렉트
- 30일 휴지통과 복구
- 기존 정적 콘텐츠 및 이미지의 D1/R2 마이그레이션
- 공개 API와 기존 정적 데이터 fallback

### 제외

- 여러 관리자의 동시 편집 병합
- 범용 WYSIWYG 페이지 빌더
- 동영상 직접 업로드와 변환
- 콘텐츠 예약 공개
- 다국어 콘텐츠 분리 관리

## 선택한 구조

콘텐츠 메타데이터는 기존 Cloudflare D1에 저장하고, 이미지 원본과 파생 파일은 Cloudflare R2에 저장한다.

```text
Admin UI
  └─ 인증된 콘텐츠 API
       ├─ D1: 콘텐츠, 크레딧, 이미지 메타데이터, 공개본, slug 이력
       └─ R2: 포스터, 프리뷰, 갤러리 원본과 파생 이미지

Public UI
  └─ 공개 콘텐츠 API
       ├─ D1 공개본
       └─ 실패 시 기존 정적 콘텐츠 fallback
```

기존 관리자 인증을 그대로 사용한다. `/admin/contents`와 `/manage/contents`는 기존 보호된 관리자 셸 안에서 같은 콘텐츠 관리 화면을 제공한다.

## 데이터 모델

### contents

- `id`: 내부 식별자
- `type`: `show` 또는 `project`
- `slug`: 현재 공개 URL에 사용하는 고유 slug
- `title`: 상세 페이지와 목록의 제목
- `start_date`, `end_date`: 정렬과 검증에 쓰는 ISO 날짜
- `date_display`: 필요한 경우 관리자가 조정하는 표시용 날짜 문자열
- `location`: 장소
- `body`: 짧은 소개
- `description`: 본문
- `status`: `draft`, `published`, `unpublished`
- `show_on_home`: 메인 Show/Project 목록 노출 여부
- `is_featured`: `Recent Updated` 대표 콘텐츠 여부
- `sort_order`: 같은 날짜에서의 수동 노출 순서
- `published_at`: 최초 또는 최근 공개 시각
- `created_at`, `updated_at`
- `deleted_at`, `purge_after`: 휴지통과 완전 삭제 시점

`type`과 `slug` 조합은 고유하다. 공개 콘텐츠는 작성 중 변경과 분리된 마지막 정상 공개본을 유지한다.

### content_credits

- `id`, `content_id`
- `label`: Artist, Curating, Graphic, Support, Archive 등
- `value`: 표시할 값
- `url`: 선택 링크
- `sort_order`

label을 고정 enum으로 제한하지 않아 기존 데이터와 향후 역할을 손실 없이 수용한다. admin에서는 기존 label을 추천 선택지로 제공하고 직접 입력도 허용한다.

### content_assets

- `id`, `content_id`
- `role`: `poster`, `preview`, `gallery`
- `r2_key_original`, `r2_key_web`, `r2_key_thumbnail`
- `mime_type`, 원본 크기와 이미지 폭·높이
- `alt_text`, `caption`
- `sort_order`
- `upload_status`: `pending`, `ready`, `failed`
- `created_at`, `deleted_at`

콘텐츠 하나에 poster와 preview는 각각 최대 하나이며 gallery는 여러 개다.

### content_slug_history

- `id`, `content_id`
- `type`, `old_slug`, `created_at`

기존 slug로 요청하면 현재 상세 URL로 영구 리다이렉트한다.

### 공개본

작성 중인 draft와 방문자가 보는 데이터를 분리한다. 공개 시 서버가 콘텐츠 전체를 검증한 뒤 하나의 트랜잭션으로 공개본을 갱신한다. 공개 콘텐츠를 수정하는 동안에는 이전 공개본이 계속 제공된다.

## R2 이미지 처리

관리자는 `jpg`, `jpeg`, `png`, `webp`, `avif` 이미지를 업로드할 수 있다. 서버는 MIME type과 파일 시그니처를 모두 검사하고 크기 제한을 적용한다.

저장 구조는 콘텐츠 ID를 기준으로 한다.

```text
contents/{content-id}/original/{asset-id}.{ext}
contents/{content-id}/web/{asset-id}.webp
contents/{content-id}/thumb/{asset-id}.webp
temporary/{admin-session}/{upload-id}
```

- 원본은 보존한다.
- 웹용 이미지는 상세 페이지에 적합한 크기와 품질로 생성한다.
- 썸네일은 메인 목록과 관리자 목록에서 사용한다.
- 업로드 중 파일은 임시 경로에 두고 자산 레코드 연결이 완료되면 정식 경로로 이동한다.
- 실패한 업로드만 재시도할 수 있다.
- 연결되지 않은 임시 파일은 주기적으로 정리한다.
- 휴지통 복구 기간에는 R2 파일을 유지하고, 30일 후 데이터와 함께 완전 삭제한다.

이미지 변환은 Cloudflare에서 지원하는 이미지 처리 경로를 사용한다. 배포 환경에서 변환 기능을 사용할 수 없을 때는 원본을 안전하게 저장하고 원본 기반 제공으로 기능을 유지하되, 관리자에게 파생 이미지 생성 상태를 표시한다.

## 관리자 화면

승인된 A안은 역할이 분명한 3단 구조다.

### 왼쪽: 콘텐츠 탐색

- `+ 새 콘텐츠`
- 전체, Show, Project, 임시저장, 공개, 비공개, 휴지통 필터
- 제목과 slug 검색
- 최근 콘텐츠 목록
- 각 항목의 타입과 상태 표시

### 가운데: 편집

편집 필드를 세 섹션으로 구분한다.

1. 기본 정보
   - 타입, slug, 제목, 시작일, 종료일, 표시용 날짜, 장소
   - 메인 목록 노출과 `Recent Updated` 지정
2. 내용
   - 반복 가능한 크레딧
   - 짧은 소개와 본문
3. 이미지
   - 포스터와 프리뷰
   - 갤러리 다중 업로드
   - 드래그 순서 변경
   - 대체문구와 캡션

텍스트 변경은 짧은 debounce 후 자동 임시저장한다. 상단에는 `저장 중`, `저장됨`, `저장 실패`를 명확히 표시한다.

### 오른쪽: 검토와 공개

- 현재 공개 상태
- 작성 진행률
- 누락된 필수 항목
- 관리자 미리보기
- 공개, 비공개
- 콘텐츠 복제
- 휴지통 이동

공개는 명시적인 버튼으로만 수행한다. 자동저장은 공개 상태를 바꾸지 않는다.

## 사용자 흐름

### 신규 등록

1. 관리자가 Show 또는 Project를 선택한다.
2. 제목에서 slug 초안을 자동 생성하고 관리자가 수정할 수 있다.
3. 기본 정보, 내용, 이미지를 입력한다.
4. 변경 내용은 draft로 자동 저장된다.
5. 관리자가 미리보기에서 메인 카드와 상세 페이지를 확인한다.
6. 공개 버튼을 누른다.
7. 서버 검증 성공 후 공개본과 공개 API 캐시를 갱신한다.

### 공개 콘텐츠 수정

1. 공개 콘텐츠의 draft 편집본을 연다.
2. 수정 중에도 기존 공개본을 방문자에게 제공한다.
3. 미리보기는 draft를 사용한다.
4. 다시 공개할 때 공개본을 원자적으로 교체한다.

### 삭제와 복구

1. 삭제는 콘텐츠를 휴지통으로 이동한다.
2. 공개 목록에서는 즉시 제외하되 관리자 휴지통에서 30일간 복구할 수 있다.
3. 30일 후 정리 작업이 D1 레코드와 R2 자산을 완전 삭제한다.

## API

### 공개 API

- `GET /api/contents?type=show|project`
- `GET /api/contents/:type/:slug`
- `GET /api/contents/featured`
- `GET /api/contents/redirect/:type/:oldSlug`

공개 API는 `published` 공개본만 반환하고 관리자 메모, 임시 업로드, 내부 R2 key를 노출하지 않는다.

### 관리자 API

- `GET /api/admin/contents`
- `POST /api/admin/contents`
- `GET /api/admin/contents/:id`
- `PATCH /api/admin/contents/:id`
- `POST /api/admin/contents/:id/publish`
- `POST /api/admin/contents/:id/unpublish`
- `POST /api/admin/contents/:id/preview-token`
- `POST /api/admin/contents/:id/duplicate`
- `DELETE /api/admin/contents/:id`
- `POST /api/admin/contents/:id/restore`
- `POST /api/admin/contents/:id/assets`
- `PATCH /api/admin/contents/:id/assets/:assetId`
- `DELETE /api/admin/contents/:id/assets/:assetId`

관리자 API는 기존 관리자 세션 인증을 필수로 하고, 상태 변경과 업로드 요청에 CSRF 방어를 적용한다.

## 검증 규칙

임시저장은 불완전한 콘텐츠를 허용한다. 공개 시에는 다음을 모두 만족해야 한다.

- type이 show 또는 project
- 같은 type 안에서 slug가 고유
- 제목 존재
- 시작일 존재, 종료일이 있으면 시작일 이후
- poster 준비 완료
- 크레딧 한 개 이상
- body 또는 description 중 하나 존재
- 모든 연결 이미지의 업로드 상태가 ready
- featured는 공개 콘텐츠 전체에서 한 개만 활성화

## 오류 처리

- slug 중복: 충돌하는 콘텐츠를 알려주고 공개를 중단
- 자동저장 실패: 입력 내용은 화면에 유지하고 재시도 제공
- 이미지 일부 실패: 성공 파일을 유지하고 실패 파일만 재시도
- 지원하지 않는 파일과 용량 초과: 업로드 전에 파일별 원인 표시
- 공개 검증 실패: 오른쪽 패널에 누락 항목과 이동 링크 표시
- R2 장애: 메타데이터만 성공 처리하지 않고 업로드 상태를 failed로 기록
- D1 장애: 공개 상태를 변경하지 않고 이전 공개본 유지
- 공개 API 장애: 기존 정적 콘텐츠 fallback

## 기존 콘텐츠 마이그레이션

마이그레이션은 재실행 가능한 스크립트로 만든다.

1. `src/stores/content.js`의 Show/Project 메타데이터를 정규화한다.
2. `src/assets/previews`, `src/assets/show`, `src/assets/project` 파일을 콘텐츠 slug와 연결한다.
3. D1에 draft 레코드와 크레딧을 upsert한다.
4. 원본과 파생 이미지를 R2에 업로드한다.
5. 기존 정적 데이터와 신규 API 결과를 필드별로 비교한다.
6. 검증된 항목만 published 상태로 전환한다.
7. 모든 항목이 검증된 뒤 공개 페이지의 기본 데이터 소스를 API로 전환한다.
8. 정적 데이터는 fallback으로 유지한다.

슬러그, 제목, 날짜, 크레딧, body, description, hero, preview, gallery, location을 손실 없이 이전한다. 파일이 없거나 기존 메타데이터와 연결할 수 없는 항목은 자동 공개하지 않고 마이그레이션 보고서에 남긴다.

## 테스트

### 단위 및 API 테스트

- show/project 입력 검증
- draft의 불완전 데이터 허용
- 공개 필수값 검증
- slug 고유성과 slug 이력 리다이렉트
- 공개본과 편집본 분리
- featured 단일성
- 관리자 인증과 CSRF 방어
- 공개 API의 비공개 필드 제거
- 이미지 MIME, 시그니처, 크기 검증
- 휴지통 복구와 30일 완전 삭제
- R2 실패 시 D1 상태 일관성

### 마이그레이션 테스트

- 모든 기존 slug의 이전 여부
- 기존 콘텐츠와 변환 결과의 필드 동등성
- hero, preview, gallery 파일 연결
- 재실행 시 중복 데이터가 생기지 않음
- 누락 파일 보고서

### 브라우저 시나리오

- 신규 Show 임시저장, 미리보기, 공개
- 신규 Project 등록
- 포스터와 여러 갤러리 업로드 및 순서 변경
- 공개 콘텐츠 수정 중 이전 공개본 유지
- 비공개와 복구
- 메인 목록, `Recent Updated`, 상세 페이지 반영
- 기존 slug 리다이렉트
- 모바일 관리자 화면과 키보드 접근

## 배포 순서

1. D1 마이그레이션과 R2 바인딩 추가
2. API와 저장소 계층 배포
3. 관리자 화면 배포
4. 기존 콘텐츠 마이그레이션과 비교 보고서 확인
5. 공개 페이지 API 읽기 활성화
6. 기능 및 fallback 확인

각 단계는 이전 단계가 정상 동작하는 동안 공개 사이트에 영향을 주지 않게 진행한다.

## 완료 기준

- 관리자가 코드 수정 없이 Show와 Project를 등록하고 공개할 수 있다.
- 포스터, 프리뷰, 갤러리를 업로드하고 순서를 관리할 수 있다.
- 기존 모든 공개 콘텐츠가 동일한 URL과 내용으로 제공된다.
- 공개 콘텐츠 수정 중 방문자는 마지막 정상 공개본을 본다.
- admin 미리보기와 실제 공개 화면이 일치한다.
- 비공개, 휴지통, 복구가 동작한다.
- D1/R2 장애 시 기존 정적 콘텐츠가 유지된다.
- 자동/API/브라우저 테스트가 통과한다.
