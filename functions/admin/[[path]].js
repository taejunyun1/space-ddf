import { handleAdminPageRoute } from '../../src/server/admin-page.mjs'

export function onRequest(context) {
  return handleAdminPageRoute(context)
}
