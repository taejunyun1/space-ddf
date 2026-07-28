import { handleManagePageRoute } from '../../src/server/manage-auth.mjs'

export function onRequest(context) {
  return handleManagePageRoute(context)
}
