import { handlePublicContentRequest } from '../../../src/server/content-api.mjs'

export const onRequest = context => handlePublicContentRequest(context)

