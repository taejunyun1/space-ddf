# Cloudflare 콘텐츠 관리 배포

## 1. R2 버킷 생성

```bash
npx wrangler r2 bucket create space-ddf-content-assets
```

Pages 프로젝트에는 `CONTENT_ASSETS` 이름으로 버킷을 연결한다. `wrangler.jsonc`와 `wrangler.pages.example.jsonc`에 동일한 바인딩이 정의돼 있다.

## 2. D1 마이그레이션

로컬 검증:

```bash
npx wrangler d1 migrations apply space-ddf-rentals --local
```

운영 반영:

```bash
npx wrangler d1 migrations apply space-ddf-rentals --remote
```

## 3. 기존 콘텐츠 확인과 이전

먼저 파일 수와 파싱 결과만 확인한다.

```bash
npm run content:migrate -- --dry-run
```

로컬 D1/R2 개발 환경에 이전:

```bash
npm run content:migrate
```

운영 환경에 이전:

```bash
npm run content:migrate -- --remote
```

마이그레이션은 `type + slug`를 기준으로 upsert하고 R2의 legacy 경로를 사용하므로 다시 실행할 수 있다. 자동 연결하지 못한 포스터는 admin의 이미지 섹션에서 지정한다.

## 4. 빌드와 배포 전 검증

```bash
npm test
npm run lint
npm run build:pages
```

배포 후 확인:

- `/manage/contents`가 로그인 뒤 열리는지 확인
- Show와 Project 임시 콘텐츠 각각 한 개 생성
- 포스터와 갤러리 업로드
- 공개 후 메인 목록과 상세 URL 확인
- 비공개 전환 후 공개 API에서 사라지는지 확인
- 휴지통 이동 후 관리자 목록 필터 확인

## 롤백

이전 Pages 배포 버전으로 되돌리면 프런트엔드는 기존 정적 `content.js`와 `src/assets`를 그대로 사용한다. D1과 R2 데이터는 삭제하지 않고 유지한다. 공개 API 장애 시 현재 프런트엔드도 정적 콘텐츠 fallback을 사용한다.

