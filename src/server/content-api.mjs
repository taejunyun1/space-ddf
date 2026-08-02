import { normalizeCreditLabel, normalizeCreditUrl } from '../lib/credit-links.js'

const CONTENT_TYPES = new Set(['show', 'project'])
const CONTENT_STATUSES = new Set(['draft', 'published', 'unpublished'])
const ASSET_ROLES = new Set(['poster', 'preview', 'gallery'])
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

export function normalizeContentInput(input = {}) {
  const text = value => String(value ?? '').trim()
  const integer = value => Number.isFinite(Number(value)) ? Number(value) : 0

  return {
    id: text(input.id),
    type: text(input.type),
    slug: text(input.slug).toLowerCase(),
    title: text(input.title),
    startDate: text(input.startDate),
    endDate: text(input.endDate),
    dateDisplay: text(input.dateDisplay || input.dateRange),
    location: text(input.location),
    body: text(input.body),
    description: text(input.description),
    status: CONTENT_STATUSES.has(input.status) ? input.status : 'draft',
    showOnHome: input.showOnHome !== false,
    isFeatured: input.isFeatured === true,
    sortOrder: integer(input.sortOrder),
    credits: Array.isArray(input.credits)
      ? input.credits
        .map((credit, index) => ({
          label: normalizeCreditLabel(text(credit?.label)),
          value: text(credit?.value),
          url: normalizeCreditUrl(credit?.url),
          sortOrder: integer(credit?.sortOrder ?? index),
        }))
        .filter(credit => credit.value || credit.url)
      : [],
    assets: Array.isArray(input.assets)
      ? input.assets
        .map((asset, index) => ({
          id: text(asset?.id),
          role: text(asset?.role),
          url: text(asset?.url),
          originalUrl: text(asset?.originalUrl),
          altText: text(asset?.altText),
          caption: text(asset?.caption),
          sortOrder: integer(asset?.sortOrder ?? index),
          uploadStatus: text(asset?.uploadStatus || 'pending'),
        }))
        .filter(asset => ASSET_ROLES.has(asset.role))
      : [],
  }
}

export function validateContentDraft(input = {}) {
  const content = normalizeContentInput(input)
  const fields = {}

  if (content.type && !CONTENT_TYPES.has(content.type)) {
    fields.type = '타입은 show 또는 project여야 합니다.'
  }
  if (content.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(content.slug)) {
    fields.slug = 'slug는 영문 소문자, 숫자와 하이픈만 사용할 수 있습니다.'
  }
  if (content.endDate && content.startDate && content.endDate < content.startDate) {
    fields.endDate = '종료일은 시작일보다 빠를 수 없습니다.'
  }

  return { ok: Object.keys(fields).length === 0, fields, content }
}

export function validateContentForPublish(input = {}) {
  const draft = validateContentDraft(input)
  const { content } = draft
  const fields = { ...draft.fields }

  if (!content.type) fields.type = '타입을 선택해주세요.'
  if (!content.slug) fields.slug = 'slug를 입력해주세요.'
  if (!content.title) fields.title = '제목을 입력해주세요.'
  if (!content.startDate) fields.startDate = '시작일을 입력해주세요.'
  if (!content.body && !content.description) fields.body = '소개 또는 본문을 입력해주세요.'
  if (!content.credits.some(credit => credit.label && credit.value)) {
    fields.credits = '내용이 있는 크레딧을 한 개 이상 입력해주세요.'
  }
  if (!content.assets.some(asset => asset.role === 'poster' && asset.uploadStatus === 'ready')) {
    fields.poster = '포스터를 업로드해주세요.'
  }
  if (content.assets.some(asset => asset.uploadStatus !== 'ready')) {
    fields.assets = '업로드가 끝나지 않은 이미지가 있습니다.'
  }

  return { ok: Object.keys(fields).length === 0, fields, content }
}

export async function handleManageContentRequest(context) {
  const { request, env = {} } = context
  const db = requireBinding(env, 'DB')
  const path = new URL(request.url).pathname.replace(/^\/api\/manage\/contents\/?/, '')
  const segments = path.split('/').filter(Boolean)

  if (!segments.length && request.method === 'GET') return listManagerContents(db, request)
  if (!segments.length && request.method === 'POST') return createContent(db, await readJson(request))

  const [id, action, assetId] = segments
  if (action === 'assets' && request.method === 'POST') return uploadAsset(env, id, request)
  if (action === 'assets' && assetId && request.method === 'PATCH') {
    return updateAsset(db, id, assetId, await readJson(request))
  }
  if (action === 'assets' && assetId && request.method === 'DELETE') return deleteAsset(env, id, assetId)
  if (action === 'publish' && request.method === 'POST') return publishContent(db, id)
  if (action === 'unpublish' && request.method === 'POST') return unpublishContent(db, id)
  if (action === 'restore' && request.method === 'POST') return restoreContent(db, id)
  if (action === 'duplicate' && request.method === 'POST') return duplicateContent(db, id)
  if (!action && request.method === 'GET') return getManagerContent(db, id)
  if (!action && request.method === 'PATCH') return updateContent(db, id, await readJson(request))
  if (!action && request.method === 'DELETE') return trashContent(db, id)

  return jsonError(404, 'content_route_not_found', '콘텐츠 요청을 찾을 수 없습니다.')
}

export async function handlePublicContentRequest(context) {
  const { request, env = {} } = context
  const db = requireBinding(env, 'DB')
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api\/contents\/?/, '')
  const segments = path.split('/').filter(Boolean)

  if (!segments.length) {
    const type = url.searchParams.get('type') || ''
    if (type && !CONTENT_TYPES.has(type)) return jsonError(400, 'invalid_type', '콘텐츠 타입을 확인해주세요.')
    const [result, managed] = await Promise.all([
      db.prepare(`
      SELECT payload_json FROM content_publications
      WHERE (? = '' OR type = ?)
      ORDER BY published_at DESC
    `).bind(type, type).all(),
      db.prepare(`SELECT slug FROM contents WHERE deleted_at IS NULL AND (? = '' OR type = ?)`)
        .bind(type, type).all(),
    ])
    return json({
      data: result.results.map(row => JSON.parse(row.payload_json)),
      managedSlugs: managed.results.map(row => row.slug),
    })
  }

  if (segments[0] === 'featured') {
    const row = await db.prepare(`
      SELECT p.payload_json FROM content_publications p
      JOIN contents c ON c.id = p.content_id
      WHERE c.is_featured = 1 AND c.deleted_at IS NULL
      ORDER BY p.published_at DESC LIMIT 1
    `).first()
    return json({ data: row ? JSON.parse(row.payload_json) : null })
  }
  if (segments[0] === 'assets' && segments[1]) return serveAsset(env, segments[1])
  if (segments[0] === 'redirect' && segments.length === 3) {
    const row = await db.prepare(`
      SELECT c.type, c.slug FROM content_slug_history h
      JOIN contents c ON c.id = h.content_id
      WHERE h.type = ? AND h.old_slug = ?
    `).bind(segments[1], segments[2]).first()
    if (!row) return jsonError(404, 'content_not_found', '콘텐츠를 찾을 수 없습니다.')
    return Response.redirect(new URL(`/${row.type === 'show' ? 'shows' : 'projects'}/${row.slug}`, request.url), 308)
  }

  if (segments.length === 2 && CONTENT_TYPES.has(segments[0])) {
    const row = await db.prepare(`
      SELECT payload_json FROM content_publications WHERE type = ? AND slug = ?
    `).bind(segments[0], segments[1]).first()
    return row
      ? json({ data: JSON.parse(row.payload_json) })
      : jsonError(404, 'content_not_found', '콘텐츠를 찾을 수 없습니다.')
  }

  return jsonError(404, 'content_route_not_found', '콘텐츠 요청을 찾을 수 없습니다.')
}

async function listManagerContents(db, request) {
  const url = new URL(request.url)
  const includeDeleted = url.searchParams.get('includeDeleted') === 'true'
  const type = url.searchParams.get('type') || ''
  const query = `%${url.searchParams.get('q') || ''}%`
  const status = url.searchParams.get('status') || ''
  const deletedOnly = url.searchParams.get('deletedOnly') === 'true'
  const result = await db.prepare(`
    SELECT * FROM contents
    WHERE ((? = 1 AND deleted_at IS NOT NULL) OR (? = 0 AND (? = 1 OR deleted_at IS NULL)))
      AND (? = '' OR type = ?)
      AND (? = '' OR status = ?)
      AND (title LIKE ? OR slug LIKE ?)
    ORDER BY updated_at DESC
  `).bind(
    deletedOnly ? 1 : 0, deletedOnly ? 1 : 0, includeDeleted ? 1 : 0,
    type, type, status, status, query, query,
  ).all()
  return json({ data: result.results.map(mapContentRow) })
}

async function createContent(db, input) {
  const validation = validateContentDraft(input)
  if (!validation.ok) return validationError(validation.fields)
  const content = validation.content
  const id = crypto.randomUUID()
  const slug = content.slug || `draft-${id.slice(0, 8)}`
  const now = new Date().toISOString()
  await db.prepare(`
    INSERT INTO contents (
      id, type, slug, title, start_date, end_date, date_display, location, body,
      description, status, show_on_home, is_featured, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
  `).bind(
    id, content.type || 'show', slug, content.title, content.startDate || null,
    content.endDate || null, content.dateDisplay, content.location, content.body,
    content.description, content.showOnHome ? 1 : 0, content.isFeatured ? 1 : 0,
    content.sortOrder, now, now,
  ).run()
  await replaceCredits(db, id, content.credits)
  return json({ data: await loadManagerContent(db, id) }, 201)
}

async function getManagerContent(db, id) {
  const content = await loadManagerContent(db, id)
  return content ? json({ data: content }) : jsonError(404, 'content_not_found', '콘텐츠를 찾을 수 없습니다.')
}

async function updateContent(db, id, input) {
  const current = await loadManagerContent(db, id)
  if (!current) return jsonError(404, 'content_not_found', '콘텐츠를 찾을 수 없습니다.')
  const merged = normalizeContentInput({ ...current, ...input })
  const validation = validateContentDraft(merged)
  if (!validation.ok) return validationError(validation.fields)
  if (merged.slug !== current.slug) {
    await db.prepare(`
      INSERT OR IGNORE INTO content_slug_history (id, content_id, type, old_slug)
      VALUES (?, ?, ?, ?)
    `).bind(crypto.randomUUID(), id, current.type, current.slug).run()
  }
  await db.prepare(`
    UPDATE contents SET type=?, slug=?, title=?, start_date=?, end_date=?, date_display=?,
      location=?, body=?, description=?, show_on_home=?, is_featured=?, sort_order=?,
      updated_at=? WHERE id=?
  `).bind(
    merged.type, merged.slug, merged.title, merged.startDate || null, merged.endDate || null,
    merged.dateDisplay, merged.location, merged.body, merged.description,
    merged.showOnHome ? 1 : 0, merged.isFeatured ? 1 : 0, merged.sortOrder,
    new Date().toISOString(), id,
  ).run()
  if (input.credits) await replaceCredits(db, id, merged.credits)
  return json({ data: await loadManagerContent(db, id) })
}

async function publishContent(db, id) {
  const content = await loadManagerContent(db, id)
  if (!content) return jsonError(404, 'content_not_found', '콘텐츠를 찾을 수 없습니다.')
  const validation = validateContentForPublish(content)
  if (!validation.ok) return validationError(validation.fields)
  const now = new Date().toISOString()
  const publishedContent = {
    ...validation.content,
    showOnHome: true,
    isFeatured: true,
  }
  const payload = publicPayload(publishedContent)
  const statements = [
    db.prepare(`UPDATE contents SET is_featured = 0 WHERE id <> ?`).bind(id),
    db.prepare(`
      UPDATE content_publications
      SET payload_json = json_set(payload_json, '$.isFeatured', json('false'))
      WHERE content_id <> ?
    `).bind(id),
  ]
  statements.push(
    db.prepare(`
      INSERT INTO content_publications (content_id, type, slug, payload_json, published_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(content_id) DO UPDATE SET
        type=excluded.type, slug=excluded.slug, payload_json=excluded.payload_json,
        published_at=excluded.published_at
    `).bind(id, payload.type, payload.slug, JSON.stringify(payload), now),
    db.prepare(`
      UPDATE contents SET status='published', show_on_home=1, is_featured=1,
        published_at=?, updated_at=? WHERE id=?
    `)
      .bind(now, now, id),
  )
  await db.batch(statements)
  return json({ data: { ...content, ...publishedContent, status: 'published', publishedAt: now } })
}

async function unpublishContent(db, id) {
  await db.batch([
    db.prepare(`DELETE FROM content_publications WHERE content_id=?`).bind(id),
    db.prepare(`UPDATE contents SET status='unpublished', updated_at=? WHERE id=?`)
      .bind(new Date().toISOString(), id),
  ])
  return json({ data: await loadManagerContent(db, id) })
}

async function trashContent(db, id) {
  const now = new Date()
  const purge = new Date(now.getTime() + 30 * 86400000).toISOString()
  await db.batch([
    db.prepare(`DELETE FROM content_publications WHERE content_id=?`).bind(id),
    db.prepare(`UPDATE contents SET deleted_at=?, purge_after=?, updated_at=? WHERE id=?`)
      .bind(now.toISOString(), purge, now.toISOString(), id),
  ])
  return json({ data: await loadManagerContent(db, id) })
}

async function restoreContent(db, id) {
  await db.prepare(`UPDATE contents SET deleted_at=NULL, purge_after=NULL, updated_at=? WHERE id=?`)
    .bind(new Date().toISOString(), id).run()
  return json({ data: await loadManagerContent(db, id) })
}

async function duplicateContent(db, id) {
  const source = await loadManagerContent(db, id)
  if (!source) return jsonError(404, 'content_not_found', '콘텐츠를 찾을 수 없습니다.')
  return createContent(db, {
    ...source,
    id: '',
    slug: `${source.slug}-copy-${crypto.randomUUID().slice(0, 4)}`,
    title: `${source.title} 복사본`,
    status: 'draft',
    isFeatured: false,
    assets: [],
  })
}

async function replaceCredits(db, contentId, credits) {
  const statements = [db.prepare(`DELETE FROM content_credits WHERE content_id=?`).bind(contentId)]
  for (const credit of credits) {
    statements.push(db.prepare(`
      INSERT INTO content_credits (id, content_id, label, value, url, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), contentId, credit.label, credit.value, credit.url, credit.sortOrder))
  }
  await db.batch(statements)
}

async function loadManagerContent(db, id) {
  const row = await db.prepare(`SELECT * FROM contents WHERE id=?`).bind(id).first()
  if (!row) return null
  const [credits, assets] = await Promise.all([
    db.prepare(`SELECT label, value, url, sort_order FROM content_credits WHERE content_id=? ORDER BY sort_order`).bind(id).all(),
    db.prepare(`SELECT * FROM content_assets WHERE content_id=? AND deleted_at IS NULL ORDER BY role, sort_order`).bind(id).all(),
  ])
  return {
    ...mapContentRow(row),
    credits: credits.results.map(item => ({
      label: item.label, value: item.value, url: item.url, sortOrder: item.sort_order,
    })),
    assets: assets.results.map(mapAssetRow),
  }
}

async function uploadAsset(env, contentId, request) {
  const db = requireBinding(env, 'DB')
  const bucket = requireBinding(env, 'CONTENT_ASSETS')
  const form = await request.formData()
  const file = form.get('file')
  const role = String(form.get('role') || '')
  const parent = await db.prepare(`SELECT id FROM contents WHERE id=? AND deleted_at IS NULL`).bind(contentId).first()
  if (!parent) return jsonError(404, 'content_not_found', '콘텐츠를 찾을 수 없습니다.')
  if (!file || typeof file.arrayBuffer !== 'function') return jsonError(400, 'file_required', '이미지 파일을 선택해주세요.')
  if (!ASSET_ROLES.has(role)) return jsonError(400, 'invalid_asset_role', '이미지 역할을 확인해주세요.')
  if (file.size > MAX_IMAGE_BYTES) return jsonError(413, 'file_too_large', '이미지는 20MB 이하만 업로드할 수 있습니다.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!validImageSignature(file.type, bytes)) return jsonError(415, 'unsupported_image', '지원하지 않는 이미지 형식입니다.')
  const id = crypto.randomUUID()
  const ext = extensionForMime(file.type)
  const key = `contents/${contentId}/original/${id}.${ext}`
  if (role === 'poster' || role === 'preview') {
    const previous = await db.prepare(`
      SELECT * FROM content_assets WHERE content_id=? AND role=? AND deleted_at IS NULL
    `).bind(contentId, role).first()
    if (previous) {
      await bucket.delete([previous.r2_key_original, previous.r2_key_web, previous.r2_key_thumbnail].filter(Boolean))
      await db.prepare(`DELETE FROM content_assets WHERE id=?`).bind(previous.id).run()
    }
  }
  await db.prepare(`
    INSERT INTO content_assets (
      id, content_id, role, r2_key_original, mime_type, byte_size, alt_text,
      caption, sort_order, upload_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).bind(
    id, contentId, role, key, file.type, file.size,
    String(form.get('altText') || ''), String(form.get('caption') || ''),
    Number(form.get('sortOrder') || 0),
  ).run()
  try {
    await bucket.put(key, bytes, { httpMetadata: { contentType: file.type } })
    await db.prepare(`UPDATE content_assets SET upload_status='ready' WHERE id=?`).bind(id).run()
  } catch (error) {
    await bucket.delete(key).catch(() => {})
    await db.prepare(`UPDATE content_assets SET upload_status='failed' WHERE id=?`).bind(id).run()
    return jsonError(503, 'asset_upload_failed', '이미지 업로드에 실패했습니다. 다시 시도해주세요.')
  }
  return json({ data: mapAssetRow(await db.prepare(`SELECT * FROM content_assets WHERE id=?`).bind(id).first()) }, 201)
}

async function updateAsset(db, contentId, assetId, input) {
  const result = await db.prepare(`
    UPDATE content_assets SET alt_text=?, caption=?, sort_order=?
    WHERE id=? AND content_id=?
  `).bind(String(input.altText || ''), String(input.caption || ''), Number(input.sortOrder || 0), assetId, contentId).run()
  if (!result.meta?.changes) return jsonError(404, 'asset_not_found', '이미지를 찾을 수 없습니다.')
  return json({ data: mapAssetRow(await db.prepare(`SELECT * FROM content_assets WHERE id=? AND content_id=?`).bind(assetId, contentId).first()) })
}

async function deleteAsset(env, contentId, assetId) {
  const db = requireBinding(env, 'DB')
  const bucket = requireBinding(env, 'CONTENT_ASSETS')
  const asset = await db.prepare(`SELECT * FROM content_assets WHERE id=? AND content_id=?`).bind(assetId, contentId).first()
  if (!asset) return jsonError(404, 'asset_not_found', '이미지를 찾을 수 없습니다.')
  await bucket.delete([asset.r2_key_original, asset.r2_key_web, asset.r2_key_thumbnail].filter(Boolean))
  await db.prepare(`DELETE FROM content_assets WHERE id=?`).bind(assetId).run()
  return json({ data: { id: assetId, deleted: true } })
}

async function serveAsset(env, assetId) {
  const db = requireBinding(env, 'DB')
  const bucket = requireBinding(env, 'CONTENT_ASSETS')
  const asset = await db.prepare(`
    SELECT a.* FROM content_assets a
    JOIN content_publications p ON p.content_id = a.content_id
    WHERE a.id=? AND a.deleted_at IS NULL
  `).bind(assetId).first()
  if (!asset) return new Response('Not Found', { status: 404 })
  const object = await bucket.get(asset.r2_key_web || asset.r2_key_original)
  if (!object) return new Response('Not Found', { status: 404 })
  return new Response(object.body, {
    headers: {
      'content-type': asset.mime_type,
      'cache-control': 'public, max-age=31536000, immutable',
      etag: object.httpEtag || '',
    },
  })
}

function mapContentRow(row) {
  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    title: row.title,
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    dateDisplay: row.date_display || '',
    dateRange: row.date_display || [row.start_date, row.end_date].filter(Boolean).join(' – '),
    location: row.location || '',
    body: row.body || '',
    description: row.description || '',
    status: row.status,
    showOnHome: Boolean(row.show_on_home),
    isFeatured: Boolean(row.is_featured),
    sortOrder: row.sort_order || 0,
    publishedAt: row.published_at || null,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
    purgeAfter: row.purge_after || null,
  }
}

function mapAssetRow(row) {
  return {
    id: row.id,
    role: row.role,
    url: `/api/contents/assets/${row.id}`,
    originalUrl: `/api/contents/assets/${row.id}`,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    altText: row.alt_text || '',
    caption: row.caption || '',
    sortOrder: row.sort_order || 0,
    uploadStatus: row.upload_status,
  }
}

function publicPayload(content) {
  const poster = content.assets.find(asset => asset.role === 'poster')
  const preview = content.assets.find(asset => asset.role === 'preview') || poster
  return {
    id: content.id,
    type: content.type,
    slug: content.slug,
    title: content.title,
    startDate: content.startDate,
    endDate: content.endDate,
    dateRange: content.dateDisplay || [content.startDate, content.endDate].filter(Boolean).join(' – '),
    location: content.location,
    body: publicBody(content.body),
    description: content.description,
    credits: publicCredits(content.credits),
    hero: poster?.originalUrl || poster?.url || '',
    preview: preview?.url || '',
    gallery: content.assets.filter(asset => asset.role === 'gallery').map(asset => ({
      src: asset.url,
      original: asset.originalUrl,
      alt: asset.altText,
      caption: asset.caption,
    })),
    showOnHome: content.showOnHome,
    isFeatured: content.isFeatured,
    sortOrder: content.sortOrder,
  }
}

function publicBody(body) {
  return String(body || '').split(/\n\s*\n/).map(value => value.trim()).filter(Boolean)
}

function publicCredits(credits = []) {
  return credits.map(credit => [credit.label, credit.value, credit.url].filter(Boolean).join(' ').trim()).filter(Boolean)
}

function validImageSignature(mime, bytes) {
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8
  if (mime === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (mime === 'image/webp') return ascii(bytes.slice(0, 4)) === 'RIFF' && ascii(bytes.slice(8, 12)) === 'WEBP'
  if (mime === 'image/avif') return ascii(bytes.slice(4, 12)).includes('ftyp')
  return false
}

function extensionForMime(mime) {
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }[mime]
}

function ascii(bytes) {
  return String.fromCharCode(...bytes)
}

function requireBinding(env, name) {
  if (!env?.[name]) throw new Error(`${name} binding is not configured`)
  return env[name]
}

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

function validationError(fields) {
  return json({ error: { code: 'validation_failed', message: '입력 내용을 확인해주세요.', fields } }, 422)
}

function jsonError(status, code, message) {
  return json({ error: { code, message } }, status)
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
