import { handleManageApiRequest } from '../../../../../src/server/manage-auth.mjs'
import { handleListRentalRequests } from '../../../../../src/server/rental-api.mjs'

export async function onRequestGet(context) {
  return handleManageListRentalRequests(context)
}

function handleManageListRentalRequests(context) {
  return handleManageApiRequest(context, handleListRentalRequests)
}
