# `/admin` 관리자 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 렌탈과 콘텐츠 관리 기능을 주소 변경 없이 `/admin` 한 화면에서 제공한다.

**Architecture:** `AdminView.vue`가 탭 상태와 콘텐츠 미리보기 모달을 소유하고 기존 관리 뷰를 패널로 조합한다. Cloudflare Pages 인증 진입점도 `/admin` 하나로 변경하며 관리자 API 경로는 유지한다.

**Tech Stack:** Vue 3 Composition API, Vue Router, Cloudflare Pages Functions, Node test runner

## Global Constraints

- 관리자 프론트엔드 라우트는 `/admin` 하나만 등록한다.
- `/api/manage/*`는 내부 API이므로 유지한다.
- 콘텐츠 미리보기는 `/admin` 내부 모달로 표시한다.
- 기존 렌탈 및 콘텐츠 관리 기능을 보존한다.

---

### Task 1: 단일 관리자 라우트와 인증 진입점

**Files:**
- Modify: `test/content-frontend.test.js`
- Modify: `test/home-rental-calendar.test.js`
- Modify: `test/manage-auth.test.js`
- Modify: `test/cloudflare-pages-deploy.test.js`
- Modify: `src/router/index.js`
- Modify: `src/server/manage-auth.mjs`
- Modify: `functions/admin/[[path]].js`
- Modify: `public/_routes.json`
- Modify: `scripts/prerender-seo.js`
- Delete: `functions/manage/[[path]].js`
- Delete: `src/server/admin-page.mjs`

**Interfaces:**
- Produces: Vue route `{ path: '/admin', name: 'admin', component: AdminView }`
- Produces: `handleManagePageRoute(context)`가 `/admin`에서 로그인 폼 또는 앱 셸 응답

- [x] **Step 1: Write the failing tests**

라우터에서 `/admin`만 허용하고 `_routes.json`이 `['/api/*', '/admin']`인지, 인증 성공 후 `/admin`으로 돌아오는지 단언한다.

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test test/content-frontend.test.js test/home-rental-calendar.test.js test/manage-auth.test.js test/cloudflare-pages-deploy.test.js`

Expected: 기존 `/manage/*` 및 `/admin/*` 경로 때문에 FAIL.

- [x] **Step 3: Write minimal implementation**

라우터의 관리 하위 경로를 제거하고 `/admin`을 `AdminView.vue`에 연결한다. 인증 폼의 action과 성공 목적지를 `/admin`으로 바꾸고 Pages Functions 범위를 `/admin`으로 축소한다.

- [x] **Step 4: Run tests to verify they pass**

Run: `node --test test/content-frontend.test.js test/home-rental-calendar.test.js test/manage-auth.test.js test/cloudflare-pages-deploy.test.js`

Expected: PASS.

### Task 2: 렌탈·콘텐츠 통합 화면과 내부 미리보기

**Files:**
- Create: `src/views/AdminView.vue`
- Create: `src/components/admin/ContentPreviewModal.vue`
- Modify: `src/views/AdminRentalsView.vue`
- Modify: `src/views/AdminContentsView.vue`
- Delete: `src/views/AdminContentPreviewView.vue`
- Modify: `test/content-frontend.test.js`

**Interfaces:**
- `AdminView.vue` owns `activeArea: 'rentals' | 'contents'`
- `AdminContentsView.vue` emits `preview(content)`
- `ContentPreviewModal.vue` consumes `content` and emits `close`

- [x] **Step 1: Write the failing test**

`AdminView.vue`에 두 탭과 두 패널이 있고, 콘텐츠 화면은 `window.open` 또는 `/manage/contents`를 사용하지 않으며 `preview` 이벤트를 내보낸다고 단언한다.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test test/content-frontend.test.js`

Expected: `AdminView.vue` 및 모달이 없어 FAIL.

- [x] **Step 3: Write minimal implementation**

`AdminView.vue`에서 버튼 탭으로 두 기존 뷰를 전환하고 콘텐츠 미리보기 이벤트를 모달에 전달한다. 기존 뷰의 페이지 제목과 중복 내비게이션을 패널 문맥에 맞게 정리한다.

- [x] **Step 4: Run test to verify it passes**

Run: `node --test test/content-frontend.test.js`

Expected: PASS.

### Task 3: 회귀 검증

**Files:**
- Modify: `docs/superpowers/plans/2026-07-29-admin-unified-route.md`

- [x] **Step 1: Run the complete suite**

Run: `npm test`

Expected: 모든 root 및 scraper 테스트 PASS.

- [x] **Step 2: Check lint and production build**

Run: `npm run lint && npm run build:pages`

Expected: ESLint 오류 없이 Vite 빌드와 prerender 완료.

- [ ] **Step 3: Commit**

Run: `git add`로 이번 기능 파일만 스테이징한 뒤 `git commit -m "2026-07-29 admin 렌탈 콘텐츠 단일 화면 통합"`.
