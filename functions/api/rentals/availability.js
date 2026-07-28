import { handleRentalAvailability } from '../../../src/server/rental-api.mjs'

export function onRequestGet(context) {
  return handleRentalAvailability(context)
}
