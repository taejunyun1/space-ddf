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
