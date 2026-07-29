const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..')

test('Google Calendar API returns an empty configured=false payload when iCal secret is missing', async () => {
  const {
    handleGoogleCalendarEvents,
  } = await import('../src/server/google-calendar-api.mjs')

  const response = await handleGoogleCalendarEvents({
    request: new Request('https://space-ddf.test/api/calendar/google'),
    env: {},
  })
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(payload.data, [])
  assert.equal(payload.meta.configured, false)
})

test('Google Calendar API normalizes private iCal events for the homepage calendar', async () => {
  const {
    handleGoogleCalendarEvents,
  } = await import('../src/server/google-calendar-api.mjs')
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:rental-20260709@google.com',
    'SUMMARY:Space DDF 대관 - 사운드 프로젝트',
    'DTSTART;VALUE=DATE:20260709',
    'DTEND;VALUE=DATE:20260722',
    'LOCATION:광주 동구 충장로 Space DDF',
    'DESCRIPTION:Google Calendar에서 관리되는 대관 일정',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:workshop-20260913@google.com',
    'SUMMARY:리서치 워크샵',
    'DTSTART;TZID=Asia/Seoul:20260913T140000',
    'DTEND;TZID=Asia/Seoul:20260913T170000',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const response = await handleGoogleCalendarEvents({
    request: new Request('https://space-ddf.test/api/calendar/google'),
    env: {
      GOOGLE_CALENDAR_ICAL_URL: 'https://calendar.google.com/calendar/ical/space.ddf%40gmail.com/private-feed/basic.ics',
    },
    fetcher: async () => new Response(ics, {
      headers: { 'content-type': 'text/calendar; charset=utf-8' },
    }),
  })
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.meta.configured, true)
  assert.equal(payload.data.length, 2)
  assert.deepEqual(payload.data[0], {
    id: 'google-rental-20260709-google-com',
    startDate: '2026-07-09',
    endDate: '2026-07-21',
    type: 'rental',
    label: '대관',
    title: 'Space DDF 대관 - 사운드 프로젝트',
    status: 'confirmed',
    location: '광주 동구 충장로 Space DDF',
    source: 'google-calendar',
  })
  assert.equal(payload.data[1].type, 'workshop')
  assert.equal(payload.data[1].startDate, '2026-09-13')
  assert.equal(payload.data[1].endDate, '2026-09-13')
})

test('Google Calendar route delegates to the shared handler', () => {
  assert.match(
    readProjectFile('functions/api/calendar/google.js'),
    /handleGoogleCalendarEvents/
  )
})

test('Google Calendar parser expands recurring events and applies cancelled exceptions', async () => {
  const { parseGoogleCalendarIcs } = await import('../src/server/google-calendar-api.mjs')
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:weekly@google.com',
    'SUMMARY:정기 리서치 모임',
    'DTSTART;VALUE=DATE:20260701',
    'DTEND;VALUE=DATE:20260702',
    'RRULE:FREQ=WEEKLY;COUNT=3',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:weekly@google.com',
    'RECURRENCE-ID;VALUE=DATE:20260708',
    'DTSTART;VALUE=DATE:20260708',
    'DTEND;VALUE=DATE:20260709',
    'STATUS:CANCELLED',
    'SUMMARY:취소된 일정',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const events = parseGoogleCalendarIcs(ics, { now: new Date('2026-07-11T00:00:00Z') })

  assert.deepEqual(events.map(event => event.startDate), ['2026-07-01', '2026-07-15'])
})

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}
