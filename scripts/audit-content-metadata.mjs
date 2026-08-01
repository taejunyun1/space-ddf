import { fileURLToPath } from 'node:url'

import {
  normalizeCreditLabel,
  normalizeCreditUrl,
  parseCreditRecord,
} from '../src/lib/credit-links.js'
import { exportStaticContent } from './export-static-content.mjs'

const CONTENT_TYPES = new Set(['show', 'project'])

export function auditContentMetadata(contents = []) {
  const issues = []

  for (const item of contents || []) {
    const add = (code, detail = '') => issues.push({
      type: String(item?.type || ''),
      slug: String(item?.slug || ''),
      code,
      detail,
    })

    if (!CONTENT_TYPES.has(item?.type)) add('unsupported-type', String(item?.type || ''))

    const date = String(item?.startDate || item?.dateDisplay || item?.dateRange || '').trim()
    if (!/\d{4}/.test(date)) add('missing-date')

    const location = String(item?.location || '').trim()
    if (/^https?:\/\//i.test(location)) add('url-location', location)

    for (const record of item?.credits || []) {
      const rawLabel = record && typeof record === 'object'
        ? String(record.label || '').trim()
        : String(record || '').trim().split(/\s+/)[0] || ''
      const parsed = parseCreditRecord(record)

      if (rawLabel && normalizeCreditLabel(rawLabel) !== rawLabel) {
        add('noncanonical-label', rawLabel)
      }
      if (!parsed.value && !parsed.href) add('empty-credit', rawLabel)

      const rawUrl = record && typeof record === 'object' ? String(record.url || '').trim() : ''
      if (rawUrl && !normalizeCreditUrl(rawUrl)) add('invalid-credit-url', rawUrl)
    }
  }

  return issues
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { contents } = exportStaticContent()
  const issues = auditContentMetadata(contents)

  for (const issue of issues) process.stderr.write(`${JSON.stringify(issue)}\n`)
  process.stdout.write(`${contents.length} contents audited; ${issues.length} issues\n`)
  if (issues.length) process.exitCode = 1
}
