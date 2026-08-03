export const RENTAL_ANALYTICS_EVENTS = Object.freeze([
  'rental_view',
  'rental_date_select',
  'rental_form_start',
  'rental_submit_success',
  'rental_submit_error',
])

const ALLOWED_PARAMETERS = new Set(['source', 'support_program', 'duration_days', 'error_code'])

export function trackRentalEvent(name, parameters = {}, { windowRef = globalThis.window } = {}) {
  if (!RENTAL_ANALYTICS_EVENTS.includes(name) || typeof windowRef?.gtag !== 'function') return false

  const safeParameters = Object.entries(parameters).reduce((result, [key, value]) => {
    if (!ALLOWED_PARAMETERS.has(key)) return result
    if (key === 'duration_days') {
      const days = Number(value)
      if (Number.isFinite(days)) result[key] = Math.max(1, Math.min(366, Math.round(days)))
      return result
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = String(value).slice(0, 64)
    }
    return result
  }, {})

  try {
    windowRef.gtag('event', name, safeParameters)
    return true
  } catch {
    return false
  }
}
