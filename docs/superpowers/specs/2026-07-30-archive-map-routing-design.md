# Archive Map Routing Design

## Goal

Cloudflare Pages의 운영 주소 `https://spaceddf.xyz/archive-map`을 새로 요청하거나 새로고침해도 SPA가 정상 진입하고, Google Maps 지도가 렌더링되도록 한다.

## Root Cause

Vue Router에는 `/archive-map` 경로가 있지만, Pages 배포용 빌드의 `STATIC_SPA_ROUTES`에는 `/rental`과 `/admin`만 포함되어 있다. 그 결과 `dist/archive-map/index.html`이 생성되지 않으며 Cloudflare Pages는 직접 요청에 `404 Not Found`를 반환한다.

Google Maps API 키의 HTTP referrer 제한에는 별도로 `https://spaceddf.xyz/*`를 추가하고 저장했다. 따라서 이 변경은 API 키가 아니라 정적 SPA 진입 파일 누락만 해결한다.

## Design

기존 `scripts/prerender-seo.js`의 `STATIC_SPA_ROUTES`에 `/archive-map`을 추가한다. 빌드 시 기존 `dist/index.html` 템플릿을 `dist/archive-map/index.html`로 복제하므로, Cloudflare Pages가 직접 요청을 `200`으로 제공하고 Vue Router가 아카이브 화면을 마운트한다.

모든 미등록 경로를 SPA로 보내는 범용 fallback은 추가하지 않는다. `/manage`, `/manage/contents`, `/admin/contents`처럼 의도적으로 제거한 주소는 계속 `404`를 반환해야 한다.

## Files

- `test/cloudflare-pages-deploy.test.js`: `/archive-map`이 정적 SPA 경로 목록에 포함된다는 회귀 테스트를 추가한다.
- `scripts/prerender-seo.js`: `STATIC_SPA_ROUTES`에 `/archive-map`을 추가한다.
- `scripts/smoke-test.js`: 배포 후 공개 경로 점검 목록에 `/archive-map`을 추가한다.

## Testing

1. 수정 전 회귀 테스트가 `/archive-map` 누락으로 실패하는지 확인한다.
2. 최소 구현 후 해당 테스트와 전체 테스트를 실행한다.
3. Pages 빌드를 실행하고 `dist/archive-map/index.html`이 생성되는지 확인한다.
4. 운영 배포 후 `/archive-map`이 `200`인지 확인한다.
5. 실제 브라우저에서 referrer 오류 문구가 사라지고 Google Maps DOM이 생성되는지 확인한다.
6. `/manage`, `/manage/contents`, `/admin/contents`가 계속 `404`인지 확인한다.

## Error Handling

빌드에서 `dist/index.html`이 없으면 기존 프리렌더 오류를 그대로 사용한다. 운영 지도에서 Google Maps 로딩이 실패하면 기존 `ArchiveMap.vue`의 사용자 안내 문구와 콘솔 오류를 QA 신호로 사용한다.

## Scope

지도 UI, 아카이브 데이터 수집, Google Maps API 종류, API 키 값, 관리자 라우팅은 변경하지 않는다.
