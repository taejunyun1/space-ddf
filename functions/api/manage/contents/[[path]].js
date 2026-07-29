import { handleManageApiRequest } from '../../../../src/server/manage-auth.mjs'
import { handleManageContentRequest } from '../../../../src/server/content-api.mjs'

export const onRequest = context =>
  handleManageApiRequest(context, handleManageContentRequest)

