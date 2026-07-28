import { handleManageApiRequest } from '../../../../../src/server/manage-auth.mjs'
import { handleDeleteRentalRequest } from '../../../../../src/server/rental-api.mjs'

export function onRequestDelete(context) {
  return handleManageDeleteRentalRequest(context)
}

function handleManageDeleteRentalRequest(context) {
  return handleManageApiRequest(context, handleDeleteRentalRequest)
}
