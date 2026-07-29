const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..')

test('rental frontend service calls same-origin Pages Functions APIs', () => {
  const source = readProjectFile('src/services/rentals.js')

  assert.match(source, /export async function fetchRentalAvailability/)
  assert.match(source, /export async function submitRentalRequest/)
  assert.match(source, /export async function fetchAdminRentalRequests/)
  assert.match(source, /export async function updateAdminRentalStatus/)
  assert.match(source, /export async function deleteAdminRentalRequest/)
  assert.match(source, /export async function fetchAdminRentalWindows/)
  assert.match(source, /export async function createAdminRentalWindow/)
  assert.match(source, /export async function updateAdminRentalWindow/)
  assert.match(source, /export async function deleteAdminRentalWindow/)
  assert.match(source, /\/api\/rentals\/availability/)
  assert.match(source, /\/api\/rentals\/requests/)
  assert.match(source, /\/api\/manage\/rentals\/requests/)
  assert.match(source, /\/api\/manage\/rentals\/windows/)
  assert.match(source, /method:\s*'DELETE'/)
})

test('rental frontend service skips API fetches on static Vite preview ports', () => {
  const source = readProjectFile('src/services/rentals.js')

  assert.match(source, /isStaticPreviewWithoutFunctions/)
  assert.match(source, /port === '4173'/)
  assert.match(source, /port === '5173'/)
})

test('rental page submits applications through the rental API service', () => {
  const source = readProjectFile('src/views/RentalView.vue')

  assert.match(source, /fetchRentalAvailability/)
  assert.match(source, /submitRentalRequest/)
  assert.match(source, /submitRentalApplication/)
  assert.match(source, /신청이 접수되었습니다/)
  assert.doesNotMatch(source, /window\.location\.href = mailto/)
})

test('admin rentals page loads requests and updates statuses through API service', () => {
  const source = readProjectFile('src/views/AdminRentalsView.vue')

  assert.match(source, /fetchAdminRentalRequests/)
  assert.match(source, /updateAdminRentalStatus/)
  assert.match(source, /deleteAdminRentalRequest/)
  assert.match(source, /applyStatus/)
  assert.match(source, /deleteSelectedRequest/)
  assert.match(source, /const requests = ref\(\[\]\)/)
  assert.match(source, /const normalizedRequests = data\.map\(normalizeAdminRequest\)/)
  assert.match(source, /requests\.value = normalizedRequests/)
  assert.match(source, /ensureActiveYear\(\)/)
  assert.match(source, /selectFirstFilteredRequest\(\)/)
  assert.doesNotMatch(source, /request-001/)
  assert.doesNotMatch(source, /리서치 프로젝트 팀/)
  assert.match(source, /createStatusOption\('reviewing'\)/)
  assert.match(source, /createStatusOption\('approved'\)/)
  assert.match(source, /createStatusOption\('rejected'\)/)
  assert.match(source, /createStatusOption\('cancelled_by_user'\)/)
})

test('admin rentals page manages availability windows in a calendar tab with Google Calendar events', () => {
  const source = readProjectFile('src/views/AdminRentalsView.vue')

  assert.match(source, /activeManagerTab/)
  assert.match(source, /신청내역/)
  assert.match(source, /가능일정/)
  assert.match(source, /fetchAdminRentalWindows/)
  assert.match(source, /createAdminRentalWindow/)
  assert.match(source, /updateAdminRentalWindow/)
  assert.match(source, /deleteAdminRentalWindow/)
  assert.match(source, /fetchGoogleCalendarSync/)
  assert.match(source, /adminCalendarEvents/)
  assert.match(source, /googleUsageEvents/)
  assert.match(source, /rental-blocked/)
  assert.match(source, /대관 가능/)
  assert.match(source, /차단/)
  assert.match(source, /admin-availability-layout/)
  assert.match(source, /admin-window-editor/)
  assert.match(source, /saveRentalWindow/)
  assert.match(source, /deleteRentalWindow/)
})

test('admin rentals page groups request history by requested year', () => {
  const source = readProjectFile('src/views/AdminRentalsView.vue')

  assert.match(source, /activeYear/)
  assert.match(source, /yearTabs/)
  assert.match(source, /yearOfRequest/)
  assert.match(source, /연도별 신청내역/)
  assert.match(source, /전체 연도/)
  assert.match(source, /requestYearMatches/)
  assert.match(source, /filteredRequests = computed/)
})

test('admin rentals page can delete the selected request from the list', () => {
  const source = readProjectFile('src/views/AdminRentalsView.vue')

  assert.match(source, /deleteSelectedRequest/)
  assert.match(source, /deleteAdminRentalRequest\(selectedRequest\.value\.id\)/)
  assert.match(source, /requests\.value = requests\.value\.filter/)
  assert.match(source, /신청삭제/)
  assert.match(source, /30일 동안 복원/)
  assert.match(source, /isDeleting/)
  assert.match(source, /admin-delete-button/)
})

test('admin rentals page uses explicit status labels and colors', () => {
  const source = readProjectFile('src/views/AdminRentalsView.vue')
  const domain = readProjectFile('src/domain/rental-statuses.mjs')

  assert.match(source, /STATUS_META/)
  assert.match(source, /RENTAL_STATUS_LABELS/)
  assert.match(domain, /new:\s*'예약신청'/)
  assert.match(domain, /reviewing:\s*'검토중'/)
  assert.match(domain, /approved:\s*'대관승인'/)
  assert.match(domain, /rejected:\s*'대관반려'/)
  assert.match(domain, /cancelled_by_user:\s*'취소\(사용자\)'/)
  assert.match(source, /admin-status-pill/)
  assert.match(source, /statusClass\(request\.status\)/)
  assert.match(source, /status-new/)
  assert.match(source, /status-reviewing/)
  assert.match(source, /status-approved/)
  assert.match(source, /status-rejected/)
  assert.match(source, /status-cancelled_by_user/)
  assert.match(source, /--status-color/)
  assert.doesNotMatch(source, /\{\s*id:\s*'new',\s*label:\s*'신규'/)
})

test('admin rental detail action buttons use the same solid status colors as list controls', () => {
  const source = readProjectFile('src/views/AdminRentalsView.vue')

  assert.match(source, /class="admin-action-button"/)
  assert.match(source, /:class="statusClass\(action\.status\)"/)
  assert.match(source, /\.admin-action-row\s+\.admin-action-button\s*\{[\s\S]*border-color:\s*var\(--status-color\)/)
  assert.match(source, /\.admin-action-row\s+\.admin-action-button\s*\{[\s\S]*background:\s*var\(--status-color\)/)
  assert.match(source, /\.admin-action-row\s+\.admin-action-button\s*\{[\s\S]*color:\s*#fff/)
  assert.doesNotMatch(source, /\.admin-action-row\s+\.admin-action-button\s*\{[\s\S]*background:\s*var\(--status-bg\)/)
})

test('admin rental detail action buttons render icons with their text labels', () => {
  const source = readProjectFile('src/views/AdminRentalsView.vue')

  assert.match(source, /iconPath/)
  assert.match(source, /class="admin-action-icon"/)
  assert.match(source, /<svg[\s\S]*class="admin-action-icon"/)
  assert.match(source, /<path\s+:d="action\.iconPath"/)
  assert.match(source, /<path\s+:d="DELETE_ICON_PATH"/)
  assert.match(source, /<path\s+:d="MAIL_ICON_PATH"/)
  assert.match(source, /\.admin-action-row button,[\s\S]*\.admin-action-row a\s*\{[\s\S]*gap:\s*6px/)
  assert.match(source, /\.admin-action-icon\s*\{[\s\S]*width:\s*14px[\s\S]*height:\s*14px/)
})

test('admin rental detail labels email notification state', () => {
  const source = readProjectFile('src/views/AdminRentalsView.vue')

  assert.match(source, /notificationStatus/)
  assert.match(source, /notificationMeta/)
  assert.match(source, /메일 발송 대기/)
  assert.match(source, /메일 발송됨/)
  assert.match(source, /메일 발송 실패/)
  assert.match(source, /대관 신청은 정상 저장되었습니다/)
  assert.match(source, /notification-failed/)
  assert.doesNotMatch(source, /\{\{\s*selectedRequest\.notificationErrorCode\s*\}\}/)
})

test('calendar store can hydrate D1-backed availability and unavailable rental blocks', () => {
  const source = readProjectFile('src/stores/calendar.js')

  assert.match(source, /rentalBlocks/)
  assert.match(source, /setRentalAvailability/)
  assert.match(source, /normalizeRentalWindow/)
  assert.match(source, /normalizeRentalBlock/)
  assert.match(source, /rental-requested/)
  assert.match(source, /예약신청/)
  assert.match(source, /rental-blocked/)
  assert.match(source, /차단/)
  assert.match(source, /\.\.\.state\.rentalBlocks/)
})

test('public calendar blocks admin blocked rental windows with the same visual language', () => {
  const component = readProjectFile('src/components/CalendarComponent.vue')
  const styles = readProjectFile('src/assets/styles/calendar.css')

  assert.match(component, /rental-blocked/)
  assert.match(component, /type-rental-blocked/)
  assert.match(styles, /range-rental-blocked/)
  assert.match(styles, /type-rental-blocked/)
  assert.match(styles, /차단/)
})

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}
