import { deliverRentalRequestNotification } from './rental-notification.mjs'
import {
  RENTAL_STATUS_LABELS as STATUS_LABELS,
  RENTAL_STATUS_VALUES,
} from '../domain/rental-statuses.mjs'
import { RentalApiError as ApiError } from './rental-api-error.mjs'
import {
  assertMaxLength,
  readRentalJsonBody as readJsonBody,
  validateRentalRequestInput,
  validateRentalWindowInput,
} from './rental-validation.mjs'
import {
  serializePublicRentalReceipt as normalizePublicReceipt,
  serializePublicRentalWindow as normalizePublicWindow,
  serializePublicUnavailableRange as normalizeUnavailableRange,
  serializeRentalRequest as normalizeRequest,
  serializeRentalWindow as normalizeWindow,
} from './rental-serializers.mjs'

const REQUEST_STATUSES = new Set(RENTAL_STATUS_VALUES)

export async function handleRentalAvailability(context) {
  try {
    const db = getDb(context.env)
    const windowsResult = await db
      .prepare(`
        SELECT id, start_date, end_date, status, label, public_description, created_at, updated_at
        FROM rental_windows
        ORDER BY start_date ASC
      `)
      .all()
    const unavailableResult = await db
      .prepare(`
        SELECT requested_start_date, requested_end_date, status, updated_at
        FROM rental_requests
        WHERE status IN ('new', 'reviewing', 'approved')
          AND deleted_at IS NULL
        ORDER BY requested_start_date ASC
      `)
      .all()

    return json({
      data: {
        windows: getResults(windowsResult).map(normalizePublicWindow),
        unavailable: getResults(unavailableResult).map(normalizeUnavailableRange),
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function handleCreateRentalRequest(context) {
  try {
    const db = getDb(context.env)
    const input = validateRentalRequestInput(await readJsonBody(context.request))
    const existingIdempotentRequest = await db
      .prepare(`
        SELECT *
        FROM rental_requests
        WHERE idempotency_key = ?
        LIMIT 1
      `)
      .bind(input.idempotencyKey)
      .first()

    if (existingIdempotentRequest) {
      return json({ data: normalizeRequest(existingIdempotentRequest) })
    }

    const availableWindow = await db
      .prepare(`
        SELECT id
        FROM rental_windows
        WHERE status = ?
          AND start_date <= ?
          AND end_date >= ?
        LIMIT 1
      `)
      .bind('available', input.requestedStartDate, input.requestedEndDate)
      .first()

    if (!availableWindow) {
      throw new ApiError(
        400,
        'date_not_available',
        '선택한 일정은 현재 대관 가능 일정에 포함되지 않습니다.'
      )
    }

    const blockedWindow = await db
      .prepare(`
        SELECT id
        FROM rental_windows
        WHERE status = ?
          AND start_date <= ?
          AND end_date >= ?
        LIMIT 1
      `)
      .bind('blocked', input.requestedEndDate, input.requestedStartDate)
      .first()

    if (blockedWindow) {
      throw new ApiError(409, 'date_blocked', '선택한 일정은 차단된 대관 일정과 겹칩니다.')
    }

    const conflict = await db
      .prepare(`
        SELECT id
        FROM rental_requests
        WHERE status IN ('new', 'reviewing', 'approved')
          AND requested_start_date <= ?
          AND requested_end_date >= ?
        LIMIT 1
      `)
      .bind(input.requestedEndDate, input.requestedStartDate)
      .first()

    if (conflict) {
      throw new ApiError(409, 'date_conflict', '이미 검토 중이거나 승인된 대관 신청이 있는 일정입니다.')
    }

    const now = new Date().toISOString()
    const id = createId('rental')
    const outboxId = createId('mail')
    const results = await db.batch([
      db.prepare(`
        INSERT INTO rental_requests (
          id,
          applicant_name,
          contact,
          requested_start_date,
          requested_end_date,
          support_program,
          project_description,
          status,
          admin_note,
          notification_status,
          notification_attempted_at,
          notification_error_code,
          idempotency_key,
          privacy_policy_version,
          privacy_consent_at,
          created_at,
          updated_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, 'new', NULL, ?, NULL, NULL, ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM rental_windows
          WHERE status = 'available' AND start_date <= ? AND end_date >= ?
        )
          AND NOT EXISTS (
            SELECT 1 FROM rental_windows
            WHERE status = 'blocked' AND start_date <= ? AND end_date >= ?
          )
          AND NOT EXISTS (
            SELECT 1 FROM rental_requests
            WHERE status IN ('new', 'reviewing', 'approved')
              AND deleted_at IS NULL
              AND requested_start_date <= ?
              AND requested_end_date >= ?
          )
          AND NOT EXISTS (
            SELECT 1 FROM rental_requests WHERE idempotency_key = ?
          )
      `).bind(
        id,
        input.applicantName,
        input.contact,
        input.requestedStartDate,
        input.requestedEndDate,
        input.supportProgram,
        input.projectDescription,
        'pending',
        input.idempotencyKey,
        input.privacyPolicyVersion,
        now,
        now,
        now,
        input.requestedStartDate,
        input.requestedEndDate,
        input.requestedEndDate,
        input.requestedStartDate,
        input.requestedEndDate,
        input.requestedStartDate,
        input.idempotencyKey,
      ),
      db.prepare(`
        INSERT INTO rental_status_history (
          id,
          request_id,
          from_status,
          to_status,
          note,
          created_at
        )
        SELECT ?, ?, NULL, 'new', ?, ?
        WHERE EXISTS (SELECT 1 FROM rental_requests WHERE id = ?)
      `).bind(createId('history'), id, '신청 접수', now, id),
      db.prepare(`
        INSERT INTO rental_notification_outbox (
          id, request_id, status, attempt_count, next_attempt_at, created_at, updated_at
        )
        SELECT ?, ?, 'pending', 0, ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM rental_requests WHERE id = ?)
      `).bind(outboxId, id, now, now, now, id),
    ])

    if (!didStatementChange(results[0])) {
      const duplicate = await db
        .prepare('SELECT * FROM rental_requests WHERE idempotency_key = ? LIMIT 1')
        .bind(input.idempotencyKey)
        .first()

      if (duplicate) return json({ data: normalizePublicReceipt(duplicate) })

      throw new ApiError(409, 'date_conflict', '이미 검토 중이거나 승인된 대관 신청이 있는 일정입니다.')
    }

    const notificationTask = deliverRentalRequestNotification({
      db,
      email: context.env.RENTAL_NOTIFICATION_EMAIL,
      request: { id, ...input },
      adminUrl: new URL('/admin', context.request.url).href,
    })

    if (typeof context.waitUntil === 'function') {
      context.waitUntil(notificationTask)
    } else {
      await notificationTask
    }

    return json({
      data: normalizePublicReceipt({
        status: 'new',
        notification_status: 'pending',
        created_at: now,
      }),
    }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function handleListRentalRequests(context) {
  try {
    const db = getDb(context.env)
    const url = new URL(context.request.url)
    const status = url.searchParams.get('status')
    const search = (url.searchParams.get('query') || url.searchParams.get('q') || '').trim()
    const year = (url.searchParams.get('year') || '').trim()
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true'
    const limit = clampInteger(url.searchParams.get('limit'), 50, 1, 100)
    const cursor = decodeCursor(url.searchParams.get('cursor'))
    const params = []
    const where = []

    if (!includeDeleted) where.push('deleted_at IS NULL')

    if (status && status !== 'all') {
      if (!REQUEST_STATUSES.has(status)) {
        throw new ApiError(400, 'invalid_status', '알 수 없는 대관 상태입니다.')
      }

      where.push('status = ?')
      params.push(status)
    }

    if (search) {
      where.push('(applicant_name LIKE ? OR contact LIKE ? OR project_description LIKE ?)')
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    if (year) {
      if (!/^\d{4}$/.test(year)) throw new ApiError(400, 'invalid_year', '연도 형식이 올바르지 않습니다.')
      where.push("substr(requested_start_date, 1, 4) = ?")
      params.push(year)
    }

    if (cursor) {
      where.push('(created_at < ? OR (created_at = ? AND id < ?))')
      params.push(cursor.createdAt, cursor.createdAt, cursor.id)
    }

    const sql = `
      SELECT
        id,
        applicant_name,
        contact,
        requested_start_date,
        requested_end_date,
        support_program,
        project_description,
        status,
        admin_note,
        notification_status,
        notification_attempted_at,
        notification_error_code,
        notification_message_id,
        notification_attempt_count,
        notification_next_attempt_at,
        privacy_policy_version,
        privacy_consent_at,
        deleted_at,
        purge_after,
        created_at,
        updated_at
      FROM rental_requests
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `
    params.push(limit + 1)
    const result = await db.prepare(sql).bind(...params).all()
    const rows = getResults(result)
    const hasMore = rows.length > limit
    const pageRows = rows.slice(0, limit)
    const last = pageRows.at(-1)

    return json({
      data: pageRows.map(normalizeRequest),
      meta: {
        nextCursor: hasMore && last ? encodeCursor(last.created_at, last.id) : null,
        limit,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function handleUpdateRentalRequestStatus(context) {
  try {
    const db = getDb(context.env)
    const id = getRequestId(context.params)
    const body = await readJsonBody(context.request)
    const status = typeof body.status === 'string' ? body.status : ''
    const adminNote = typeof body.adminNote === 'string' ? body.adminNote.trim() : ''

    if (!REQUEST_STATUSES.has(status)) {
      throw new ApiError(400, 'invalid_status', '알 수 없는 대관 상태입니다.')
    }

    assertMaxLength(adminNote, 4000, '관리자 메모')

    const existing = await db
      .prepare(`
        SELECT
          id,
          applicant_name,
          contact,
          requested_start_date,
          requested_end_date,
          support_program,
          project_description,
          status,
          admin_note,
          notification_status,
          notification_attempted_at,
          notification_error_code,
          notification_message_id,
          notification_attempt_count,
          notification_next_attempt_at,
          privacy_policy_version,
          privacy_consent_at,
          deleted_at,
          purge_after,
          created_at,
          updated_at
        FROM rental_requests
        WHERE id = ?
        LIMIT 1
      `)
      .bind(id)
      .first()

    if (!existing) {
      throw new ApiError(404, 'request_not_found', '대관 신청을 찾을 수 없습니다.')
    }

    if (existing.deleted_at) {
      throw new ApiError(409, 'request_deleted', '휴지통의 신청은 먼저 복원해야 합니다.')
    }

    const now = new Date().toISOString()

    if (existing.status === status) {
      if ((existing.admin_note || '') !== adminNote) {
        await db.prepare(`
          UPDATE rental_requests SET admin_note = ?, updated_at = ? WHERE id = ?
        `).bind(adminNote || null, now, id).run()
      }

      return json({
        data: normalizeRequest({
          ...existing,
          admin_note: adminNote || null,
          updated_at: (existing.admin_note || '') === adminNote ? existing.updated_at : now,
        }),
      })
    }

    const isReactivating = ['new', 'reviewing', 'approved'].includes(status)
      && !['new', 'reviewing', 'approved'].includes(existing.status)
    const updateSql = isReactivating
      ? `
          UPDATE rental_requests
          SET status = ?, admin_note = ?, updated_at = ?
          WHERE id = ?
            AND deleted_at IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM rental_windows
              WHERE status = 'blocked'
                AND start_date <= ? AND end_date >= ?
            )
            AND NOT EXISTS (
              SELECT 1 FROM rental_requests conflict
              WHERE conflict.id != ?
                AND conflict.deleted_at IS NULL
                AND conflict.status IN ('new', 'reviewing', 'approved')
                AND conflict.requested_start_date <= ?
                AND conflict.requested_end_date >= ?
            )
        `
      : `
          UPDATE rental_requests
          SET status = ?, admin_note = ?, updated_at = ?
          WHERE id = ? AND deleted_at IS NULL
        `
    const updateStatement = isReactivating
      ? db.prepare(updateSql).bind(
          status,
          adminNote || null,
          now,
          id,
          existing.requested_end_date,
          existing.requested_start_date,
          id,
          existing.requested_end_date,
          existing.requested_start_date,
        )
      : db.prepare(updateSql).bind(status, adminNote || null, now, id)

    const results = await db.batch([
      updateStatement,
      db
        .prepare(`
          INSERT INTO rental_status_history (
            id,
            request_id,
            from_status,
            to_status,
            note,
            created_at
          )
          SELECT ?, ?, ?, ?, ?, ?
          WHERE EXISTS (
            SELECT 1 FROM rental_requests WHERE id = ? AND updated_at = ?
          )
        `)
        .bind(createId('history'), id, existing.status, status, adminNote || null, now, id, now),
    ])

    if (!didStatementChange(results[0])) {
      throw new ApiError(409, 'date_conflict', '현재 차단 또는 활성 신청과 겹쳐 해당 상태로 변경할 수 없습니다.')
    }

    return json({
      data: normalizeRequest({
        ...existing,
        status,
        admin_note: adminNote || null,
        updated_at: now,
      }),
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function handleDeleteRentalRequest(context) {
  try {
    const db = getDb(context.env)
    const id = getRequestId(context.params)
    const existing = await db
      .prepare(`
        SELECT id
        FROM rental_requests
        WHERE id = ?
        LIMIT 1
      `)
      .bind(id)
      .first()

    if (!existing) {
      throw new ApiError(404, 'request_not_found', '대관 신청을 찾을 수 없습니다.')
    }

    const now = new Date()
    const purgeAfter = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await db.prepare(`
      UPDATE rental_requests
      SET deleted_at = ?, purge_after = ?, updated_at = ?
      WHERE id = ?
    `).bind(now.toISOString(), purgeAfter, now.toISOString(), id).run()

    return json({
      data: {
        id,
        deleted: true,
        purgeAfter,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function handleRestoreRentalRequest(context) {
  try {
    const db = getDb(context.env)
    const id = getRequestId(context.params)
    const existing = await db.prepare('SELECT * FROM rental_requests WHERE id = ? LIMIT 1').bind(id).first()
    if (!existing) throw new ApiError(404, 'request_not_found', '대관 신청을 찾을 수 없습니다.')
    if (!existing.deleted_at) return json({ data: normalizeRequest(existing) })

    const active = ['new', 'reviewing', 'approved'].includes(existing.status)
    const now = new Date().toISOString()
    const sql = active
      ? `UPDATE rental_requests SET deleted_at = NULL, purge_after = NULL, updated_at = ?
         WHERE id = ?
           AND NOT EXISTS (SELECT 1 FROM rental_windows WHERE status = 'blocked' AND start_date <= ? AND end_date >= ?)
           AND NOT EXISTS (
             SELECT 1 FROM rental_requests conflict
             WHERE conflict.id != ? AND conflict.deleted_at IS NULL
               AND conflict.status IN ('new', 'reviewing', 'approved')
               AND conflict.requested_start_date <= ? AND conflict.requested_end_date >= ?
           )`
      : 'UPDATE rental_requests SET deleted_at = NULL, purge_after = NULL, updated_at = ? WHERE id = ?'
    const statement = active
      ? db.prepare(sql).bind(now, id, existing.requested_end_date, existing.requested_start_date, id, existing.requested_end_date, existing.requested_start_date)
      : db.prepare(sql).bind(now, id)
    const result = await statement.run()
    if (!didStatementChange(result)) throw new ApiError(409, 'date_conflict', '현재 예약과 겹쳐 복원할 수 없습니다.')

    return json({ data: normalizeRequest({ ...existing, deleted_at: null, purge_after: null, updated_at: now }) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function handleRentalRequestHistory(context) {
  try {
    const db = getDb(context.env)
    const id = getRequestId(context.params)
    const result = await db.prepare(`
      SELECT id, from_status, to_status, note, created_at
      FROM rental_status_history WHERE request_id = ? ORDER BY created_at ASC
    `).bind(id).all()
    return json({ data: getResults(result).map(row => ({
      id: row.id,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      toStatusLabel: STATUS_LABELS[row.to_status] || row.to_status,
      note: row.note || '',
      createdAt: row.created_at,
    })) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function handleRetryRentalNotification(context) {
  try {
    const db = getDb(context.env)
    const id = getRequestId(context.params)
    const existing = await db.prepare('SELECT * FROM rental_requests WHERE id = ? LIMIT 1').bind(id).first()
    if (!existing) throw new ApiError(404, 'request_not_found', '대관 신청을 찾을 수 없습니다.')
    if (existing.deleted_at) throw new ApiError(409, 'request_deleted', '삭제된 신청에는 메일을 보낼 수 없습니다.')

    const now = new Date().toISOString()
    await db.prepare(`
      INSERT INTO rental_notification_outbox (
        id, request_id, status, attempt_count, next_attempt_at, created_at, updated_at
      ) VALUES (?, ?, 'pending', 0, ?, ?, ?)
      ON CONFLICT(request_id) DO UPDATE SET
        status = 'pending', attempt_count = 0, next_attempt_at = excluded.next_attempt_at,
        last_error_code = NULL, updated_at = excluded.updated_at
    `).bind(createId('mail'), id, now, now, now).run()

    const task = deliverRentalRequestNotification({
      db,
      email: context.env.RENTAL_NOTIFICATION_EMAIL,
      request: {
        id,
        applicantName: existing.applicant_name,
        contact: existing.contact,
        requestedStartDate: existing.requested_start_date,
        requestedEndDate: existing.requested_end_date,
        supportProgram: existing.support_program,
        projectDescription: existing.project_description,
      },
      adminUrl: new URL('/admin', context.request.url).href,
      attemptCount: 1,
    })
    if (typeof context.waitUntil === 'function') context.waitUntil(task)
    else await task

    return json({ data: { id, notificationStatus: 'pending' } }, { status: 202 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function handleListRentalWindows(context) {
  try {
    const db = getDb(context.env)
    const result = await db
      .prepare(`
        SELECT id, start_date, end_date, status, label, public_description, admin_notes, created_at, updated_at
        FROM rental_windows
        ORDER BY start_date ASC, created_at ASC
      `)
      .all()

    return json({ data: getResults(result).map(normalizeWindow) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function handleCreateRentalWindow(context) {
  try {
    const db = getDb(context.env)
    const input = validateRentalWindowInput(await readJsonBody(context.request))

    await assertRentalWindowCanSave(db, input)

    const now = new Date().toISOString()
    const id = createId('window')

    await db
      .prepare(`
        INSERT INTO rental_windows (
          id,
          start_date,
          end_date,
          status,
          label,
          public_description,
          admin_notes,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        input.startDate,
        input.endDate,
        input.status,
        input.label,
        input.publicDescription || null,
        input.adminNotes || null,
        now,
        now
      )
      .run()

    return json({
      data: normalizeWindow({
        id,
        start_date: input.startDate,
        end_date: input.endDate,
        status: input.status,
        label: input.label,
        public_description: input.publicDescription,
        admin_notes: input.adminNotes,
        created_at: now,
        updated_at: now,
      }),
    }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function handleUpdateRentalWindow(context) {
  try {
    const db = getDb(context.env)
    const id = getWindowId(context.params)
    const existing = await fetchRentalWindowById(db, id)

    if (!existing) {
      throw new ApiError(404, 'window_not_found', '대관 가능일정을 찾을 수 없습니다.')
    }

    const input = validateRentalWindowInput(await readJsonBody(context.request))

    await assertRentalWindowCanSave(db, input, id)

    const now = new Date().toISOString()

    await db
      .prepare(`
        UPDATE rental_windows
        SET start_date = ?, end_date = ?, status = ?, label = ?, public_description = ?, admin_notes = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(
        input.startDate,
        input.endDate,
        input.status,
        input.label,
        input.publicDescription || null,
        input.adminNotes || null,
        now,
        id
      )
      .run()

    return json({
      data: normalizeWindow({
        id,
        start_date: input.startDate,
        end_date: input.endDate,
        status: input.status,
        label: input.label,
        public_description: input.publicDescription,
        admin_notes: input.adminNotes,
        created_at: existing.created_at,
        updated_at: now,
      }),
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function handleDeleteRentalWindow(context) {
  try {
    const db = getDb(context.env)
    const id = getWindowId(context.params)
    const existing = await fetchRentalWindowById(db, id)

    if (!existing) {
      throw new ApiError(404, 'window_not_found', '대관 가능일정을 찾을 수 없습니다.')
    }

    const activeRequest = await findActiveRentalRequestConflict(db, {
      startDate: existing.start_date,
      endDate: existing.end_date,
    })

    if (activeRequest) {
      throw new ApiError(
        409,
        'active_request_conflict',
        '검토 중이거나 승인된 신청과 겹치는 일정은 삭제할 수 없습니다.'
      )
    }

    await db
      .prepare(`
        DELETE FROM rental_windows
        WHERE id = ?
      `)
      .bind(id)
      .run()

    return json({
      data: {
        id,
        deleted: true,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

async function assertRentalWindowCanSave(db, input, excludeId = '') {
  if (input.status === 'available') {
    const conflict = await findAvailableWindowConflict(db, input, excludeId)

    if (conflict) {
      throw new ApiError(409, 'window_conflict', '이미 등록된 대관 가능 일정과 겹칩니다.')
    }
  }

  if (input.status === 'blocked') {
    const activeRequest = await findActiveRentalRequestConflict(db, input)

    if (activeRequest) {
      throw new ApiError(
        409,
        'active_request_conflict',
        '검토 중이거나 승인된 신청과 겹치는 차단 일정은 만들 수 없습니다.'
      )
    }
  }
}

async function findAvailableWindowConflict(db, input, excludeId = '') {
  const baseSql = `
    SELECT id
    FROM rental_windows
    WHERE status = ?
      AND start_date <= ?
      AND end_date >= ?
  `
  const sql = excludeId
    ? `${baseSql} AND id != ? LIMIT 1`
    : `${baseSql} LIMIT 1`
  const statement = db.prepare(sql)

  return excludeId
    ? statement.bind('available', input.endDate, input.startDate, excludeId).first()
    : statement.bind('available', input.endDate, input.startDate).first()
}

async function findActiveRentalRequestConflict(db, input) {
  return db
    .prepare(`
      SELECT id
      FROM rental_requests
      WHERE status IN ('new', 'reviewing', 'approved')
        AND requested_start_date <= ?
        AND requested_end_date >= ?
      LIMIT 1
    `)
    .bind(input.endDate, input.startDate)
    .first()
}

async function fetchRentalWindowById(db, id) {
  return db
    .prepare(`
      SELECT id, start_date, end_date, status, label, public_description, admin_notes, created_at, updated_at
      FROM rental_windows
      WHERE id = ?
      LIMIT 1
    `)
    .bind(id)
    .first()
}

function didStatementChange(result) {
  if (typeof result?.meta?.changes === 'number') return result.meta.changes > 0
  return result?.success === true
}

function getDb(env) {
  if (!env?.DB) {
    throw new ApiError(503, 'db_not_configured', 'D1 DB 바인딩이 설정되지 않았습니다.')
  }

  return env.DB
}

function getRequestId(params = {}) {
  const id = Array.isArray(params.id) ? params.id[0] : params.id

  if (!id) {
    throw new ApiError(400, 'missing_request_id', '대관 신청 ID가 필요합니다.')
  }

  return id
}

function getWindowId(params = {}) {
  const id = Array.isArray(params.id) ? params.id[0] : params.id

  if (!id) {
    throw new ApiError(400, 'missing_window_id', '대관 가능일정 ID가 필요합니다.')
  }

  return id
}

function getResults(result) {
  return Array.isArray(result?.results) ? result.results : []
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

function encodeCursor(createdAt, id) {
  return btoa(unescape(encodeURIComponent(JSON.stringify({ createdAt, id }))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function decodeCursor(value) {
  if (!value) return null

  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '=')
    const parsed = JSON.parse(decodeURIComponent(escape(atob(padded))))
    if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') throw new Error('bad cursor')
    return parsed
  } catch {
    throw new ApiError(400, 'invalid_cursor', '페이지 커서가 올바르지 않습니다.')
  }
}

function createId(prefix) {
  if (!globalThis.crypto?.randomUUID) {
    throw new ApiError(500, 'crypto_unavailable', '보안 ID 생성 기능을 사용할 수 없습니다.')
  }

  return `${prefix}_${globalThis.crypto.randomUUID()}`
}

function json(payload, init = {}) {
  const headers = new Headers(init.headers || {})

  headers.set('content-type', 'application/json; charset=utf-8')

  return Response.json(payload, {
    ...init,
    headers,
  })
}

function errorResponse(error) {
  if (error instanceof ApiError) {
    return json({
      error: {
        code: error.code,
        message: error.message,
      },
    }, { status: error.status })
  }

  return json({
    error: {
      code: 'internal_error',
      message: '요청을 처리하지 못했습니다.',
    },
  }, { status: 500 })
}
