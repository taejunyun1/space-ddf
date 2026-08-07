# Mobile Exhibition Field and Rental Dock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dock Exhibition Field and a 40px Space Rental CTA together at the bottom of mobile screens.

**Architecture:** Keep the two existing homepage sections in their current document order so desktop layout remains unchanged. Mobile-only CSS fixes Exhibition Field immediately above the fixed rental CTA and reserves their combined height in the page.

**Tech Stack:** Vue 3 SFC, scoped CSS, Node test runner, Vite, Playwright CLI, Cloudflare Pages

## Global Constraints

- Mobile breakpoint is `max-width: 768px`.
- The dock contains Exhibition Field immediately followed by Space Rental with 0px gap.
- The mobile rental row is 40px tall before safe-area compensation.
- Desktop layout and publication data flow do not change.

---

### Task 1: Mobile bottom dock

**Files:**
- Modify: `src/views/HomeView.vue`
- Modify: `test/archive-index-design.test.js`

**Interfaces:**
- Consumes: existing `.exhibition-field` and `.archive-rental-cta` blocks.
- Produces: a shared mobile dock formed by adjacent fixed `.exhibition-field` and `.archive-rental-cta` blocks.

- [ ] Write a failing source regression test for the adjacent mobile dock CSS.
- [ ] Run `node --test test/archive-index-design.test.js` and confirm the new assertion fails.
- [ ] Add minimal mobile CSS for the fixed field, 40px CTA, safe-area, and content clearance without changing desktop markup.
- [ ] Re-run the focused test and confirm it passes.
- [ ] Run `npm test`, `npm run lint`, and `npm run build:pages` serially.
- [ ] At 390px, verify the dock is visible at load, sits at the viewport bottom, and does not create horizontal overflow.
- [ ] Commit, merge to `main`, push, deploy to Cloudflare production branch `space-ddf`, and verify `spaceddf.xyz`.
