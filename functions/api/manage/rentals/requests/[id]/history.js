import { handleManageApiRequest } from '../../../../../../src/server/manage-auth.mjs'
import { handleRentalRequestHistory } from '../../../../../../src/server/rental-api.mjs'

export function onRequestGet(context) {
  return handleManageApiRequest(context, handleRentalRequestHistory)
}
