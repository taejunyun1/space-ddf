import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  BIENNALE_OFFICIAL_URLS,
  parseBiennaleEdition,
  parseBiennaleMainEdition,
  parseBiennalePavilions,
  parseBiennaleVenueEdition,
  runBiennaleEditionIfDue,
  shouldRunBiennaleCrawl,
  webMercatorToWgs84,
} from '../src/biennale-pavilion-crawler.js'
import { statusFromDates } from '../src/artmap-crawler.js'

const pavilionFixture = fs.readFileSync(new URL('./fixtures/biennale-pavilion-venues.html', import.meta.url), 'utf8')
const currentKoreanMainFixture = fs.readFileSync(new URL('./fixtures/biennale-main-current-ko.html', import.meta.url), 'utf8')
const currentEnglishMainFixture = fs.readFileSync(new URL('./fixtures/biennale-main-current-en.html', import.meta.url), 'utf8')
const currentKoreanVenueFixture = fs.readFileSync(new URL('./fixtures/biennale-venues-current-ko.html', import.meta.url), 'utf8')
const currentEnglishVenueFixture = fs.readFileSync(new URL('./fixtures/biennale-venues-current-en.html', import.meta.url), 'utf8')
const edition16VenueFixture = pavilionFixture
  .replace('15th Biennale(2024)', '16th Biennale(2026)')
  .replace('September 7 (Sat) - December 1 (Sun), 2024', 'September 5 - November 15, 2026')
const singlePavilionVenueFixture = edition16VenueFixture.replace(
  /<div class="new_com_box_02">\s*<h4[^>]*><span[^>]*>2<\/span>[\s\S]*?<\/div>/i,
  '',
)

function createBiennaleEnv(overrides = {}, controls = {}) {
  const edition = {
    edition: 16,
    edition_year: 2026,
    start_date: '2026-09-05',
    end_date: '2026-11-15',
    crawl_completed_at: null,
    last_attempt_at: null,
    last_attempt_status: null,
    last_error: null,
    claim_token: null,
    claim_expires_at: null,
    ...overrides,
  }
  const statements = []
  const executedStatements = []
  const batchCalls = []
  const publicRecords = new Map((controls.publicRecords || []).map(record => [record.id, { ...record }]))

  function statementFor(sql, values) {
    const statement = {
      sql,
      values,
      async first() {
        if (/WHERE crawl_completed_at IS NULL/i.test(sql) && edition.crawl_completed_at) return null
        return { ...edition }
      },
      async run() {
        const changes = apply(statement)
        return { success: true, meta: { changes: changes ?? 1 } }
      },
    }
    statements.push(statement)
    return statement
  }

  function apply(statement) {
    executedStatements.push(statement)
    const { sql, values } = statement

    if (/SET\s+claim_token\s*=\s*\?/i.test(sql)) {
      const [token, expiresAt, editionNumber, claimedAt] = values
      const available = edition.edition === editionNumber
        && !edition.crawl_completed_at
        && (!edition.claim_token || !edition.claim_expires_at || edition.claim_expires_at <= claimedAt)
      if (!available) return 0
      edition.claim_token = token
      edition.claim_expires_at = expiresAt
      return 1
    } else if (/crawl_completed_at\s*=\s*\?/i.test(sql)) {
      const claimToken = values.at(-1)
      if (/AND\s+claim_token\s*=\s*\?/i.test(sql) && edition.claim_token !== claimToken) return 0
      edition.crawl_completed_at = values[0]
      edition.last_attempt_at = values[1]
      edition.last_attempt_status = 'success'
      edition.last_error = null
      edition.claim_token = null
      edition.claim_expires_at = null
    } else if (/last_attempt_status\s*=\s*'failed'/i.test(sql)) {
      edition.last_attempt_at = values[0]
      edition.last_attempt_status = 'failed'
      edition.last_error = values[1]
      if (/claim_token\s*=\s*NULL/i.test(sql)) {
        edition.claim_token = null
        edition.claim_expires_at = null
      }
    } else if (/INSERT INTO exhibitions/i.test(sql)) {
      publicRecords.set(values[0], {
        id: values[0],
        title: values[2],
        visibility: values[21],
        sourceName: values[18],
        edition: values[26],
        scrapedAt: values[20],
        lastSeenAt: values[32],
        missCount: 0,
        active: 1,
      })
    } else if (/UPDATE exhibitions[\s\S]*biennale_miss_count/i.test(sql)) {
      for (const record of publicRecords.values()) {
        if (
          record.sourceName === values[1]
          && record.edition === values[2]
          && record.active === 1
          && (!record.lastSeenAt || record.lastSeenAt < values[3])
        ) {
          record.missCount = Number(record.missCount || 0) + 1
          if (record.missCount >= 2) record.active = 0
        }
      }
    }
  }

  return {
    edition,
    statements,
    executedStatements,
    batchCalls,
    publicRecords,
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return statementFor(sql, values)
          },
        }
      },
      async batch(batch) {
        batchCalls.push(batch)
        const failure = controls.batchFailure?.(batch, batchCalls.length)
        if (failure) throw failure
        batch.forEach(apply)
        return batch.map(() => ({ success: true, meta: { changes: 1 } }))
      },
    },
  }
}

function successfulResponse(html = pavilionFixture) {
  return {
    ok: true,
    async text() {
      return html
    },
  }
}

function officialFetch(overrides = {}, calls = []) {
  const pages = {
    [BIENNALE_OFFICIAL_URLS.koreanMain]: currentKoreanMainFixture,
    [BIENNALE_OFFICIAL_URLS.englishMain]: currentEnglishMainFixture,
    [BIENNALE_OFFICIAL_URLS.koreanVenues]: edition16VenueFixture,
    [BIENNALE_OFFICIAL_URLS.englishVenues]: edition16VenueFixture,
    ...overrides,
  }

  return async url => {
    calls.push(url)
    assert.ok(Object.hasOwn(pages, url), `unexpected official URL: ${url}`)
    return successfulResponse(pages[url])
  }
}

function pavilionSection(content) {
  return `<h3 class="new_com_title_01">Gwangju Biennale Pavilion | Venue</h3>${content}`
}

function resetEditionForRecrawl(env) {
  env.edition.crawl_completed_at = null
  env.edition.last_attempt_at = null
  env.edition.last_attempt_status = null
  env.edition.last_error = null
  env.edition.claim_token = null
  env.edition.claim_expires_at = null
}

test('uses only the verified official main, venue, and pavilion overview URLs', () => {
  assert.deepEqual(BIENNALE_OFFICIAL_URLS, {
    koreanMain: 'https://www.gwangjubiennale.org/gb/exhibition/biennale/mainexhibition.do?subPage=overview',
    englishMain: 'https://www.gwangjubiennale.org/en/exhibition/biennale/mainexhibition.do?subPage=overview',
    koreanVenues: 'https://www.gwangjubiennale.org/gb/exhibition/biennale/venues.do',
    englishVenues: 'https://www.gwangjubiennale.org/en/exhibition/biennale/venues.do',
    koreanPavilion: 'https://www.gwangjubiennale.org/gb/exhibition/biennale/pavilion.do',
    englishPavilion: 'https://www.gwangjubiennale.org/en/exhibition/biennale/pavilion.do',
  })
  assert.equal(Object.values(BIENNALE_OFFICIAL_URLS).includes('https://www.gwangjubiennale.org/'), false)
})

test('parses edition 16 independently from the actual current Korean and English main-page shapes', () => {
  const expected = {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  }

  assert.deepEqual(parseBiennaleMainEdition(currentKoreanMainFixture), expected)
  assert.deepEqual(parseBiennaleMainEdition(currentEnglishMainFixture), expected)
  assert.deepEqual(parseBiennaleMainEdition(`
    <div class="ctt_box">
      <h3>You Must Change Your Life</h3>
      <p class="date">September 5 - November 15, 2026</p>
      <div>The 16th Gwangju Biennale explores artistic practice.</div>
    </div>
  `), expected)
})

test('parses official venue-page edition metadata separately from pavilion blocks', () => {
  assert.deepEqual(parseBiennaleVenueEdition(pavilionFixture), {
    edition: 15,
    editionYear: 2024,
    startDate: '2024-09-07',
    endDate: '2024-12-01',
  })
  assert.equal(parseBiennaleVenueEdition(currentKoreanVenueFixture), null)
  assert.equal(parseBiennaleVenueEdition(currentEnglishVenueFixture), null)
})

test('current main plus unpopulated current venues fails closed without archive writes', async () => {
  const env = createBiennaleEnv()
  const urls = []

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: async url => {
      urls.push(url)
      const html = {
        [BIENNALE_OFFICIAL_URLS.koreanMain]: currentKoreanMainFixture,
        [BIENNALE_OFFICIAL_URLS.koreanVenues]: currentKoreanVenueFixture,
        [BIENNALE_OFFICIAL_URLS.englishVenues]: currentEnglishVenueFixture,
      }[url]
      assert.ok(html, `unexpected official URL: ${url}`)
      return successfulResponse(html)
    },
  })

  assert.deepEqual(result, { status: 'edition_mismatch', saved: 0 })
  assert.deepEqual(urls, [
    BIENNALE_OFFICIAL_URLS.koreanMain,
    BIENNALE_OFFICIAL_URLS.koreanVenues,
    BIENNALE_OFFICIAL_URLS.englishVenues,
  ])
  assertNoArchivePersistenceStatements(env)
})

test('current main plus the official edition-15 venue shape returns edition_mismatch', async () => {
  const env = await expectEditionMismatch({ venueHtml: pavilionFixture })

  assert.match(env.edition.last_error, /venue edition mismatch/i)
})

test('runs only for an incomplete edition within its inclusive local dates', () => {
  const edition = {
    startDate: '2026-09-05',
    endDate: '2026-11-15',
    crawlCompletedAt: null,
  }

  assert.equal(shouldRunBiennaleCrawl(edition, '2026-09-04'), false)
  assert.equal(shouldRunBiennaleCrawl(edition, '2026-09-05'), true)
  assert.equal(shouldRunBiennaleCrawl(edition, '2026-11-15'), true)
  assert.equal(shouldRunBiennaleCrawl(edition, '2026-11-16'), false)
  assert.equal(shouldRunBiennaleCrawl({ ...edition, crawlCompletedAt: '2026-09-06T00:00:00.000Z' }, '2026-09-06'), false)
})

test('skips before the Seoul start date without fetching', async () => {
  const env = createBiennaleEnv()
  let fetchCount = 0

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-04T14:59:59.000Z'),
    fetchImpl: async () => {
      fetchCount += 1
      return successfulResponse()
    },
  })

  assert.equal(result.status, 'skipped_before_period')
  assert.equal(fetchCount, 0)
})

test('fetches the official main and venue pages on the Seoul start date for an incomplete edition', async () => {
  const env = createBiennaleEnv()
  const urls = []

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-04T15:00:00.000Z'),
    fetchImpl: officialFetch({}, urls),
  })

  assert.equal(result.status, 'completed')
  assert.deepEqual(urls, [BIENNALE_OFFICIAL_URLS.koreanMain, BIENNALE_OFFICIAL_URLS.koreanVenues])
  assert.notEqual(env.edition.crawl_completed_at, null)
  assert.equal(env.edition.last_attempt_status, 'success')
})

test('skips after the Seoul end date without fetching', async () => {
  const env = createBiennaleEnv()
  let fetchCount = 0

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-11-16T03:00:00.000Z'),
    fetchImpl: async () => {
      fetchCount += 1
      return successfulResponse()
    },
  })

  assert.equal(result.status, 'skipped_after_period')
  assert.equal(fetchCount, 0)
})

test('skips a completed edition without fetching', async () => {
  const env = createBiennaleEnv({ crawl_completed_at: '2026-09-05T01:00:00.000Z' })
  let fetchCount = 0

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-06T03:00:00.000Z'),
    fetchImpl: async () => {
      fetchCount += 1
      return successfulResponse()
    },
  })

  assert.equal(result.status, 'skipped_completed')
  assert.equal(fetchCount, 0)
})

test('records a failed fetch without completing and retries on the next invocation', async () => {
  const env = createBiennaleEnv()
  let fetchCount = 0
  const options = {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: async url => {
      fetchCount += 1
      if (fetchCount === 1) throw new Error('official site unavailable')
      return officialFetch()(url)
    },
  }

  const failed = await runBiennaleEditionIfDue(env, options)

  assert.equal(failed.status, 'failed')
  assert.equal(env.edition.crawl_completed_at, null)
  assert.equal(env.edition.last_attempt_status, 'failed')
  assert.equal(env.edition.claim_token, null)
  assert.equal(env.edition.claim_expires_at, null)
  const failureBatch = env.batchCalls.find(batch => (
    batch.some(statement => /UPDATE crawl_runs/i.test(statement.sql) && statement.values[0] === 'failed')
  ))
  assert.ok(failureBatch)
  assert.equal(failureBatch.some(statement => /UPDATE biennale_editions/i.test(statement.sql) && /claim_token\s*=\s*NULL/i.test(statement.sql)), true)

  const retried = await runBiennaleEditionIfDue(env, options)

  assert.equal(retried.status, 'completed')
  assert.equal(fetchCount, 3)
  assert.notEqual(env.edition.crawl_completed_at, null)
})

test('records a failed parse without completing and retries on the next invocation', async () => {
  const env = createBiennaleEnv()
  let fetchCount = 0
  const unavailableOfficialPage = edition16VenueFixture.replace(/<h4[\s\S]*$/i, '<p>Temporarily unavailable</p>')
  const options = {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: async url => {
      fetchCount += 1
      if (fetchCount <= 3) {
        return officialFetch({
          [BIENNALE_OFFICIAL_URLS.koreanVenues]: unavailableOfficialPage,
          [BIENNALE_OFFICIAL_URLS.englishVenues]: unavailableOfficialPage,
        })(url)
      }
      return officialFetch()(url)
    },
  }

  const failed = await runBiennaleEditionIfDue(env, options)

  assert.equal(failed.status, 'failed')
  assert.equal(env.edition.crawl_completed_at, null)
  assert.equal(env.edition.last_attempt_status, 'failed')

  const retried = await runBiennaleEditionIfDue(env, options)

  assert.equal(retried.status, 'completed')
  assert.equal(fetchCount, 5)
})

test('uses English only as an in-attempt fallback when Korean pavilion blocks lack addresses', async () => {
  const env = createBiennaleEnv()
  const urls = []
  const missingAddress = edition16VenueFixture.replace(/<p class="p_02"><span>Address:[\s\S]*?<\/p>/gi, '')

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: officialFetch({
      [BIENNALE_OFFICIAL_URLS.koreanVenues]: missingAddress,
    }, urls),
  })

  assert.equal(result.status, 'completed')
  assert.deepEqual(urls, [
    BIENNALE_OFFICIAL_URLS.koreanMain,
    BIENNALE_OFFICIAL_URLS.koreanVenues,
    BIENNALE_OFFICIAL_URLS.englishVenues,
  ])
  const sourceRecords = env.statements.filter(statement => /INSERT INTO source_records/i.test(statement.sql))
  assert.deepEqual(sourceRecords.map(statement => statement.values[3]), [
    BIENNALE_OFFICIAL_URLS.englishVenues,
    BIENNALE_OFFICIAL_URLS.englishVenues,
  ])
  const finishedRun = env.statements.find(statement => /UPDATE crawl_runs/i.test(statement.sql) && statement.values[0] === 'success')
  assert.equal(finishedRun.values[5], BIENNALE_OFFICIAL_URLS.englishVenues)
})

test('uses English main metadata only when the Korean main lacks metadata', async () => {
  const env = createBiennaleEnv()
  const urls = []

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: officialFetch({
      [BIENNALE_OFFICIAL_URLS.koreanMain]: '<main><h3>Temporarily unavailable</h3></main>',
    }, urls),
  })

  assert.equal(result.status, 'completed')
  assert.deepEqual(urls, [
    BIENNALE_OFFICIAL_URLS.koreanMain,
    BIENNALE_OFFICIAL_URLS.englishMain,
    BIENNALE_OFFICIAL_URLS.koreanVenues,
  ])
})

test('does not complete when the injected pavilion persistence fails', async () => {
  const env = createBiennaleEnv()

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: officialFetch(),
    persistPavilions: async () => {
      throw new Error('D1 persistence failed')
    },
  })

  assert.equal(result.status, 'failed')
  assert.equal(env.edition.crawl_completed_at, null)
  assert.equal(env.edition.last_attempt_status, 'failed')
})

function assertNoArchivePersistenceStatements(env) {
  assert.equal(env.statements.some(statement => /\b(?:source_records|venues|exhibitions|exhibition_sources|exhibition_artists|exhibition_categories)\b/i.test(statement.sql)), false)
}

async function expectEditionMismatch({
  envOverrides,
  mainHtml = currentKoreanMainFixture,
  venueHtml = edition16VenueFixture,
  now = new Date('2026-09-07T03:00:00.000Z'),
}) {
  const env = createBiennaleEnv(envOverrides)

  const result = await runBiennaleEditionIfDue(env, {
    now,
    fetchImpl: officialFetch({
      [BIENNALE_OFFICIAL_URLS.koreanMain]: mainHtml,
      [BIENNALE_OFFICIAL_URLS.englishMain]: mainHtml,
      [BIENNALE_OFFICIAL_URLS.koreanVenues]: venueHtml,
      [BIENNALE_OFFICIAL_URLS.englishVenues]: venueHtml,
    }),
  })

  assert.deepEqual(result, { status: 'edition_mismatch', saved: 0 })
  assert.equal(env.edition.crawl_completed_at, null)
  assert.equal(env.edition.last_attempt_status, 'failed')
  assertNoArchivePersistenceStatements(env)
  assert.equal(env.executedStatements.some(statement => /UPDATE exhibitions\s+SET active = 0/i.test(statement.sql)), false)
  assert.equal(env.statements.some(statement => /INSERT INTO crawl_runs/i.test(statement.sql)), true)
  assert.equal(env.statements.some(statement => /UPDATE crawl_runs/i.test(statement.sql) && statement.values[0] === 'failed'), true)
  return env
}

test('rejects missing official edition metadata without changing archived pavilions', async () => {
  const env = await expectEditionMismatch({
    mainHtml: '<main><h3>Temporarily unavailable</h3></main>',
  })

  assert.match(env.edition.last_error, /metadata/i)
})

test('rejects a numeric official edition mismatch without changing archived pavilions', async () => {
  const edition15Html = currentKoreanMainFixture.replace('제16회 광주비엔날레', '제15회 광주비엔날레')

  const mismatchEnv = await expectEditionMismatch({
    mainHtml: edition15Html,
  })

  assert.match(mismatchEnv.edition.last_error, /edition mismatch/i)
})

test('rejects an official edition year mismatch without changing archived pavilions', async () => {
  const env = await expectEditionMismatch({
    envOverrides: { edition_year: 2027 },
  })

  assert.match(env.edition.last_error, /edition year mismatch/i)
})

test('rejects official start or end date mismatches without changing archived pavilions', async () => {
  const startMismatch = await expectEditionMismatch({
    envOverrides: { start_date: '2026-09-06' },
  })
  assert.match(startMismatch.edition.last_error, /start date mismatch/i)

  const endMismatch = await expectEditionMismatch({
    envOverrides: { end_date: '2026-11-14' },
  })
  assert.match(endMismatch.edition.last_error, /end date mismatch/i)
})

test('persists each verified pavilion while retaining one shared venue group', async () => {
  const env = createBiennaleEnv()

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: officialFetch(),
  })

  assert.equal(result.status, 'completed')
  assert.equal(result.saved, 2)

  const pavilionUpserts = env.statements.filter(statement => /INSERT INTO exhibitions/i.test(statement.sql))
  assert.equal(pavilionUpserts.length, 2)
  assert.deepEqual(pavilionUpserts.map(statement => statement.values[26]), [16, 16])
  assert.equal(pavilionUpserts[0].values[29], pavilionUpserts[1].values[29])
  assert.match(pavilionUpserts[0].values[29], /^biennale-venue-coordinate-v1\|/)
  assert.equal(env.statements.filter(statement => /UPDATE exhibitions[\s\S]*biennale_miss_count/i.test(statement.sql)).length, 1)
})

test('first successful omission keeps the pavilion active with miss count one', async () => {
  const env = createBiennaleEnv()
  await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: officialFetch(),
  })
  resetEditionForRecrawl(env)

  const recrawl = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T04:00:00.000Z'),
    fetchImpl: officialFetch({
      [BIENNALE_OFFICIAL_URLS.koreanVenues]: singlePavilionVenueFixture,
    }),
  })

  assert.equal(recrawl.status, 'completed')
  const omitted = [...env.publicRecords.values()].find(record => record.title === 'Myanmar Pavilion')
  assert.ok(omitted)
  assert.equal(omitted.active, 1)
  assert.equal(omitted.missCount, 1)
})

test('a reappearing pavilion resets its consecutive omission count to zero', async () => {
  const env = createBiennaleEnv()
  await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: officialFetch(),
  })
  resetEditionForRecrawl(env)
  await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T04:00:00.000Z'),
    fetchImpl: officialFetch({
      [BIENNALE_OFFICIAL_URLS.koreanVenues]: singlePavilionVenueFixture,
    }),
  })
  resetEditionForRecrawl(env)

  const reappeared = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T05:00:00.000Z'),
    fetchImpl: officialFetch(),
  })

  assert.equal(reappeared.status, 'completed')
  const pavilion = [...env.publicRecords.values()].find(record => record.title === 'Myanmar Pavilion')
  assert.equal(pavilion.active, 1)
  assert.equal(pavilion.missCount, 0)
  assert.equal(pavilion.lastSeenAt, '2026-09-05T05:00:00.000Z')
})

test('a second consecutive successful omission deactivates the pavilion', async () => {
  const env = createBiennaleEnv()
  await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: officialFetch(),
  })

  for (const hour of [4, 5]) {
    resetEditionForRecrawl(env)
    const result = await runBiennaleEditionIfDue(env, {
      now: new Date(`2026-09-05T0${hour}:00:00.000Z`),
      fetchImpl: officialFetch({
        [BIENNALE_OFFICIAL_URLS.koreanVenues]: singlePavilionVenueFixture,
      }),
    })
    assert.equal(result.status, 'completed')
  }

  const omitted = [...env.publicRecords.values()].find(record => record.title === 'Myanmar Pavilion')
  assert.equal(omitted.active, 0)
  assert.equal(omitted.missCount, 2)
})

test('validated persistence, omission reconciliation, audit, and completion share one atomic batch', async () => {
  const env = createBiennaleEnv()

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: officialFetch(),
  })

  assert.equal(result.status, 'completed')
  const persistenceBatch = env.batchCalls.find(batch => batch.some(statement => /INSERT INTO source_records/i.test(statement.sql)))
  assert.ok(persistenceBatch)
  assert.equal(persistenceBatch.some(statement => /UPDATE exhibitions[\s\S]*biennale_miss_count/i.test(statement.sql)), true)
  assert.equal(persistenceBatch.some(statement => /UPDATE crawl_runs/i.test(statement.sql) && statement.values[0] === 'success'), true)
  assert.equal(persistenceBatch.some(statement => /UPDATE biennale_editions/i.test(statement.sql) && /crawl_completed_at/i.test(statement.sql)), true)
})

test('an omission reconciliation failure rolls back writes and leaves the prior miss state unchanged', async () => {
  const previousRecord = {
    id: 'prior-omitted-pavilion',
    title: 'Prior Omitted Pavilion',
    visibility: 'public',
    sourceName: '광주비엔날레 파빌리온',
    edition: 16,
    scrapedAt: '2026-09-01T00:00:00.000Z',
    lastSeenAt: '2026-09-01T00:00:00.000Z',
    missCount: 0,
    active: 1,
  }
  const env = createBiennaleEnv({}, {
    publicRecords: [previousRecord],
    batchFailure(batch) {
      if (batch.some(statement => /UPDATE exhibitions[\s\S]*biennale_miss_count/i.test(statement.sql))) {
        return new Error('omission reconciliation failed')
      }
      return null
    },
  })

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: officialFetch({
      [BIENNALE_OFFICIAL_URLS.koreanVenues]: singlePavilionVenueFixture,
    }),
  })

  assert.equal(result.status, 'failed')
  assert.equal(env.edition.crawl_completed_at, null)
  assert.equal(env.edition.claim_token, null)
  assert.deepEqual(env.publicRecords.get(previousRecord.id), previousRecord)
})

test('rolls back the full pavilion batch when its second pavilion write fails', async () => {
  const previousRecord = {
    id: 'prior-public-pavilion',
    title: 'Prior Pavilion',
    visibility: 'public',
    sourceName: '광주비엔날레 파빌리온',
    edition: 16,
    scrapedAt: '2026-09-01T00:00:00.000Z',
    active: 1,
  }
  const env = createBiennaleEnv({}, {
    publicRecords: [previousRecord],
    batchFailure(batch) {
      let pavilionWrites = 0
      for (const statement of batch) {
        if (/INSERT INTO exhibitions/i.test(statement.sql)) pavilionWrites += 1
        if (pavilionWrites === 2) return new Error('second pavilion exhibition write failed')
      }
      return null
    },
  })

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: officialFetch(),
  })

  assert.equal(result.status, 'failed')
  assert.equal(env.edition.crawl_completed_at, null)
  assert.equal(env.edition.last_attempt_status, 'failed')
  assert.deepEqual([...env.publicRecords.values()], [previousRecord])
  assert.equal(env.executedStatements.some(statement => /\b(?:source_records|venues|exhibitions|exhibition_sources|exhibition_artists|exhibition_categories)\b/i.test(statement.sql)), false)
  assert.equal(env.executedStatements.some(statement => /UPDATE exhibitions\s+SET active = 0/i.test(statement.sql)), false)

  const persistenceBatch = env.batchCalls.find(batch => batch.some(statement => /INSERT INTO source_records/i.test(statement.sql)))
  assert.ok(persistenceBatch)
  assert.equal(persistenceBatch.filter(statement => /INSERT INTO source_records/i.test(statement.sql)).length, 2)
  assert.equal(persistenceBatch.filter(statement => /INSERT INTO venues/i.test(statement.sql)).length, 2)
  assert.equal(persistenceBatch.filter(statement => /INSERT INTO exhibitions/i.test(statement.sql)).length, 2)
  assert.equal(persistenceBatch.filter(statement => /INSERT OR IGNORE INTO exhibition_sources/i.test(statement.sql)).length, 2)
  assert.equal(persistenceBatch.some(statement => /UPDATE exhibitions[\s\S]*biennale_miss_count/i.test(statement.sql)), true)
})

test('retries when atomic crawl-success finalization fails without completing the edition', async () => {
  let failFinalization = true
  const env = createBiennaleEnv({}, {
    batchFailure(batch) {
      if (failFinalization && batch.some(statement => /UPDATE crawl_runs/i.test(statement.sql) && statement.values[0] === 'success')) {
        failFinalization = false
        return new Error('crawl success audit update failed')
      }
      return null
    },
  })
  let fetchCount = 0
  const options = {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: async url => {
      fetchCount += 1
      return officialFetch()(url)
    },
  }

  const failed = await runBiennaleEditionIfDue(env, options)

  assert.equal(failed.status, 'failed')
  assert.equal(env.edition.crawl_completed_at, null)
  assert.equal(env.edition.last_attempt_status, 'failed')

  const retried = await runBiennaleEditionIfDue(env, options)

  assert.equal(retried.status, 'completed')
  assert.equal(fetchCount, 4)
  assert.notEqual(env.edition.crawl_completed_at, null)

  const successfulFinalization = env.batchCalls.find(batch => (
    batch.some(statement => /UPDATE crawl_runs/i.test(statement.sql) && statement.values[0] === 'success')
  ))
  assert.ok(successfulFinalization)
  assert.equal(successfulFinalization.some(statement => /UPDATE biennale_editions/i.test(statement.sql) && /crawl_completed_at/i.test(statement.sql)), true)
})

test('calculates exhibition status from Asia/Seoul calendar dates at UTC boundaries', () => {
  assert.equal(statusFromDates('2026-09-05', '2026-11-15', 'unknown', new Date('2026-09-04T14:59:59.999Z')), 'upcoming')
  assert.equal(statusFromDates('2026-09-05', '2026-11-15', 'unknown', new Date('2026-09-04T15:00:00.000Z')), 'ongoing')
  assert.equal(statusFromDates('2026-09-05', '2026-11-15', 'unknown', new Date('2026-11-15T14:59:59.999Z')), 'ongoing')
  assert.equal(statusFromDates('2026-09-05', '2026-11-15', 'unknown', new Date('2026-11-15T15:00:00.000Z')), 'closed')
})

test('biennale migration stores edition gate and pavilion metadata', () => {
  const sql = fs.readFileSync(new URL('../migrations/0011_biennale_pavilions.sql', import.meta.url), 'utf8')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS biennale_editions/)
  assert.match(sql, /crawl_completed_at TEXT/)
  assert.match(sql, /INSERT INTO biennale_editions[\s\S]*2026-09-05[\s\S]*2026-11-15/)
  assert.match(sql, /ALTER TABLE exhibitions ADD COLUMN pavilion_name TEXT/)
  assert.match(sql, /ALTER TABLE exhibitions ADD COLUMN venue_group_key TEXT/)
})

test('biennale lifecycle migration adds a finite claim lease and omission counters', () => {
  const sql = fs.readFileSync(new URL('../migrations/0012_biennale_crawl_lifecycle.sql', import.meta.url), 'utf8')

  assert.match(sql, /ALTER TABLE biennale_editions ADD COLUMN claim_token TEXT/)
  assert.match(sql, /ALTER TABLE biennale_editions ADD COLUMN claim_expires_at TEXT/)
  assert.match(sql, /ALTER TABLE exhibitions ADD COLUMN biennale_last_seen_at TEXT/)
  assert.match(sql, /ALTER TABLE exhibitions ADD COLUMN biennale_miss_count INTEGER NOT NULL DEFAULT 0/)
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_exhibitions_biennale_reconciliation/)
})

test('two concurrent invocations have one claim winner and one zero-fetch loser', async () => {
  const env = createBiennaleEnv()
  const urls = []
  let releaseFirstFetch
  const firstFetchStarted = new Promise(resolve => {
    releaseFirstFetch = resolve
  })
  let unblockWinner
  const winnerBlocked = new Promise(resolve => {
    unblockWinner = resolve
  })
  const fetchImpl = officialFetch({}, urls)
  const blockedFetch = async url => {
    if (urls.length === 0) {
      const response = await fetchImpl(url)
      releaseFirstFetch()
      await winnerBlocked
      return response
    }
    return fetchImpl(url)
  }
  const options = {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: blockedFetch,
  }

  const winnerPromise = runBiennaleEditionIfDue(env, options)
  await firstFetchStarted
  const loserPromise = runBiennaleEditionIfDue(env, options)
  const loser = await loserPromise
  unblockWinner()
  const winner = await winnerPromise

  assert.equal(winner.status, 'completed')
  assert.deepEqual(loser, { status: 'skipped_in_progress' })
  assert.deepEqual(urls, [BIENNALE_OFFICIAL_URLS.koreanMain, BIENNALE_OFFICIAL_URLS.koreanVenues])
  assert.equal(env.executedStatements.filter(statement => /SET\s+claim_token\s*=\s*\?/i.test(statement.sql)).length, 2)
  assert.equal(env.edition.claim_token, null)
  assert.equal(env.edition.claim_expires_at, null)
})

test('an expired claim lease is atomically reclaimed and cleared after success', async () => {
  const env = createBiennaleEnv({
    claim_token: 'abandoned-run',
    claim_expires_at: '2026-09-05T02:59:59.999Z',
  })

  const result = await runBiennaleEditionIfDue(env, {
    now: new Date('2026-09-05T03:00:00.000Z'),
    fetchImpl: officialFetch(),
  })

  assert.equal(result.status, 'completed')
  const claim = env.executedStatements.find(statement => /SET\s+claim_token\s*=\s*\?/i.test(statement.sql))
  assert.ok(claim)
  assert.match(claim.sql, /claim_expires_at\s*<=\s*\?/i)
  assert.equal(env.edition.claim_token, null)
  assert.equal(env.edition.claim_expires_at, null)
})

test('parses official pavilion heading blocks into verified, grouped venue records', () => {
  const html = edition16VenueFixture
  const edition = parseBiennaleVenueEdition(html)
  const records = parseBiennalePavilions(html, edition)

  assert.deepEqual(edition, {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  })
  assert.equal(records.length, 2)
  assert.deepEqual(records.map(record => record.pavilionName), ['Malaysia', 'Myanmar'])
  assert.deepEqual(records.map(record => record.venueName), [
    'National Asian Culture Center(ACC), Creation Space 5',
    'ACC, Creation Space 5',
  ])
  assert.equal(records[0].address, '38, Munhwajeondang-ro, Dong-gu, Gwangju [61485]')
  assert.equal(records[0].hours, 'Tue, Thu, Fri, Sun 10:00-18:00 / Wed, Sat 10:00-20:00')
  assert.equal(records[1].hours, 'Tue, Thu, Fri, Sun 10:00-18:00 / Wed, Sat 10:00-20:00')
  assert.equal(records[0].venueGroupKey, records[1].venueGroupKey)
  assert.equal(records[0].geocodeStatus, 'verified')
  assert.equal(records[0].visibility, 'public')
  assert.equal(records[0].crawlWarning, '')
  assert.ok(records[0].lat >= 34.9 && records[0].lat <= 35.4)
  assert.ok(records[0].lng >= 126.6 && records[0].lng <= 127.1)
  assert.match(records[0].dedupeKey, /^biennale-dedupe-v1\|n:2:16\|s:8:malaysia\|s:52:national asian culture center\(acc\), creation space 5\|d:10:2026-09-05$/)
  assert.match(records[1].dedupeKey, /^biennale-dedupe-v1\|n:2:16\|s:7:myanmar\|s:21:acc, creation space 5\|d:10:2026-09-05$/)
})

test('accepts the Korean venue heading and label variants', () => {
  const html = `
    <h2 class="menu-big-title">제16회 광주비엔날레(2026)</h2>
    <div class="new_viewInfo">
      <h3>관람 안내</h3>
      <p>2026.09.05 ~ 2026.11.15</p>
      <h3>광주비엔날레 파빌리온 | 장소</h3>
      <h4><span>1</span>말레이시아 | 국립아시아문화전당(ACC), 문화창조원 복합5관</h4>
      <p><span>관람시간: </span>10:00-18:00</p>
      <p><span>주소: </span>광주광역시 동구 문화전당로 38 [61485]
        <a href="https://map.naver.com/p/search/address/14128808.1750051,4183958.509357,new">map</a>
      </p>
    </div>
  `
  const edition = parseBiennaleVenueEdition(html)
  const records = parseBiennalePavilions(html, edition)

  assert.deepEqual(edition, {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  })
  assert.equal(records.length, 1)
  assert.equal(records[0].pavilionName, '말레이시아')
  assert.equal(records[0].hours, '10:00-18:00')
  assert.equal(records[0].address, '광주광역시 동구 문화전당로 38 [61485]')
})

test('marks malformed or out-of-bounds maps for review without throwing', () => {
  const edition = {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  }
  const malformed = `
    <h4>3 &amp;nbsp; Test Pavilion | Test &amp; Venue</h4>
    <p>Address: 1  Test St, Gwangju</p>
    <a href="not a url">map</a>
    <h4>4 Example | Other Venue</h4>
    <p>Address: 2 Test St, Gwangju</p>
    <a href="https://map.naver.com/p/address/0,0">map</a>
  `

  const records = parseBiennalePavilions(pavilionSection(malformed), edition)

  assert.equal(records.length, 2)
  assert.deepEqual(records.map(record => record.geocodeStatus), ['needs_review', 'needs_review'])
  assert.deepEqual(records.map(record => record.visibility), ['review', 'review'])
  assert.deepEqual(records.map(record => record.crawlWarning), ['missing_coordinates', 'missing_coordinates'])
  assert.deepEqual(records.map(record => [record.lat, record.lng]), [[null, null], [null, null]])
  assert.equal(records[0].pavilionName, 'Test Pavilion')
  assert.equal(records[0].venueName, 'Test & Venue')
})

test('converts Web Mercator coordinates to WGS84', () => {
  const coordinates = webMercatorToWgs84(14128808.1750051, 4183958.509357)

  assert.ok(Math.abs(coordinates.lat - 35.148) < 0.01)
  assert.ok(Math.abs(coordinates.lng - 126.921) < 0.01)
})

test('parses named and numeric dash entities in bounded edition dates', () => {
  const namedEntity = `
    <h3>The 16th Gwangju Biennale Pavilion</h3>
    <p>Dates: September 5 &ndash; November 15, 2026</p>
  `
  const numericEntity = `
    <h3>The 16th Gwangju Biennale Pavilion</h3>
    <p>Dates: September 5 &#x2013; November 15, 2026</p>
  `

  assert.deepEqual(parseBiennaleEdition(namedEntity), {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  })
  assert.deepEqual(parseBiennaleEdition(numericEntity), {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  })
})

test('extracts nested address and hours labels from bounded paragraphs', () => {
  const edition = {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  }
  const html = `
    <h4>1 Test Pavilion | Test Venue</h4>
    <p><strong>Hours:</strong> 10:00 &ndash; 18:00</p>
    <p><strong>Address:</strong> 38, Munhwajeondang-ro, Dong-gu, Gwangju [61485]</p>
    <a href="https://map.naver.com/p/address/14128808.1750051,4183958.509357">map</a>
  `

  assert.deepEqual(parseBiennalePavilions(pavilionSection(html), edition).map(record => [record.hours, record.address]), [[
    '10:00 – 18:00',
    '38, Munhwajeondang-ro, Dong-gu, Gwangju [61485]',
  ]])
})

test('uses the verified coordinate rather than address spelling for venue groups', () => {
  const edition = {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  }
  const html = `
    <h4>1 First Pavilion | ACC</h4>
    <p>Address: 38 Munhwajeondang-ro, Dong-gu, Gwangju</p>
    <a href="https://map.naver.com/p/address/14128808.1750051,4183958.509357">map</a>
    <h4>2 Second Pavilion | ACC</h4>
    <p>Address: 38, Munhwajeondang-ro, Dong-gu, Gwangju [61485]</p>
    <a href="https://map.naver.com/p/address/14128808.1750051,4183958.509357">map</a>
  `

  const records = parseBiennalePavilions(pavilionSection(html), edition)

  assert.equal(records[0].venueGroupKey, records[1].venueGroupKey)
  assert.match(records[0].venueGroupKey, /^biennale-venue-coordinate-v1\|/)
})

test('uses unambiguous NFC-normalized dedupe components without collisions', () => {
  const edition = {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  }
  const html = `
    <h4>1 A &amp; B | Venue</h4>
    <p>Address: 1 Test St, Gwangju</p>
    <h4>2 AB | Venue</h4>
    <p>Address: 2 Test St, Gwangju</p>
    <h4>3 Caf\u00e9 | Venue</h4>
    <p>Address: 3 Test St, Gwangju</p>
    <h4>4 Cafe\u0301 | Venue</h4>
    <p>Address: 4 Test St, Gwangju</p>
  `

  const records = parseBiennalePavilions(pavilionSection(html), edition)

  assert.notEqual(records[0].dedupeKey, records[1].dedupeKey)
  assert.equal(records[2].dedupeKey, records[3].dedupeKey)
  assert.match(records[0].dedupeKey, /^biennale-dedupe-v1\|n:2:16\|s:5:a & b\|s:5:venue\|d:10:2026-09-05$/)
})

test('keeps an addressless verified venue in review while retaining its coordinate group', () => {
  const edition = {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  }
  const html = `
    <h4>1 Test Pavilion | Usable Venue</h4>
    <p>Hours: 10:00-18:00</p>
    <a href="https://map.naver.com/p/address/14128808.1750051,4183958.509357">map</a>
  `

  const [record] = parseBiennalePavilions(pavilionSection(html), edition)

  assert.equal(record.address, '')
  assert.equal(record.geocodeStatus, 'verified')
  assert.equal(record.visibility, 'review')
  assert.equal(record.crawlWarning, 'missing_address')
  assert.match(record.venueGroupKey, /^biennale-venue-coordinate-v1\|/)
})

test('parses named and numeric em dash entities in bounded edition dates', () => {
  for (const separator of ['&mdash;', '&#8212;', '&#x2014;']) {
    const html = `
      <h3>The 16th Gwangju Biennale Pavilion</h3>
      <p>Dates: September 5 ${separator} November 15, 2026</p>
    `

    assert.deepEqual(parseBiennaleEdition(html), {
      edition: 16,
      editionYear: 2026,
      startDate: '2026-09-05',
      endDate: '2026-11-15',
    }, separator)
  }
})

test('extracts bounded div labels without reading script, style, or the next pavilion block', () => {
  const edition = {
    edition: 16,
    editionYear: 2026,
    startDate: '2026-09-05',
    endDate: '2026-11-15',
  }
  const html = `
    <h4>1 First Pavilion | First Venue</h4>
    <script><div>Address: Scripted Address</div></script>
    <style>.hours::before { content: 'Hours: Scripted Hours'; }</style>
    <div><strong>Address:</strong> First &amp; Main Street, Gwangju</div>
    <div>Hours: 10:00 &#8212; 18:00</div>
    <h4>2 Second Pavilion | Second Venue</h4>
    <div><strong>Address:</strong> Second Address, Gwangju</div>
    <div>Hours: 11:00-19:00</div>
  `

  assert.deepEqual(parseBiennalePavilions(pavilionSection(html), edition).map(record => [record.address, record.hours]), [
    ['First & Main Street, Gwangju', '10:00 — 18:00'],
    ['Second Address, Gwangju', '11:00-19:00'],
  ])
})
