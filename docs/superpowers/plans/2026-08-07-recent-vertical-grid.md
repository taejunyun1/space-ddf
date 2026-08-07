# Recent Updated Vertical Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove horizontal scrolling from `Recent Updated` and render its posters as a responsive 3/2/1-column vertical grid.

**Architecture:** Keep the existing `HomeView.vue` markup and data flow. Lock the behavior with a source-level design regression test, then replace only the poster-strip CSS so all cards wrap inside the viewport.

**Tech Stack:** Vue 3 SFC, CSS Grid, Node test runner, Vite, Cloudflare Pages

## Global Constraints

- Desktop uses 3 equal columns, tablet uses 2, and mobile uses 1.
- Preserve poster aspect ratio, cover cropping, and the existing line-based visual language.
- Remove horizontal overflow and scroll snapping.
- Do not modify content ordering or admin publication behavior.

---

### Task 1: Lock the responsive grid behavior

**Files:**
- Modify: `test/archive-index-design.test.js`
- Modify: `src/views/HomeView.vue`

**Interfaces:**
- Consumes: `.archive-poster-strip` and `.archive-poster-link` CSS hooks.
- Produces: a responsive poster grid with no horizontal scrolling.

- [ ] **Step 1: Write the failing test**

Add an assertion that the home source contains `repeat(3, minmax(0, 1fr))`, tablet `repeat(2, minmax(0, 1fr))`, mobile `grid-template-columns: minmax(0, 1fr)`, and does not contain `overflow-x: auto` or `scroll-snap-type`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/archive-index-design.test.js`

Expected: FAIL because the source still contains the eight-column horizontal strip.

- [ ] **Step 3: Implement the minimal CSS change**

Set the base poster grid to three equal columns, set each link to `min-width: 0`, change the 1100px breakpoint to two equal columns, and the 768px breakpoint to one column. Remove horizontal overflow and scroll-snap declarations.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test test/archive-index-design.test.js`

Expected: all tests pass.

- [ ] **Step 5: Run full verification**

Run: `npm test`, `npm run lint`, and `npm run build:pages`.

Expected: zero test failures, zero lint errors, production build exit code 0.

- [ ] **Step 6: Perform browser overflow QA**

Serve the production build and inspect desktop and mobile widths. Confirm `document.documentElement.scrollWidth === document.documentElement.clientWidth` and capture screenshots.

- [ ] **Step 7: Commit and deploy**

Commit the test, CSS, spec, and plan with a dated Korean summary. Push `main`, deploy `dist` to Cloudflare Pages project `space-ddf-home` on production branch `space-ddf`, and verify `https://spaceddf.xyz` serves the new asset hashes with HTTP 200.
