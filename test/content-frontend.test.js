import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

test('content service exposes public hydration and manager mutations', () => {
  const source = read('src/services/contents.js')
  for (const name of [
    'fetchPublishedContents',
    'fetchFeaturedContent',
    'fetchAdminContents',
    'createAdminContent',
    'updateAdminContent',
    'publishAdminContent',
    'uploadAdminContentAsset',
  ]) {
    assert.match(source, new RegExp(`export async function ${name}`))
  }
})

test('content hydration keeps successful lists when the featured request fails', () => {
  const source = read('src/stores/lib/content-actions.js')

  assert.match(source, /fetchFeaturedContent/)
  assert.match(source, /Promise\.allSettled/)
  assert.match(source, /featuredContent/)
  assert.match(source, /featuredResult\.status === 'fulfilled'/)
})

test('Recent Updated prioritizes the server-featured content over exhibition dates', () => {
  const source = read('src/stores/lib/content-getters.js')

  assert.match(source, /recent\(\)\s*{[\s\S]*return this\.featuredContent \|\| this\.allSortedByDateDesc\[0\] \|\| null/)
  assert.match(source, /item\?\.preview \|\| item\?\.thumb \|\| state\.defaultThumb/)
})

test('content store keeps static data when public hydration fails', () => {
  const source = read('src/stores/lib/content-actions.js')
  assert.match(source, /hydratePublishedContents/)
  assert.match(source, /catch[\s\S]*contentSource = 'static'/)
  assert.match(source, /managedSlugs/)
  assert.match(source, /fallback\.filter\(item => !managed\.has\(item\.slug\)\)/)
})

test('app hydrates managed content before mounting route views', () => {
  const source = read('src/main.js')
  const hydration = source.indexOf('await useContentStore(pinia).hydratePublishedContents()')
  const mount = source.indexOf("app.mount('#app')")

  assert.notEqual(hydration, -1)
  assert.notEqual(mount, -1)
  assert.ok(hydration < mount)
})

test('router exposes the unified admin manager', () => {
  const source = read('src/router/index.js')
  assert.match(source, /path:\s*'\/admin'/)
  assert.match(source, /name:\s*'admin'/)
  assert.match(source, /AdminView\.vue/)
  assert.doesNotMatch(source, /path:\s*'\/manage|path:\s*'\/admin\//)
})

test('content manager uses the approved navigation editor and publish panels', () => {
  const source = read('src/views/AdminContentsView.vue')
  assert.match(source, /admin-content-nav/)
  assert.match(source, /<ContentEditor/)
  assert.match(source, /<ContentPublishPanel/)
  assert.match(source, /if \(!await saveDraft\(\)\) return/)
  assert.match(source, /draft\.value = await publishAdminContent\(draft\.value\.id\)/)
  assert.match(source, /목록과 Recent Updated에 공개했습니다/)
})

test('content editor makes Show or Project explicit and removes manual exposure switches', () => {
  const source = read('src/components/admin/ContentEditor.vue')

  assert.match(source, /<fieldset class="content-type-field">/)
  assert.match(source, /<legend>콘텐츠 유형<\/legend>/)
  assert.match(source, /type="radio"[^>]+value="show"/)
  assert.match(source, /type="radio"[^>]+value="project"/)
  assert.doesNotMatch(source, /modelValue\.showOnHome/)
  assert.doesNotMatch(source, /modelValue\.isFeatured/)
  assert.doesNotMatch(source, /메인 목록에 표시|Recent Updated 대표 콘텐츠/)
})

test('content editor defers text updates while a Korean IME composition is active', async () => {
  const { finishTextComposition, startTextComposition, updateTextInput } = await import('../src/lib/text-input.js')
  const target = { value: 'ㄴ' }
  const updates = []

  startTextComposition({ target })
  updateTextInput({ target, isComposing: true }, value => updates.push(value))
  assert.deepEqual(updates, [])

  target.value = '나'
  finishTextComposition({ target }, value => updates.push(value))
  assert.deepEqual(updates, ['나'])
})

test('detail credits render Instagram URLs as accessible SVG icon links', () => {
  const detail = read('src/views/DetailView.vue')

  assert.match(detail, /import InstagramIcon from/)
  assert.match(detail, /entry\.kind === 'instagram'/)
  assert.match(detail, /<InstagramIcon/)
  assert.match(detail, /:aria-label="`\$\{entry\.value \|\| group\.label\} Instagram 열기`"/)
  assert.match(detail, /target="_blank"/)
  assert.match(detail, /rel="noopener noreferrer"/)
})

test('detail basic information renders fixed grouped rows before custom credits', () => {
  const detail = read('src/views/DetailView.vue')

  assert.match(detail, /groupContentCredits/)
  assert.match(detail, /creditGroups/)
  assert.match(detail, /v-for="group in creditGroups"/)
  assert.match(detail, /class="credit-label"/)
  assert.match(detail, /v-for="\(entry, entryIndex\) in group\.entries"/)
  assert.match(detail, /class="credit-values"/)
  assert.doesNotMatch(detail, /v-for="\(credit, i\) in creditLines"/)
})

test('detail hides empty credit groups while the admin keeps all standard inputs', () => {
  const detail = read('src/views/DetailView.vue')
  const editor = read('src/components/admin/ContentEditor.vue')

  assert.match(detail, /\.filter\(group => group\.entries\.length > 0\)/)
  assert.match(editor, /STANDARD_CREDIT_LABELS/)
})

test('home and detail list summaries use the shared URL-free credit formatter', () => {
  const home = read('src/views/HomeView.vue')
  const detail = read('src/views/DetailView.vue')

  assert.match(home, /formatCreditSummary/)
  assert.match(detail, /formatCreditSummary/)
  assert.doesNotMatch(home, /credits\.join\(', '\)/)
  assert.doesNotMatch(detail, /credits[\s\S]*?\.join\(', '\)/)
})

test('credit parser distinguishes Instagram, external, and plain-text credits', async () => {
  const { parseCreditLine } = await import('../src/lib/credit-links.js')

  assert.deepEqual(
    parseCreditLine('참여작가 김현석 https://www.instagram.com/kmhnsk/'),
    {
      prefix: '참여작가 김현석',
      href: 'https://www.instagram.com/kmhnsk/',
      label: 'https://www.instagram.com/kmhnsk/',
      kind: 'instagram',
    }
  )
  assert.equal(parseCreditLine('참여작가 신혜란 https://instagram.com/hr__s12').kind, 'instagram')
  assert.deepEqual(parseCreditLine('Homepage www.taejunyun.com'), {
    prefix: 'Homepage',
    href: 'https://www.taejunyun.com',
    label: 'www.taejunyun.com',
    kind: 'external',
  })
  assert.deepEqual(parseCreditLine('기획 신수와'), {
    prefix: '기획 신수와',
    href: '',
    label: '',
    kind: 'none',
  })
})

test('admin basic information uses fixed credit groups with repeatable linked contributors', () => {
  const editor = read('src/components/admin/ContentEditor.vue')
  const manager = read('src/views/AdminContentsView.vue')

  assert.match(editor, /STANDARD_CREDIT_LABELS/)
  assert.match(editor, /class="structured-credit-fields wide"/)
  assert.match(editor, /standardCreditGroups/)
  assert.match(editor, /addStandardCredit/)
  assert.match(editor, /setStandardCreditFromInput/)
  assert.match(editor, /placeholder="Instagram 또는 URL \(선택\)"/)
  assert.match(editor, /customCreditRows/)
  assert.match(editor, /기타 정보 추가/)
  assert.match(editor, /:key="`\$\{group\.label\}-\$\{rowIndex\}`"/)
  assert.doesNotMatch(editor, /:key="`\$\{group\.label\}-\$\{row\.sourceIndex\}-\$\{rowIndex\}`"/)
  assert.match(editor, /section === 'basic'[\s\S]*structured-credit-fields/)
  assert.doesNotMatch(editor, /section === 'content'[\s\S]*<strong>크레딧<\/strong>/)
  assert.match(manager, /field === 'credits'[^?]*\? 'basic'/)
})

test('admin publish validation requires a populated labeled credit', () => {
  const manager = read('src/views/AdminContentsView.vue')

  assert.match(manager, /credits\?\.some\(credit => credit\?\.label\?\.trim\(\) && credit\?\.value\?\.trim\(\)\)/)
  assert.match(manager, /내용이 있는 크레딧을 한 개 이상 입력해주세요/)
})

test('admin exposes the complete Project and Show basic information format', async () => {
  const editor = read('src/components/admin/ContentEditor.vue')
  const { STANDARD_CREDIT_LABELS } = await import('../src/lib/credit-links.js')

  assert.deepEqual(STANDARD_CREDIT_LABELS, [
    'Artists', 'Curating', 'Critic', 'Graphic', 'Support', 'Archive', 'Directing',
  ])
  for (const copy of [
    '콘텐츠 유형', 'Show', 'Project', 'Slug', '제목', '시작일', '종료일',
    '표시용 날짜', '장소', '기타 정보', 'Instagram 또는 URL',
  ]) {
    assert.match(editor, new RegExp(copy))
  }
  assert.match(editor, /@compositionstart=/)
  assert.match(editor, /@compositionend=/)
  assert.match(editor, /addStandardCredit/)
  assert.match(editor, /addCustomCredit/)
})
