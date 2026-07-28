import { handleManageApiRequest } from '../../../../../src/server/manage-auth.mjs'
import {
  handleDeleteRentalWindow,
  handleUpdateRentalWindow,
} from '../../../../../src/server/rental-api.mjs'

export function onRequestPatch(context) {
  return handleManageUpdateRentalWindow(context)
}

export function onRequestDelete(context) {
  return handleManageDeleteRentalWindow(context)
}

function handleManageUpdateRentalWindow(context) {
  return handleManageApiRequest(context, handleUpdateRentalWindow)
}

function handleManageDeleteRentalWindow(context) {
  return handleManageApiRequest(context, handleDeleteRentalWindow)
}
