import { RENTAL_CALENDAR_LABELS, RENTAL_STATUS_LABELS } from '../domain/rental-statuses.mjs'

export function serializeRentalWindow(row) {
  return {
    id: row.id, startDate: row.start_date, endDate: row.end_date, status: row.status,
    label: row.label, title: row.label, publicDescription: row.public_description || '',
    adminNotes: row.admin_notes || '',
    type: row.status === 'available' ? 'rental-available' : 'rental-blocked',
    createdAt: row.created_at || '', updatedAt: row.updated_at || '',
  }
}

export function serializePublicRentalWindow(row) {
  return {
    startDate: row.start_date, endDate: row.end_date, status: row.status, label: row.label,
    title: row.label, publicDescription: row.public_description || '',
    type: row.status === 'available' ? 'rental-available' : 'rental-blocked',
    updatedAt: row.updated_at || '',
  }
}

export function serializePublicUnavailableRange(row) {
  const label = RENTAL_CALENDAR_LABELS[row.status] || RENTAL_STATUS_LABELS[row.status] || row.status
  return {
    startDate: row.requested_start_date, endDate: row.requested_end_date, status: row.status, label,
    type: ['new', 'reviewing'].includes(row.status) ? 'rental-requested' : 'rental',
    updatedAt: row.updated_at || '',
  }
}

export function serializePublicRentalReceipt(row) {
  const status = row.status || 'new'

  return {
    accepted: true,
    status,
    statusLabel: RENTAL_STATUS_LABELS[status] || status,
    notificationStatus: row.notification_status || 'pending',
    receivedAt: row.created_at || '',
  }
}

export function serializeRentalRequest(row) {
  return {
    id: row.id, applicantName: row.applicant_name, teamName: row.applicant_name, contact: row.contact,
    requestedStartDate: row.requested_start_date, requestedEndDate: row.requested_end_date,
    dateRange: `${row.requested_start_date.replaceAll('-', '.')} - ${row.requested_end_date.replaceAll('-', '.')}`,
    supportProgram: row.support_program, projectDescription: row.project_description,
    projectIntro: row.project_description, status: row.status,
    statusLabel: RENTAL_STATUS_LABELS[row.status] || row.status, adminNote: row.admin_note || '',
    notificationStatus: row.notification_status || 'not_applicable',
    notificationAttemptedAt: row.notification_attempted_at || null,
    notificationErrorCode: row.notification_error_code || null,
    notificationMessageId: row.notification_message_id || null,
    notificationAttemptCount: Number(row.notification_attempt_count || 0),
    notificationNextAttemptAt: row.notification_next_attempt_at || null,
    privacyPolicyVersion: row.privacy_policy_version || null,
    privacyConsentAt: row.privacy_consent_at || null,
    deletedAt: row.deleted_at || null, purgeAfter: row.purge_after || null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}
