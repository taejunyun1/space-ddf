import { handleCreateRentalRequest } from '../../../src/server/rental-api.mjs'

export function onRequestPost(context) {
  return handleCreateRentalRequest(context)
}
