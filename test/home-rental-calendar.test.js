const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..')

test('calendar store starts without hardcoded calendar schedules', () => {
  const source = readProjectFile('src/stores/calendar.js')

  assert.match(source, /events:\s*\[\]/)
  assert.match(source, /rentalAvailability:\s*\[\]/)
  assert.doesNotMatch(source, /exhibition-2026-08-03-gb-talk/)
  assert.doesNotMatch(source, /rental-2026-08-30-latvia-pavilion/)
  assert.doesNotMatch(source, /show-kimsohee-2026-winter/)
  assert.doesNotMatch(source, /available-2026-07-09-2026-07-21/)
  assert.doesNotMatch(source, /available-2026-12-07-2026-12-31/)
  assert.match(source, /bookableWindows:/)
  assert.match(source, /calendarEvents:/)
})

test('home calendar exposes a compact rental summary and links to the rental page', () => {
  const source = readProjectFile('src/components/CalendarComponent.vue')

  assert.match(source, /defineProps/)
  assert.match(source, /bookingVariant/)
  assert.match(source, /ddf-booking-summary/)
  assert.match(source, /대관 가능 일정/)
  assert.match(source, /selectedWindow/)
  assert.match(source, /bookableWindows/)
  assert.match(source, /to="\/rental"/)
  assert.doesNotMatch(source, /openRentalInquiry/)
  assert.doesNotMatch(source, /프로젝트 소개/)
})

test('rental page owns the full public application flow', () => {
  const source = readProjectFile('src/views/RentalView.vue')

  assert.match(source, /data-build-revision="2026-08-01"/)

  assert.match(source, /rental-page/)
  assert.match(source, /대관 신청/)
  assert.match(source, /CalendarComponent/)
  assert.match(source, /ddf-rental-application/)
  assert.match(source, /submitRentalApplication/)
  assert.match(source, /submitRentalRequest/)
  assert.match(source, /신청이 접수되었습니다/)
  assert.match(source, /결제는 대관 승인 후 별도 안내됩니다/)
  assert.match(source, /희망 일정/)
  assert.match(source, /프로젝트 소개/)
})

test('rental page lets visitors choose a custom date range inside calendar availability', () => {
  const rentalSource = readProjectFile('src/views/RentalView.vue')
  const calendarSource = readProjectFile('src/components/CalendarComponent.vue')

  assert.match(calendarSource, /select-rental-range/)
  assert.match(calendarSource, /selectedBookingRange/)
  assert.match(calendarSource, /bookingResetKey/)
  assert.match(calendarSource, /resetSelectedBookingRange/)
  assert.match(calendarSource, /selectRentalDay/)
  assert.match(calendarSource, /isBlockedRentalDay/)
  const selectedDayFunction = calendarSource.match(/function isSelectedBookingDay\(dateKey\)\s*{[^}]+}/)?.[0] || ''
  assert.match(selectedDayFunction, /selectedBookingRange\.value/)
  assert.doesNotMatch(selectedDayFunction, /selectedWindow\.value/)
  assert.match(rentalSource, /booking-reset-key/)
  assert.match(rentalSource, /rental-selection-reset/)
  assert.match(rentalSource, /aria-label="선택 기간 초기화"/)
  assert.match(rentalSource, /resetSelectionKey/)
  assert.match(rentalSource, /selectedDateRange/)
  assert.match(rentalSource, /setSelectedDateFromCalendar/)
  assert.match(rentalSource, /requestedStartDate:\s*selectedDateRange\.startDate/)
  assert.match(rentalSource, /requestedEndDate:\s*selectedDateRange\.endDate/)
  assert.doesNotMatch(rentalSource, /class="rental-window-button"/)
})

test('home calendar hydrates Google Calendar events without exposing the private feed URL', () => {
  const calendarSource = readProjectFile('src/components/CalendarComponent.vue')
  const storeSource = readProjectFile('src/stores/calendar.js')
  const serviceSource = readProjectFile('src/services/calendar-sync.js')
  const rentalServiceSource = readProjectFile('src/services/rentals.js')

  assert.match(calendarSource, /fetchGoogleCalendarEvents/)
  assert.match(calendarSource, /fetchRentalAvailability/)
  assert.match(calendarSource, /setGoogleCalendarEvents/)
  assert.match(calendarSource, /setRentalAvailability/)
  assert.match(storeSource, /googleCalendarEvents/)
  assert.match(storeSource, /normalizeGoogleCalendarEvent/)
  assert.match(storeSource, /\.\.\.state\.googleCalendarEvents/)
  assert.match(serviceSource, /\/api\/calendar\/google/)
  assert.match(rentalServiceSource, /\/api\/rentals\/availability/)
  assert.doesNotMatch(calendarSource, /GOOGLE_CALENDAR_ICAL_URL/)
  assert.doesNotMatch(serviceSource, /calendar\.google\.com\/calendar\/ical/)
})

test('rental page typography follows the existing compact system instead of oversized hero text', () => {
  const source = readProjectFile('src/views/RentalView.vue')

  assert.doesNotMatch(source, /font-size:\s*clamp\(42px,\s*7vw,\s*104px\)/)
  assert.match(source, /\.rental-header h1\s*{[\s\S]*font-size:\s*28px/)
  assert.match(source, /\.rental-header p\s*{[\s\S]*font-size:\s*13px/)
  assert.match(source, /\.rental-guidance h2\s*{[\s\S]*font-size:\s*18px/)
})

test('admin rentals page defines the requested password-protected action shell', () => {
  const source = readProjectFile('src/views/AdminRentalsView.vue')
  const domain = readProjectFile('src/domain/rental-statuses.mjs')

  assert.match(source, /admin-rentals-page/)
  assert.match(source, /아이디\/비밀번호 로그인/)
  assert.doesNotMatch(source, /Google 로그인 후 관리자 신청 목록/)
  assert.doesNotMatch(source, /보호 예정/)
  assert.match(domain, /검토중/)
  assert.match(domain, /대관승인/)
  assert.match(domain, /대관반려/)
  assert.match(domain, /취소\(사용자\)/)
  assert.match(source, /답장메일작성/)
})

test('router and side navigation expose rental and the unified admin surface', () => {
  const routerSource = readProjectFile('src/router/index.js')
  const appSource = readProjectFile('src/App.vue')
  const smokeSource = readProjectFile('scripts/smoke-test.js')

  assert.match(routerSource, /path:\s*'\/rental'/)
  assert.match(routerSource, /name:\s*'rental'/)
  assert.match(routerSource, /path:\s*'\/admin'/)
  assert.match(routerSource, /name:\s*'admin'/)
  assert.doesNotMatch(routerSource, /path:\s*'\/admin\/|path:\s*'\/manage/)
  assert.match(appSource, /to="\/rental"/)
  assert.match(appSource, /대관 신청/)
  assert.match(smokeSource, /'\/rental'/)
  assert.match(smokeSource, /protectedRoutes = \['\/admin'\]/)
})

test('mobile app shell clips the off-canvas sidebar from page width', () => {
  const appSource = readProjectFile('src/App.vue')

  assert.match(appSource, /@media \(max-width:\s*1024px\)[\s\S]*\.layout\s*{[\s\S]*overflow-x:\s*clip/)
})

test('calendar and rental styles distinguish availability and page-level flow', () => {
  const styles = readProjectFile('src/assets/styles/calendar.css')
  const calendarSource = readProjectFile('src/components/CalendarComponent.vue')
  const rentalSource = readProjectFile('src/views/RentalView.vue')
  const adminSource = readProjectFile('src/views/AdminRentalsView.vue')

  assert.match(styles, /\.ddf-calendar-day\.range-rental-available/)
  assert.match(styles, /\.ddf-calendar-day\.range-rental-requested/)
  assert.match(styles, /\.ddf-calendar-day\.is-selected-booking-window/)
  assert.match(styles, /\.type-rental-available/)
  assert.match(styles, /\.type-rental-requested/)
  assert.match(calendarSource, /예약신청/)
  assert.match(styles, /\.ddf-booking-summary/)
  assert.doesNotMatch(styles, /font-size:\s*clamp\(36px/)
  assert.doesNotMatch(styles, /letter-spacing:\s*-/)
  assert.match(styles, /\.ddf-calendar-header h2\s*{[\s\S]*font-size:\s*34px/)
  assert.match(rentalSource, /\.rental-layout/)
  assert.match(rentalSource, /@media \(max-width: 900px\)[\s\S]*\.rental-layout/)
  assert.match(adminSource, /\.admin-rentals-layout/)
  assert.match(adminSource, /@media \(max-width: 900px\)[\s\S]*\.admin-rentals-layout/)
})

test('calendar day marks are compact inside date cells', () => {
  const styles = readProjectFile('src/assets/styles/calendar.css')
  const markRule = styles.match(/\.ddf-calendar-mark,\n\.ddf-calendar-closed\s*{([^}]+)}/)?.[1] || ''
  const mobileRule = styles.match(/@media \(max-width: 420px\)\s*{[\s\S]*?\.ddf-calendar-mark,\n\s*\.ddf-calendar-closed\s*{([^}]+)}/)?.[1] || ''

  assert.match(markRule, /width:\s*5px/)
  assert.match(markRule, /height:\s*5px/)
  assert.match(mobileRule, /width:\s*4px/)
  assert.match(mobileRule, /height:\s*4px/)
})

test('home layout lets the summary calendar push project lists instead of overlapping them', () => {
  const source = readProjectFile('src/views/HomeView.vue')
  const calendarCardRule = source.match(/\.calendar-card\s*{([^}]+)}/)?.[1] || ''

  assert.match(source, /--calendar-card-height:\s*640px/)
  assert.match(calendarCardRule, /height:\s*auto/)
  assert.match(calendarCardRule, /min-height:\s*var\(--calendar-card-height\)/)
  assert.doesNotMatch(calendarCardRule, /(^|\n)\s*height:\s*var\(--calendar-card-height\)/)
  assert.match(source, /\.recent-card\s*{[\s\S]*height:\s*auto/)
  assert.match(source, /\.col-center :deep\(\.recent-content\)\s*{[\s\S]*height:\s*auto[\s\S]*min-height:\s*0/)
})

test('Recent Updated stays visible after the exhibition date ends', () => {
  const source = readProjectFile('src/components/RecentComponent.vue')
  const home = readProjectFile('src/views/HomeView.vue')

  assert.doesNotMatch(source, /isExpired|parseDateRange|getEndOfDay|setInterval/)
  assert.match(source, /<figure class="recent-figure">/)
  assert.match(source, /:href="link \|\| undefined"/)
  assert.doesNotMatch(source, /recent-meta|recent-name|recent-date|recent-desc|recent-link|자세히 보기/)
  assert.doesNotMatch(source, /dateRange|desc:/)
  assert.doesNotMatch(home, /:date-range="recent\.dateRange"|:desc="recentMeta"/)
})

test('mobile home places Recent and content lists before the rental calendar', () => {
  const source = readProjectFile('src/views/HomeView.vue')
  const mobile = source.match(/@media \(max-width: 768px\)\s*{[\s\S]*?(?=@media|<\/style>)/)?.[0] || ''

  assert.match(mobile, /grid-template-areas:\s*"center"\s*"right"\s*"left"/)
})

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}
