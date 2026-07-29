import { handleManageApiRequest } from '../../../../../../src/server/manage-auth.mjs'
import { handleUpdateRentalRequestStatus } from '../../../../../../src/server/rental-api.mjs'

export function onRequestPatch(context) {
  return handleManageUpdateRentalRequestStatus(context)
}

function handleManageUpdateRentalRequestStatus(context) {
  return handleManageApiRequest(context, handleUpdateRentalRequestStatus)
}
