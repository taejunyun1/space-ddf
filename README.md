# Space DDF

Vue 3 기반 Space DDF 전시 및 프로젝트 아카이브입니다.

## 로컬 실행

Node.js와 npm이 필요합니다.

```
npm install
npm run serve
```

## 검증 및 빌드

```
npm run lint
npm run build
npm run smoke
```

운영 빌드는 `dist/`에 생성됩니다. Vite 설정에서 운영 source map 생성을 끄고 있습니다.
`npm run build`는 콘텐츠 이미지 manifest 생성, Vue 앱 빌드, 상세 라우트별 SEO HTML 생성, JSON-LD 구조화 데이터용 CSP 해시 반영을 실행합니다. 이후 cPanel 업로드용 압축 파일 `release/space-ddf-cpanel.zip`을 생성합니다.
`npm run smoke`는 빌드된 앱을 로컬 preview로 띄우고 Chrome headless에서 주요 라우트를 열어 Vue 런타임 오류와 콘솔 error를 검사합니다. 로컬 Chrome이 없으면 `CHROME_PATH` 환경변수로 브라우저 실행 파일 경로를 지정합니다.

## 콘텐츠 추가

전시 및 프로젝트 메타데이터는 `src/stores/content.js`에서 관리합니다. 이미지는 각각 `src/assets/show/<slug>/`, `src/assets/project/<slug>/`에 둡니다.

새 콘텐츠를 공개할 때는 `scripts/content-asset-entries.js`에 동일한 slug를 추가해야 합니다. 이 레지스트리는 공개하지 않은 이미지 폴더가 운영 manifest에 포함되지 않도록 명시적으로 관리합니다.

대표 이미지 미리보기는 WebP 도구의 `cwebp`가 설치된 환경에서 아래 명령으로 다시 생성합니다. 새 콘텐츠를 추가하면 `scripts/generate-previews.sh`와 `src/stores/lib/content-previews.js`에도 항목을 추가합니다.

```
bash scripts/generate-previews.sh
```

갤러리 표시용 responsive WebP는 아래 명령으로 다시 생성합니다. 원본 이미지는 확대 보기와 아카이브 용도로 유지하고, 일반 화면 렌더링에는 `public/img/responsive`의 `srcset` 파생본을 사용합니다.

```
bash scripts/generate-responsive-gallery.sh
```

## SEO 및 배포

- 홈 기본 메타데이터, WebSite 및 ArtGallery JSON-LD, `robots.txt`, `sitemap.xml`은 `public/`에서 관리합니다.
- 상세 라우트 canonical, Open Graph, Twitter, Event 및 Breadcrumb JSON-LD는 `src/lib/seo.js`가 갱신합니다.
- `public/.htaccess`는 Apache 호스팅에서 HTTPS 및 대표 도메인 강제, 보안 헤더, 장기 캐시, SPA 라우트 fallback을 적용합니다.
- `public/_headers`와 `public/_redirects`는 Netlify 및 Cloudflare Pages 계열 정적 호스팅에서 보안 헤더, 장기 캐시, SPA 라우트 fallback을 적용합니다.
- 다른 호스팅을 사용하면 동일한 헤더와 history fallback 규칙을 해당 플랫폼 설정에 옮겨야 합니다.
- cPanel에는 `release/space-ddf-cpanel.zip`을 `public_html`에 업로드한 뒤 압축을 풀면 됩니다. ZIP 내부는 `dist` 폴더가 아니라 `index.html`, `.htaccess`, `js/`, `css/`, `img/` 등이 바로 들어있는 구조입니다.
- 원본 고해상도 이미지는 기본 배포 ZIP에 포함하지 않습니다. 최초 배포 또는 원본 이미지 변경 시 `npm run package:originals`로 `release/space-ddf-originals.zip`을 만들고, 이것도 `public_html`에서 압축 해제합니다. 압축을 풀면 `/originals/show/...`, `/originals/project/...` 경로가 생성되어 확대 보기 원본으로 사용됩니다.

링크 공유 봇처럼 JavaScript를 실행하지 않는 클라이언트에도 상세 라우트별 Open Graph 정보를 제공하려면 배포 플랫폼에서 prerender 또는 SSR을 추가로 구성해야 합니다.
