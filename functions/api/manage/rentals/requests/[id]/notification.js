import { handleManageApiRequest } from '../../../../../../src/server/manage-auth.mjs'
import { handleRetryRentalNotification } from '../../../../../../src/server/rental-api.mjs'

export function onRequestPost(context) {
  return handleManageApiRequest(context, handleRetryRentalNotification)
}
