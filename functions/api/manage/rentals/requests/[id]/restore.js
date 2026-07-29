import { handleManageApiRequest } from '../../../../../../src/server/manage-auth.mjs'
import { handleRestoreRentalRequest } from '../../../../../../src/server/rental-api.mjs'

export function onRequestPost(context) {
  return handleManageApiRequest(context, handleRestoreRentalRequest)
}
