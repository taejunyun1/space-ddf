import test from 'node:test'
import assert from 'node:assert/strict'

const creditLinks = await import('../src/lib/credit-links.js')

test('credit labels normalize legacy aliases into the standard information labels', () => {
  assert.equal(typeof creditLinks.normalizeCreditLabel, 'function')
  assert.equal(creditLinks.normalizeCreditLabel('참여작가'), 'Artists')
  assert.equal(creditLinks.normalizeCreditLabel('기획'), 'Curating')
  assert.equal(creditLinks.normalizeCreditLabel('비평'), 'Critic')
  assert.equal(creditLinks.normalizeCreditLabel('그래픽'), 'Graphic')
  assert.equal(creditLinks.normalizeCreditLabel('후원'), 'Support')
  assert.equal(creditLinks.normalizeCreditLabel('기록'), 'Archive')
  assert.equal(creditLinks.normalizeCreditLabel('디렉팅'), 'Directing')
  assert.equal(creditLinks.normalizeCreditLabel('Homepage'), 'Homepage')
})

test('credits group in fixed order while preserving empty standards and custom labels', () => {
  assert.equal(typeof creditLinks.groupContentCredits, 'function')
  const grouped = creditLinks.groupContentCredits([
    { label: '참여작가', value: '김현석', url: 'https://www.instagram.com/kmhnsk/' },
    '참여작가 신혜란 https://instagram.com/hr__s12',
    { label: '기획', value: '신수와', url: '' },
    'Homepage www.taejunyun.com',
  ])

  assert.deepEqual(grouped.standard.map(group => group.label), [
    'Artists', 'Curating', 'Critic', 'Graphic', 'Support', 'Archive', 'Directing',
  ])
  assert.deepEqual(grouped.standard[0].entries.map(entry => entry.value), ['김현석', '신혜란'])
  assert.equal(grouped.standard[0].entries[0].kind, 'instagram')
  assert.equal(grouped.standard[2].entries.length, 0)
  assert.deepEqual(grouped.custom.map(group => group.label), ['Homepage'])
  assert.equal(grouped.custom[0].entries[0].href, 'https://www.taejunyun.com')
})

test('credit summaries group names and never expose contributor URLs', () => {
  assert.equal(typeof creditLinks.formatCreditSummary, 'function')

  const summary = creditLinks.formatCreditSummary([
    '참여작가 김현석 https://www.instagram.com/kmhnsk/',
    '참여작가 신혜란 https://www.instagram.com/hr__s12/',
    '기획 신수와',
  ])

  assert.equal(summary, 'Artists 김현석, 신혜란, Curating 신수와')
  assert.doesNotMatch(summary, /instagram\.com|https?:\/\//)
})
