import { RentalApiError } from './rental-api-error.mjs'

const SUPPORT_PROGRAMS = new Set(['none', 'k-art', 'gwangju-foundation', 'other'])
export const WINDOW_STATUSES = new Set(['available', 'blocked'])

export async function readRentalJsonBody(request) {
  try {
    const declaredLength = Number(request.headers.get('content-length') || 0)
    if (declaredLength > 16 * 1024) {
      throw new RentalApiError(413, 'request_too_large', '요청 본문은 16KB를 초과할 수 없습니다.')
    }
    const text = await request.text()
    if (new TextEncoder().encode(text).byteLength > 16 * 1024) {
      throw new RentalApiError(413, 'request_too_large', '요청 본문은 16KB를 초과할 수 없습니다.')
    }
    return JSON.parse(text)
  } catch (error) {
    if (error instanceof RentalApiError) throw error
    throw new RentalApiError(400, 'invalid_json', '요청 본문을 JSON으로 해석할 수 없습니다.')
  }
}

export function validateRentalRequestInput(input) {
  if (typeof input.website === 'string' && input.website.trim()) {
    throw new RentalApiError(400, 'spam_detected', '요청을 처리할 수 없습니다.')
  }

  const normalized = {
    applicantName: normalizeText(input.applicantName || input.name),
    contact: normalizeText(input.contact),
    requestedStartDate: normalizeText(input.requestedStartDate || input.startDate),
    requestedEndDate: normalizeText(input.requestedEndDate || input.endDate),
    supportProgram: normalizeText(input.supportProgram || 'none'),
    projectDescription: normalizeText(input.projectDescription || input.projectIntro),
    privacyConsent: input.privacyConsent === true,
    privacyPolicyVersion: normalizeText(input.privacyPolicyVersion),
    idempotencyKey: normalizeText(input.idempotencyKey),
  }
  if (!normalized.applicantName) throw new RentalApiError(400, 'invalid_request', '신청자/팀명을 입력해주세요.')
  if (!normalized.contact) throw new RentalApiError(400, 'invalid_request', '연락처를 입력해주세요.')
  if (!isDateKey(normalized.requestedStartDate) || !isDateKey(normalized.requestedEndDate)) {
    throw new RentalApiError(400, 'invalid_date', '희망 일정을 다시 선택해주세요.')
  }
  if (normalized.requestedStartDate > normalized.requestedEndDate) {
    throw new RentalApiError(400, 'invalid_date', '종료일은 시작일 이후여야 합니다.')
  }
  if (!SUPPORT_PROGRAMS.has(normalized.supportProgram)) {
    throw new RentalApiError(400, 'invalid_support_program', '지원사업 구분을 확인해주세요.')
  }
  if (!normalized.projectDescription) throw new RentalApiError(400, 'invalid_request', '프로젝트 소개를 입력해주세요.')
  assertMaxLength(normalized.applicantName, 100, '신청자/팀명')
  assertMaxLength(normalized.contact, 200, '연락처')
  assertMaxLength(normalized.projectDescription, 4000, '프로젝트 소개')
  if (!normalized.privacyConsent || !normalized.privacyPolicyVersion) {
    throw new RentalApiError(400, 'privacy_consent_required', '개인정보 수집·이용 동의가 필요합니다.')
  }
  if (!isUuid(normalized.idempotencyKey)) {
    throw new RentalApiError(400, 'invalid_idempotency_key', '중복 방지 키가 올바르지 않습니다.')
  }
  return normalized
}

export function validateRentalWindowInput(input) {
  const normalized = {
    startDate: normalizeText(input.startDate || input.start_date),
    endDate: normalizeText(input.endDate || input.end_date),
    status: normalizeText(input.status || 'available'),
    label: normalizeText(input.label || input.title),
    publicDescription: normalizeText(input.publicDescription),
    adminNotes: normalizeText(input.adminNotes || input.notes),
  }
  if (!isDateKey(normalized.startDate) || !isDateKey(normalized.endDate)) {
    throw new RentalApiError(400, 'invalid_date', '일정의 시작일과 종료일을 확인해주세요.')
  }
  if (normalized.startDate > normalized.endDate) {
    throw new RentalApiError(400, 'invalid_date', '종료일은 시작일 이후여야 합니다.')
  }
  if (!WINDOW_STATUSES.has(normalized.status)) {
    throw new RentalApiError(400, 'invalid_window_status', '가능일정 상태를 확인해주세요.')
  }
  if (!normalized.label) throw new RentalApiError(400, 'invalid_window_label', '일정 라벨을 입력해주세요.')
  assertMaxLength(normalized.publicDescription, 4000, '공개 설명')
  assertMaxLength(normalized.adminNotes, 4000, '관리자 메모')
  return normalized
}

export function assertMaxLength(value, max, label) {
  if (value.length > max) {
    throw new RentalApiError(400, 'field_too_long', `${label}은(는) ${max}자를 초과할 수 없습니다.`)
  }
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
