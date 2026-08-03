const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..')
const readProjectFile = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('shared HTML exposes NAVER verification exactly once', () => {
  const html = readProjectFile('index.html')
  assert.equal((html.match(/name="naver-site-verification"/g) || []).length, 1)
  assert.match(html, /content="db3ba905f8c30216f6a47a1d221582fdb5bef855"/)
})

test('rental sitemap entry is canonical and high priority', () => {
  const sitemap = readProjectFile('public/sitemap.xml')
  assert.match(sitemap, /<loc>https:\/\/spaceddf\.xyz\/rental<\/loc>[\s\S]*?<changefreq>weekly<\/changefreq>[\s\S]*?<priority>0\.9<\/priority>/)
})

test('rental SEO contract targets art exhibitions and workshops only', async () => {
  const seo = await import('../src/lib/rental-seo.mjs')
  assert.equal(seo.RENTAL_CANONICAL_PATH, '/rental')
  assert.match(seo.RENTAL_TITLE, /광주 전시공간 대관/)
  assert.match(seo.RENTAL_DESCRIPTION, /예술전시/)
  assert.match(seo.RENTAL_DESCRIPTION, /워크숍/)
  assert.doesNotMatch(`${seo.RENTAL_TITLE} ${seo.RENTAL_DESCRIPTION}`, /촬영 스튜디오|상업 팝업|파티/)
  const graph = seo.rentalStructuredData({ siteUrl: 'https://spaceddf.xyz', venue: { '@type': ['ArtGallery', 'EventVenue'], '@id': 'https://spaceddf.xyz/#organization' } })
  assert.ok(graph['@graph'].some(item => item['@type'] === 'Service'))
  assert.ok(graph['@graph'].some(item => item['@type'] === 'FAQPage'))
})

test('browser SEO recognizes rental as its own canonical route', () => {
  const source = readProjectFile('src/lib/seo.js')
  assert.match(source, /route\.name === 'rental'/)
  assert.match(source, /RENTAL_CANONICAL_PATH/)
  assert.match(source, /rentalStructuredData/)
})

test('rental page has one search-intent H1 and renders shared FAQ copy', () => {
  const view = readProjectFile('src/views/RentalView.vue')
  assert.equal((view.match(/<h1[\s>]/g) || []).length, 1)
  assert.match(view, /광주 전시공간 대관/)
  assert.match(view, /v-for="item in rentalFaqs"/)
  assert.match(view, /RENTAL_FAQS/)
  assert.doesNotMatch(view, /촬영 스튜디오|상업 팝업|파티 대관/)
})

test('public exhibition details link contextually to rental', () => {
  const view = readProjectFile('src/views/DetailView.vue')
  assert.match(view, /to="\/rental"/)
  assert.match(view, /광주 전시공간 대관/)
})
