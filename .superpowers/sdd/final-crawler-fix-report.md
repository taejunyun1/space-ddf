# Final crawler fix report: official Biennale lifecycle hardening

## Scope

This follow-up closes the three final-review blockers for the Gwangju Biennale
pavilion crawler: exact official-source validation, a pre-network atomic crawl
lease, and two-strike omission reconciliation. It does not deploy or mutate the
live Worker or D1 database.

## Official source evidence

The following official pages were inspected on 2026-08-02 (Asia/Seoul), and the
test suite uses minimized local fixtures rather than live network requests:

- Korean main exhibition: `https://www.gwangjubiennale.org/gb/exhibition/biennale/mainexhibition.do?subPage=overview`
- English main exhibition: `https://www.gwangjubiennale.org/en/exhibition/biennale/mainexhibition.do?subPage=overview`
- Korean current venues: `https://www.gwangjubiennale.org/gb/exhibition/biennale/venues.do`
- English current venues: `https://www.gwangjubiennale.org/en/exhibition/biennale/venues.do`
- Korean pavilion overview: `https://www.gwangjubiennale.org/gb/exhibition/biennale/pavilion.do`
- English pavilion overview: `https://www.gwangjubiennale.org/en/exhibition/biennale/pavilion.do`
- Historical edition-15 venue structure: `https://www.gwangjubiennale.org/en/exhibition/past/15.do?subPageCode=venues`

The current main-exhibition pages identify the 16th edition and the exact period
`2026-09-05` through `2026-11-15`. The current venue pages do not yet expose
independently verifiable venue/date content, while the pavilion overviews still
describe edition 15. The crawler therefore returns `edition_mismatch` and writes
no pavilion or omission state for the currently published official combination.

## RED

Focused tests were added before each implementation slice and failed for the
expected missing behavior:

- Source/parser tests initially failed because the production module did not
  export or request the exact official endpoints and could accept stale current
  content.
- Lease tests initially failed because migration `0012` and the conditional
  claim statement did not exist; two concurrent runs both reached `fetch`.
- Reset tests initially failed because the authenticated reset SQL did not clear
  claim ownership or expiry.
- Omission tests initially failed because a first omission immediately
  deactivated a record, reappearance did not reset a miss counter, and crawl
  success finalization was not in the same D1 batch as reconciliation.

## GREEN

Implementation now provides:

- exact Korean-first main and venue requests with English fallback only when the
  relevant Korean metadata or records are incomplete;
- independent edition, year, start-date, and end-date validation for both the
  main and venue page before any pavilion write;
- comment/script/style stripping and official Korean/English markup parsing;
- a 15-minute conditional D1 lease acquired before `fetch`, zero-fetch losers,
  expired-lease recovery, owner-scoped release, and reset cleanup;
- source records, canonical URLs, and crawl audit URLs tied to the actual
  official page requested;
- `biennale_last_seen_at` and `biennale_miss_count`, with reappearance resetting
  the counter and deactivation only after two consecutive verified omissions;
- one production D1 batch for seen-record persistence, omission reconciliation,
  successful crawl audit, completion marking, and lease release. D1 batch
  failure commits none of those successful-lifecycle steps.

## Verification

Focused Worker crawler suite:

```sh
npm run test:crawler
```

Result: 82 passed, 0 failed.

Complete repository suite:

```sh
npm test
```

Result: 238 main/Worker tests and 10 scraper tests passed. The existing Node
`MODULE_TYPELESS_PACKAGE_JSON` warnings remain non-failing and are unrelated to
this change.

Static verification and Pages build:

```sh
npm run lint
npm run build:pages
git diff --check
```

Result: lint and whitespace checks passed; Vite transformed 125 modules,
prerendered 24 detail routes, applied the CSP hashes, and completed the
production Pages build.

A Node `DatabaseSync` probe applied migrations `0001` through `0012` in order
to a fresh in-memory SQLite database, executed the production
`buildUpsertBiennaleExhibitionStatement`, and read back:

```text
edition=16
biennale_last_seen_at=2026-08-02T00:00:00.000Z
biennale_miss_count=0
active=1
```

The probe also confirmed `claim_token`/`claim_expires_at` on
`biennale_editions` and both omission columns on `exhibitions`.

Worker bundle verification (from `cloudflare/`):

```sh
npx --no-install wrangler deploy --dry-run --outdir <temporary-directory>
```

Result: Wrangler 4.118.0 produced a 118.96 KiB bundle (28.47 KiB gzip), listed
the expected D1/environment bindings, and exited explicitly in dry-run mode.

## Operational notes

- Until the official current venue pages publish independently verifiable
  edition-16 dates and venue blocks, a live in-period attempt is expected to
  fail closed with `edition_mismatch` and remain retryable.
- The fixture README records provenance and capture date; tests make no live
  official-site calls.
- No deployment, remote migration, or live endpoint invocation is part of this
  change.

## Final re-review follow-up: lease loss inside successful persistence

### RED

The first lifecycle implementation checked the owner-conditional completion
update only after `DB.batch()` returned. SQLite treats an update that changes
zero rows as successful, so the preceding pavilion upserts and omission update
had already committed if a reset or a new owner removed the original token.

The test D1 harness now returns each statement's actual change count and restores
its edition/pavilion snapshots when any batch statement throws. Three focused
regressions initially failed:

- a lease reclaimed immediately before persistence committed two pavilion rows
  and incremented the prior pavilion's omission counter;
- an authenticated reset during the venue fetch produced the same partial
  lifecycle commit;
- an unclaimed crawl running beyond the 15-minute lease completed instead of
  failing safely.

Focused RED result: 0 passed, 3 failed with the expected committed-write and
miss-counter diffs.

### GREEN

The successful persistence batch now begins with a `SELECT CASE` ownership
assertion requiring the same edition, incomplete crawl, owner token, and an
expiry later than the finalization timestamp. Its false branch evaluates
SQLite's deterministic `abs(-9223372036854775808)` integer-overflow error. D1
therefore aborts and rolls back the batch before any pavilion or omission
mutation. The existing owner-conditional completion update remains the final
defence.

Focused GREEN result: all 3 race tests passed; the complete focused crawler/API
suite passed 57 tests.

### Follow-up verification

```sh
npm run test:crawler
npm test
npm run lint
npm run build:pages
```

Result: 85 crawler tests, 241 main/Worker tests, and 10 scraper tests passed;
lint and the production Pages build completed successfully.

A fresh in-memory `DatabaseSync` probe applied migrations `0001` through `0012`,
ran the production crawler through the reclaim-before-persistence race, and
executed its real prepared statements inside a SQLite transaction. The guard
raised `integer overflow`; the result was `failed`, the only pre-existing
pavilion remained active with `biennale_miss_count=0`, no new pavilion existed,
`crawl_completed_at` stayed null, and the reclaimed owner's token/expiry were
preserved.

Wrangler 4.118.0 local D1 independently returned `claim_owned=1` for the true
guard branch and `integer overflow: SQLITE_ERROR` for the false branch. The
final Worker `deploy --dry-run` produced a 119.95 KiB bundle (28.80 KiB gzip)
with the expected bindings and exited without deployment.
