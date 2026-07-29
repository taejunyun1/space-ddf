import { handleGoogleCalendarEvents } from '../../../src/server/google-calendar-api.mjs'

export async function onRequest(context) {
  return handleGoogleCalendarEvents(context)
}
