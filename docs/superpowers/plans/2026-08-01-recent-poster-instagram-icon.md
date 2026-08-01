# Recent Poster and Instagram Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render only the clickable poster in Recent Updated and replace Instagram URL text in detail credits with an accessible SVG icon.

**Architecture:** `RecentComponent.vue` becomes a poster-only link component. Credit URL parsing moves to a focused utility that classifies valid Instagram links, while `DetailView.vue` selects a reusable SVG icon component for that link kind and preserves ordinary URL text links.

**Tech Stack:** Vue 3, Pinia, Node test runner, Playwright CLI, Cloudflare Pages/Wrangler.

## Global Constraints

- Keep the `Recent Updated` section heading and latest-featured selection behavior.
- Keep the poster clickable and preserve its natural aspect ratio.
- Hide Recent title, date, credits, description, and `자세히 보기` text.
- Convert only `instagram.com` and subdomain URLs to SVG icon links.
- Preserve ordinary external links as text links and retain new-tab security attributes.
- Preserve the existing admin and D1 payload formats.

---

### Task 1: Make Recent Updated poster-only

**Files:**
- Modify: `test/home-rental-calendar.test.js`
- Modify: `src/components/RecentComponent.vue`
- Modify: `src/views/HomeView.vue`

**Interfaces:**
- Consumes: `imageSrc`, `title`, and `link` props.
- Produces: a poster-only anchor or non-link wrapper with accessible image alt text.

- [ ] **Step 1: Write the failing test**

Assert that `RecentComponent.vue` contains `recent-figure` and the clickable `link`, but no `recent-meta`, `recent-name`, `recent-date`, `recent-desc`, or `recent-link`. Assert HomeView passes only image, title, and link.

- [ ] **Step 2: Verify RED**

Run: `node --test test/home-rental-calendar.test.js`

Expected: FAIL because Recent still renders metadata.

- [ ] **Step 3: Implement poster-only rendering**

Remove metadata markup, unused props and styles. Remove `date-range` and `desc` bindings from both HomeView Recent instances while retaining title for image alt text.

- [ ] **Step 4: Verify GREEN**

Run: `node --test test/home-rental-calendar.test.js`

Expected: all home/rental tests PASS.

### Task 2: Classify credit links and render Instagram SVG

**Files:**
- Create: `src/lib/credit-links.js`
- Create: `src/components/icons/InstagramIcon.vue`
- Modify: `src/views/DetailView.vue`
- Modify: `test/content-frontend.test.js`

**Interfaces:**
- Produces: `parseCreditLine(text): { prefix: string, href: string, label: string, kind: 'instagram'|'external'|'none' }`.
- Produces: `InstagramIcon.vue`, a 16px `currentColor` SVG with `aria-hidden="true"`.

- [ ] **Step 1: Write failing parser and rendering tests**

Import `parseCreditLine` and assert Instagram, `www.instagram.com`, ordinary homepage, invalid URL, and no-URL results. Assert DetailView renders `InstagramIcon`, an `aria-label` ending in `Instagram 열기`, and ordinary link labels.

- [ ] **Step 2: Verify RED**

Run: `node --test test/content-frontend.test.js`

Expected: FAIL because the parser module and icon component do not exist.

- [ ] **Step 3: Implement the parser and icon**

Move safe URL parsing from DetailView into `credit-links.js`, classify hostname `instagram.com` or `.instagram.com` as `instagram`, and return `external` for other HTTP(S) URLs. Add the standard outline Instagram SVG using `currentColor`.

- [ ] **Step 4: Implement conditional credit rendering**

For Instagram credits, keep `credit.prefix` visible and render an icon-only anchor with an accessible name. For external credits, keep the current URL text. Retain `target="_blank"` and `rel="noopener noreferrer"` for both.

- [ ] **Step 5: Verify GREEN**

Run: `node --test test/content-frontend.test.js`

Expected: all content frontend tests PASS.

### Task 3: Regression, visual QA, and deployment

**Files:**
- Verify: all modified source and test files
- Artifacts: `output/playwright/recent-poster-*.png`, `output/playwright/detail-instagram-*.png`

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: verified and deployed production UI.

- [ ] **Step 1: Run repository verification**

Run: `npm run lint && npm test && npm run build:pages`

Expected: lint, all app and scraper tests, and Pages build exit 0.

- [ ] **Step 2: Run local browser QA**

At desktop and 390px widths, verify Recent contains only the poster and remains clickable. Open `/shows/myulmang-unboxing`, verify five Instagram icons align beside participant names, URL text is absent, links have accessible names, and no horizontal overflow occurs.

- [ ] **Step 3: Deploy Pages**

Run: `npx wrangler pages deploy dist --project-name space-ddf-home --branch space-ddf --commit-dirty=true`

Expected: Wrangler reports deployment complete.

- [ ] **Step 4: Run production QA**

Verify the same Recent and detail behaviors on `https://spaceddf.xyz`, run the production smoke command, and confirm `/manage*` remains 404.
