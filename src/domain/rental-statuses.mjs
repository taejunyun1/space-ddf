export const RENTAL_STATUS_LABELS = Object.freeze({
  new: '예약신청',
  reviewing: '검토중',
  approved: '대관승인',
  rejected: '대관반려',
  cancelled_by_user: '취소(사용자)',
})

export const RENTAL_CALENDAR_LABELS = Object.freeze({
  new: '예약신청',
  reviewing: '예약신청',
  approved: '예약확정',
})

export const RENTAL_STATUS_VALUES = Object.freeze(Object.keys(RENTAL_STATUS_LABELS))
export const ACTIVE_RENTAL_STATUSES = Object.freeze(['new', 'reviewing', 'approved'])

export function isActiveRentalStatus(status) {
  return ACTIVE_RENTAL_STATUSES.includes(status)
}
