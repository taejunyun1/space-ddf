import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

test('global styles expose the approved Archive Index tokens', () => {
  const styles = read('src/assets/styles/global.css')

  for (const token of [
    '--ddf-paper-soft',
    '--ddf-line-soft',
    '--ddf-signal',
    '--ddf-route',
    '--ddf-space-1',
    '--ddf-space-8',
  ]) {
    assert.match(styles, new RegExp(token))
  }
})

test('home follows the approved poster-first Archive Index hierarchy', () => {
  const home = read('src/views/HomeView.vue')

  const hero = home.indexOf('class="archive-hero"')
  const recent = home.indexOf('class="archive-recent"')
  const field = home.indexOf('class="exhibition-field"')
  const rental = home.indexOf('class="archive-rental-cta"')

  assert.ok(hero > -1)
  assert.ok(hero < recent)
  assert.ok(recent < field)
  assert.ok(field < rental)
  assert.match(home, /전시 아카이브/)
  assert.match(home, /전시 레이더/)
  assert.match(home, /경로 만들기/)
  assert.match(home, /전시·워크숍 대관 문의/)
})

test('home content indexes use natural height without nested list scrolling', () => {
  const home = read('src/views/HomeView.vue')

  assert.doesNotMatch(home, /scroll-control-btn/)
  assert.doesNotMatch(home, /@scroll\.passive/)
  assert.doesNotMatch(home, /overflow-y:\s*auto/)
  assert.doesNotMatch(home, /--bottom-list-height/)
})

test('mobile home preserves poster, recent, field, and rental document order', () => {
  const home = read('src/views/HomeView.vue')
  const mobile = home.match(/@media \(max-width: 768px\)[\s\S]*?<\/style>/)?.[0] || ''

  assert.match(mobile, /\.archive-hero\s*{[\s\S]*grid-template-columns:\s*1fr/)
  assert.match(mobile, /\.archive-rental-cta\s*{[\s\S]*background:\s*var\(--ddf-signal\)/)
  assert.doesNotMatch(mobile, /position:\s*fixed/)
})

test('app shell exposes the approved top-level Archive Index navigation', () => {
  const app = read('src/App.vue')
  const router = read('src/router/index.js')

  assert.match(app, /class="archive-site-header"/)
  assert.match(app, />Show</)
  assert.match(app, />Project</)
  assert.match(app, />Archive</)
  assert.match(app, />Rental</)
  assert.match(app, />About</)
  assert.ok(app.indexOf('>About<') < app.indexOf('>Rental<'))
  assert.match(app, /grid-template-columns:\s*1fr/)
  assert.match(app, /<router-link to="\/home#show">Show<\/router-link>/)
  assert.match(router, /if \(to\.hash\) return \{ el: to\.hash/)
  assert.match(app, /:inert="isAsideOpen \? undefined : ''"/)
  assert.match(app, /min-height:\s*44px/)
  assert.match(app, /const wasOpen = isAsideOpen\.value/)
  assert.match(app, /if \(wasOpen\) nextTick\(\(\) => menuButtonRef\.value\?\.focus\(\)\)/)
})

test('home shows opening hours and exposes every Recent poster to horizontal browsing', () => {
  const home = read('src/views/HomeView.vue')

  assert.match(home, /recentHours/)
  assert.match(home, /<dt>Hours<\/dt>/)
  assert.match(home, /sortByPublishedAtDesc/)
  assert.doesNotMatch(home, /allSortedByDateDesc\.slice\(0, 8\)/)
  assert.match(home, /class="ddf-visually-hidden"[^>]*>[\s\S]*item\.title[\s\S]*item\.dateRange/)
  assert.doesNotMatch(home, /filter:\s*saturate/)
  assert.match(home, /\.archive-record-list time, \.archive-record-list small, \.exhibition-field small\s*{\s*font-size:\s*12px/)
})

test('desktop hero contains long Korean titles inside the metadata column', () => {
  const home = read('src/views/HomeView.vue')

  assert.match(home, /\.archive-hero-copy h2\s*{[^}]*overflow-wrap:\s*anywhere/)
  assert.match(home, /font-size:\s*clamp\(30px,\s*3vw,\s*44px\)/)
})
