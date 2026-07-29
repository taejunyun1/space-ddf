import { handleManageApiRequest } from '../../../../../src/server/manage-auth.mjs'
import {
  handleCreateRentalWindow,
  handleListRentalWindows,
} from '../../../../../src/server/rental-api.mjs'

export function onRequestGet(context) {
  return handleManageListRentalWindows(context)
}

export function onRequestPost(context) {
  return handleManageCreateRentalWindow(context)
}

function handleManageListRentalWindows(context) {
  return handleManageApiRequest(context, handleListRentalWindows)
}

function handleManageCreateRentalWindow(context) {
  return handleManageApiRequest(context, handleCreateRentalWindow)
}
