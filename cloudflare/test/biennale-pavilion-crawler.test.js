import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

test('biennale migration stores edition gate and pavilion metadata', () => {
  const sql = fs.readFileSync(new URL('../migrations/0011_biennale_pavilions.sql', import.meta.url), 'utf8')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS biennale_editions/)
  assert.match(sql, /crawl_completed_at TEXT/)
  assert.match(sql, /INSERT INTO biennale_editions[\s\S]*2026-09-05[\s\S]*2026-11-15/)
  assert.match(sql, /ALTER TABLE exhibitions ADD COLUMN pavilion_name TEXT/)
  assert.match(sql, /ALTER TABLE exhibitions ADD COLUMN venue_group_key TEXT/)
})
