# Biennale Task 5 Report

## Delivered

- Added authenticated, POST-only `POST /api/archive/crawl/gwangju-biennale`, which calls `runBiennaleEditionIfDue` without any force or bypass option.
- Added authenticated, POST-only `POST /api/archive/crawl/gwangju-biennale/reset`, accepting only a positive integer `edition` and using a bound SQL parameter.
- Reset clears only the selected edition's `crawl_completed_at`, `last_attempt_at`, `last_attempt_status`, and `last_error`; invalid and missing editions return deterministic 400 and 404 responses.
- Added the gated Biennale runner to the existing `Promise.allSettled` scheduled crawl isolation.
- Documented once-per-edition behavior and the emergency reset procedure.

## Verification

- RED: `node --test test/archive-api-security.test.js cloudflare/test/biennale-pavilion-crawler.test.js` failed with missing 405 routes and scheduled runner.
- GREEN: the same focused command passes (38 tests).
- Full: `npm test && npm run lint` passes (216 primary tests, 10 scraper tests, lint).

No live external requests were made.
