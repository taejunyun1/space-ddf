<template>
  <main class="admin-rentals-page">
    <header class="admin-rentals-header">
      <div>
        <p>Admin Rentals</p>
        <h1>대관 관리</h1>
      </div>

      <span>아이디/비밀번호 로그인</span>
    </header>

    <section class="admin-manager-tabs" aria-label="대관 관리 메뉴">
      <button
        v-for="tab in managerTabs"
        :key="tab.id"
        type="button"
        :class="{ 'is-active': activeManagerTab === tab.id }"
        @click="selectManagerTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </section>

    <template v-if="activeManagerTab === 'requests'">
      <section class="admin-rentals-tabs" aria-label="대관 신청 상태">
        <button
          v-for="tab in statusTabs"
          :key="tab.id"
          type="button"
          :class="['admin-status-tab', statusClass(tab.id), { 'is-active': activeStatus === tab.id }]"
          @click="activeStatus = tab.id"
        >
          <span>{{ tab.label }}</span>
          <strong>{{ tab.count }}</strong>
        </button>
      </section>

      <section class="admin-year-tabs" aria-label="연도별 신청내역">
        <button
          v-for="year in yearTabs"
          :key="year.id"
          type="button"
          :class="{ 'is-active': activeYear === year.id }"
          @click="activeYear = year.id"
        >
          <span>{{ year.label }}</span>
          <strong>{{ year.count }}</strong>
        </button>
      </section>

      <button class="admin-refresh-button" type="button" @click="loadRequests">
        신청내역 불러오기
      </button>
      <label class="admin-trash-toggle">
        <input v-model="includeDeleted" type="checkbox" @change="loadRequests">
        <span>휴지통 포함</span>
      </label>

      <p v-if="loadNotice" class="admin-rentals-notice">
        {{ loadNotice }}
      </p>

      <section class="admin-rentals-layout" aria-label="대관 신청 관리">
        <div class="admin-request-list">
          <button
            v-for="request in filteredRequests"
            :key="request.id"
            type="button"
            :class="['admin-request-row', statusClass(request.status), { 'is-active': selectedRequest?.id === request.id }]"
            @click="selectedRequest = request"
          >
            <span class="admin-status-pill" :class="statusClass(request.status)">
              {{ request.statusLabel }}
            </span>
            <strong>{{ request.teamName }}</strong>
            <em>{{ request.dateRange }}</em>
            <small v-if="request.deletedAt">휴지통 · {{ formatSyncTime(request.purgeAfter) }} 완전 삭제</small>
          </button>

          <button
            v-if="nextCursor"
            type="button"
            class="admin-refresh-button"
            @click="loadMoreRequests"
          >
            더 불러오기
          </button>

          <p v-if="!filteredRequests.length" class="admin-empty-state">
            해당 상태의 대관 신청이 없습니다.
          </p>
        </div>

        <aside class="admin-request-detail" aria-label="선택 신청 상세">
          <template v-if="selectedRequest">
            <div class="admin-detail-head">
              <span class="admin-status-pill" :class="statusClass(selectedRequest.status)">
                {{ selectedRequest.statusLabel }}
              </span>
              <h2>{{ selectedRequest.teamName }}</h2>
              <p>{{ selectedRequest.dateRange }}</p>
            </div>

            <dl class="admin-detail-list">
              <div>
                <dt>연락처</dt>
                <dd>{{ selectedRequest.contact }}</dd>
              </div>
              <div>
                <dt>지원사업</dt>
                <dd>{{ supportProgramLabel(selectedRequest.supportProgram) }}</dd>
              </div>
              <div>
                <dt>프로젝트</dt>
                <dd>{{ selectedRequest.projectDescription || selectedRequest.projectIntro }}</dd>
              </div>
              <div>
                <dt>메일 알림</dt>
                <dd>
                  <strong
                    class="notification-state"
                    :class="notificationMeta.className"
                  >
                    {{ notificationMeta.label }}
                  </strong>
                  <p
                    v-if="selectedRequest.notificationStatus === 'failed'"
                    class="notification-help"
                  >
                    대관 신청은 정상 저장되었습니다.
                  </p>
                  <button
                    v-if="selectedRequest.notificationStatus === 'failed'"
                    type="button"
                    class="admin-refresh-button"
                    :disabled="isRetryingEmail"
                    @click="retrySelectedNotification"
                  >
                    <svg class="admin-action-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path :d="MAIL_ICON_PATH" />
                    </svg>
                    <span>메일 다시 보내기</span>
                  </button>
                </dd>
              </div>
            </dl>

            <label class="admin-note">
              <span>관리자 메모</span>
              <textarea v-model="adminNote" rows="5"></textarea>
            </label>

            <section class="admin-history" aria-label="상태 변경 이력">
              <h3>상태 이력</h3>
              <p v-for="item in selectedHistory" :key="item.id">
                <span>{{ item.toStatusLabel }}</span>
                <time>{{ formatSyncTime(item.createdAt) }}</time>
                <small v-if="item.note">{{ item.note }}</small>
              </p>
            </section>

            <div class="admin-action-row" aria-label="대관 신청 액션">
              <button
                v-if="selectedRequest.deletedAt"
                type="button"
                class="admin-action-button status-approved"
                :disabled="isUpdating"
                @click="restoreSelectedRequest"
              >
                <svg class="admin-action-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path :d="RESET_ICON_PATH" />
                </svg>
                <span>신청복원</span>
              </button>
              <template v-else>
                <button
                  v-for="action in statusActions"
                  :key="action.status"
                  type="button"
                  class="admin-action-button"
                  :class="statusClass(action.status)"
                  :disabled="isUpdating"
                  @click="applyStatus(action.status)"
                >
                  <svg
                    class="admin-action-icon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path :d="action.iconPath" />
                  </svg>
                  <span>{{ action.label }}</span>
                </button>
              </template>
              <button
                v-if="!selectedRequest.deletedAt"
                type="button"
                class="admin-delete-button"
                :disabled="isUpdating || isDeleting"
                @click="deleteSelectedRequest"
              >
                <svg
                  class="admin-action-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path :d="DELETE_ICON_PATH" />
                </svg>
                <span>신청삭제</span>
              </button>
              <a :href="replyMailto">
                <svg
                  class="admin-action-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path :d="MAIL_ICON_PATH" />
                </svg>
                <span>답장메일작성</span>
              </a>
            </div>
          </template>

          <p v-else class="admin-empty-state">
            선택된 대관 신청이 없습니다.
          </p>
        </aside>
      </section>
    </template>

    <template v-else>
      <section class="admin-availability-toolbar" aria-label="가능일정 관리 안내">
        <div>
          <p>Availability Calendar</p>
          <h2>대관 가능일정</h2>
        </div>

        <button
          type="button"
          class="admin-refresh-button"
          :disabled="isLoadingAvailability"
          @click="loadAvailabilityManager"
        >
          가능일정 불러오기
        </button>
      </section>

      <p v-if="availabilityNotice" class="admin-rentals-notice">
        {{ availabilityNotice }}
      </p>
      <p class="admin-rentals-notice">
        Google Calendar: {{ googleSyncLabel }}
      </p>

      <section class="admin-availability-layout" aria-label="대관 가능일정 관리">
        <section class="admin-availability-calendar ddf-calendar" aria-label="관리자 가능일정 캘린더">
          <header class="ddf-calendar-header">
            <div class="ddf-calendar-heading">
              <p class="ddf-calendar-eyebrow">Calendar</p>
              <h2>{{ availabilityMonthLabel }}</h2>
            </div>

            <div class="ddf-calendar-control">
              <button type="button" class="today-btn" @click="goAvailabilityToday">
                Today
              </button>
              <button type="button" aria-label="이전 달" @click="prevAvailabilityMonth">
                ‹
              </button>
              <button type="button" aria-label="다음 달" @click="nextAvailabilityMonth">
                ›
              </button>
            </div>
          </header>

          <div class="ddf-calendar-week">
            <span v-for="dayName in weekDays" :key="dayName">
              {{ dayName }}
            </span>
          </div>

          <div class="ddf-calendar-grid">
            <button
              v-for="day in adminCalendarDays"
              :key="day.key"
              type="button"
              class="ddf-calendar-day"
              :class="[
                {
                  'is-muted': !day.currentMonth,
                  'is-today': day.today,
                  'has-event': day.events.length,
                  'is-selected-booking-window': isSelectedAvailabilityDay(day.key),
                  'is-selected-booking-range': isSelectedAvailabilityDay(day.key),
                },
                ...day.rangeClasses
              ]"
              :aria-label="availabilityDayAriaLabel(day)"
              @click="selectAvailabilityDay(day)"
            >
              <span class="ddf-calendar-date">{{ day.date }}</span>

              <span
                v-if="visibleMarks(day.events).length"
                class="ddf-calendar-marks"
              >
                <span
                  v-for="event in visibleMarks(day.events)"
                  :key="event.id"
                  class="ddf-calendar-mark"
                  :class="`type-${event.type}`"
                ></span>
              </span>

              <span v-if="day.events.length" class="ddf-calendar-tooltip">
                <span
                  v-for="event in uniqueEvents(day.events)"
                  :key="event.id"
                  class="tooltip-row"
                >
                  <strong>{{ event.label }}</strong>
                  {{ event.title }}
                  <em>{{ formatDateRange(event.startDate, event.endDate || event.startDate) }}</em>
                </span>
              </span>
            </button>
          </div>

          <footer class="ddf-calendar-footer">
            <div
              v-for="item in calendarLegend"
              :key="item.type"
              class="ddf-calendar-legend"
            >
              <span class="ddf-calendar-legend-dot" :class="`type-${item.type}`"></span>
              <span>{{ item.label }}</span>
            </div>
          </footer>
        </section>

        <aside class="admin-window-editor" aria-label="대관 가능일정 입력">
          <div class="admin-window-editor-head">
            <p>Window Editor</p>
            <h2>{{ activeWindowId ? '가능일정 수정' : '가능일정 추가' }}</h2>
          </div>

          <form class="admin-window-form" @submit.prevent="saveRentalWindow">
            <label>
              <span>상태</span>
              <select v-model="availabilityForm.status" @change="syncDefaultWindowLabel">
                <option value="available">대관 가능</option>
                <option value="blocked">차단</option>
              </select>
            </label>

            <label>
              <span>시작일</span>
              <input v-model="availabilityForm.startDate" type="date" required />
            </label>

            <label>
              <span>종료일</span>
              <input v-model="availabilityForm.endDate" type="date" required />
            </label>

            <label class="admin-window-form-wide">
              <span>라벨</span>
              <input v-model="availabilityForm.label" placeholder="예: 9월 대관 가능 일정" required />
            </label>

            <label class="admin-window-form-wide">
              <span>공개 설명</span>
              <textarea
                v-model="availabilityForm.publicDescription"
                rows="3"
                maxlength="4000"
                placeholder="신청자에게 표시할 일정 안내를 적어주세요."
              ></textarea>
            </label>

            <label class="admin-window-form-wide">
              <span>관리 메모</span>
              <textarea
                v-model="availabilityForm.adminNotes"
                rows="3"
                maxlength="4000"
                placeholder="내부 확인사항을 적어주세요."
              ></textarea>
            </label>

            <div class="admin-window-actions admin-action-row">
              <button
                type="submit"
                class="admin-action-button"
                :class="availabilityForm.status === 'available' ? 'status-approved' : 'status-cancelled_by_user'"
                :disabled="isSavingWindow"
              >
                <svg class="admin-action-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path :d="SAVE_ICON_PATH" />
                </svg>
                <span>{{ activeWindowId ? '일정수정' : '일정추가' }}</span>
              </button>

              <button
                type="button"
                class="admin-delete-button"
                :disabled="!activeWindowId || isDeletingWindow"
                @click="deleteRentalWindow"
              >
                <svg class="admin-action-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path :d="DELETE_ICON_PATH" />
                </svg>
                <span>일정삭제</span>
              </button>

              <button type="button" class="admin-reset-button" @click="resetRentalWindowForm">
                <svg class="admin-action-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path :d="RESET_ICON_PATH" />
                </svg>
                <span>초기화</span>
              </button>
            </div>
          </form>

          <div class="admin-window-list" aria-label="등록된 가능일정">
            <button
              v-for="window in sortedRentalWindows"
              :key="window.id"
              type="button"
              :class="['admin-window-row', `window-${window.status}`, { 'is-active': activeWindowId === window.id }]"
              @click="editRentalWindow(window)"
            >
              <span>{{ window.status === 'available' ? '대관 가능' : '차단' }}</span>
              <strong>{{ window.label }}</strong>
              <em>{{ formatDateRange(window.startDate, window.endDate) }}</em>
            </button>

            <p v-if="!sortedRentalWindows.length" class="admin-empty-state">
              등록된 가능일정이 없습니다.
            </p>
          </div>
        </aside>
      </section>
    </template>
  </main>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { fetchGoogleCalendarSync } from '@/services/calendar-sync'
import {
  createAdminRentalWindow,
  deleteAdminRentalRequest,
  deleteAdminRentalWindow,
  fetchAdminRentalRequests,
  fetchAdminRentalHistory,
  fetchAdminRentalWindows,
  retryAdminRentalNotification,
  restoreAdminRentalRequest,
  updateAdminRentalStatus,
  updateAdminRentalWindow,
} from '@/services/rentals'
import '@/assets/styles/calendar.css'
import { RENTAL_STATUS_LABELS } from '@/domain/rental-statuses.mjs'

const activeManagerTab = ref('requests')
const activeStatus = ref('new')
const activeYear = ref('all')
const adminNote = ref('')
const loadNotice = ref('')
const availabilityNotice = ref('')
const isUpdating = ref(false)
const isDeleting = ref(false)
const isLoadingAvailability = ref(false)
const isSavingWindow = ref(false)
const isDeletingWindow = ref(false)
const isRetryingEmail = ref(false)
const requests = ref([])
const rentalWindows = ref([])
const googleUsageEvents = ref([])
const googleSyncMeta = ref({ configured: false, success: true, syncedAt: null })
const includeDeleted = ref(false)
const nextCursor = ref(null)
const selectedHistory = ref([])
const selectedRequest = ref(null)
const activeWindowId = ref('')
const pendingAvailabilityStart = ref('')

const today = new Date()
today.setHours(0, 0, 0, 0)

const currentAvailabilityYear = ref(today.getFullYear())
const currentAvailabilityMonth = ref(today.getMonth())
const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const availabilityForm = reactive({
  startDate: '',
  endDate: '',
  status: 'available',
  label: '',
  publicDescription: '',
  adminNotes: '',
})

const ICON_PATHS = {
  reviewing: 'M10.5 18a7.5 7.5 0 1 1 5.3-12.8 7.5 7.5 0 0 1-5.3 12.8Zm5.2-2.3 4.3 4.3',
  approved: 'M20 6 9 17l-5-5',
  rejected: 'M18 6 6 18M6 6l12 12',
  cancelled_by_user: 'M18 6 6 18M5 12a7 7 0 1 0 14 0 7 7 0 0 0-14 0',
}
const DELETE_ICON_PATH = 'M3 6h18M8 6V4h8v2m-10 0 1 14h10l1-14M10 10v6M14 10v6'
const MAIL_ICON_PATH = 'M4 6h16v12H4zM4 7l8 6 8-6'
const SAVE_ICON_PATH = 'M20 6 9 17l-5-5'
const RESET_ICON_PATH = 'M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6'
const STATUS_META = {
  new: { label: RENTAL_STATUS_LABELS.new, className: 'status-new' },
  reviewing: { label: RENTAL_STATUS_LABELS.reviewing, className: 'status-reviewing', iconPath: ICON_PATHS.reviewing },
  approved: { label: RENTAL_STATUS_LABELS.approved, className: 'status-approved', iconPath: ICON_PATHS.approved },
  rejected: { label: RENTAL_STATUS_LABELS.rejected, className: 'status-rejected', iconPath: ICON_PATHS.rejected },
  cancelled_by_user: {
    label: RENTAL_STATUS_LABELS.cancelled_by_user,
    className: 'status-cancelled_by_user',
    iconPath: ICON_PATHS.cancelled_by_user,
  },
}
const NOTIFICATION_META = {
  pending: { label: '메일 발송 대기', className: 'notification-pending' },
  sent: { label: '메일 발송됨', className: 'notification-sent' },
  failed: { label: '메일 발송 실패', className: 'notification-failed' },
  not_applicable: {
    label: '메일 알림 이전 신청',
    className: 'notification-not-applicable',
  },
}
const calendarLegend = [
  { type: 'exhibition', label: '전시' },
  { type: 'workshop', label: '워크샵' },
  { type: 'rental', label: '예약 확정' },
  { type: 'rental-requested', label: '예약신청' },
  { type: 'rental-available', label: '대관 가능' },
  { type: 'rental-blocked', label: '차단' },
]
const managerTabs = computed(() => [
  { id: 'requests', label: '신청내역' },
  { id: 'availability', label: '가능일정' },
])
const statusActions = [
  createStatusOption('reviewing'),
  createStatusOption('approved'),
  createStatusOption('rejected'),
  createStatusOption('cancelled_by_user'),
]
const statusTabs = computed(() => [
  createStatusOption('new'),
  createStatusOption('reviewing'),
  createStatusOption('approved'),
  createStatusOption('rejected'),
  createStatusOption('cancelled_by_user'),
])
const yearTabs = computed(() => {
  const years = Array.from(new Set(
    requests.value.map(yearOfRequest).filter(Boolean)
  )).sort((left, right) => right.localeCompare(left))

  return [
    { id: 'all', label: '전체 연도', count: requests.value.length },
    ...years.map(year => ({
      id: year,
      label: year,
      count: requests.value.filter(request => yearOfRequest(request) === year).length,
    })),
  ]
})
const filteredRequests = computed(() => (
  requests.value.filter(request => (
    request.status === activeStatus.value && requestYearMatches(request)
  ))
))
const sortedRentalWindows = computed(() => (
  [...rentalWindows.value].sort((left, right) => (
    `${left.startDate}-${left.endDate}`.localeCompare(`${right.startDate}-${right.endDate}`)
  ))
))
const activeRequestCalendarEvents = computed(() => (
  requests.value
    .filter(request => ['new', 'reviewing', 'approved'].includes(request.status))
    .map(requestToCalendarEvent)
))
const adminCalendarEvents = computed(() => [
  ...rentalWindows.value.map(windowToCalendarEvent),
  ...activeRequestCalendarEvents.value,
  ...googleUsageEvents.value,
])
const adminEventsByDate = computed(() => {
  const map = {}

  adminCalendarEvents.value.forEach((event) => {
    addEventToDateMap(map, event)
  })

  return map
})
const availabilityMonthLabel = computed(() => {
  const date = new Date(currentAvailabilityYear.value, currentAvailabilityMonth.value, 1)

  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
})
const adminCalendarDays = computed(() => {
  const year = currentAvailabilityYear.value
  const month = currentAvailabilityMonth.value
  const firstDay = new Date(year, month, 1)
  const startDay = firstDay.getDay()
  const startDate = new Date(year, month, 1 - startDay)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + index)
    date.setHours(0, 0, 0, 0)

    const dateKey = formatDateKey(date)
    const events = adminEventsByDate.value[dateKey] || []

    return {
      key: dateKey,
      date: date.getDate(),
      currentMonth: date.getMonth() === month,
      today: date.getTime() === today.getTime(),
      events,
      rangeClasses: makeRangeClasses(events),
    }
  })
})
const notificationMeta = computed(() => (
  NOTIFICATION_META[selectedRequest.value?.notificationStatus]
    || NOTIFICATION_META.not_applicable
))
const googleSyncLabel = computed(() => {
  if (!googleSyncMeta.value.configured) return '연동 설정 없음'
  if (!googleSyncMeta.value.success) {
    return googleSyncMeta.value.syncedAt
      ? `동기화 실패 · 마지막 성공 ${formatSyncTime(googleSyncMeta.value.syncedAt)}`
      : '동기화 실패'
  }
  return googleSyncMeta.value.syncedAt
    ? `동기화 성공 · ${formatSyncTime(googleSyncMeta.value.syncedAt)}`
    : '동기화 성공'
})
const replyMailto = computed(() => {
  if (!selectedRequest.value) return 'mailto:space.ddf@gmail.com'

  const target = selectedRequest.value.contact.includes('@')
    ? selectedRequest.value.contact
    : 'space.ddf@gmail.com'
  const subject = `[Space DDF 대관 검토] ${selectedRequest.value.dateRange}`
  const body = [
    `${selectedRequest.value.teamName} 님,`,
    '',
    'Space DDF 대관 문의 주셔서 감사합니다.',
    '',
    `희망 일정: ${selectedRequest.value.dateRange}`,
    `연락처: ${selectedRequest.value.contact}`,
    '',
    adminNote.value,
  ].join('\n')

  return `mailto:${target}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
})

watch(activeManagerTab, (tab) => {
  if (tab === 'availability' && !rentalWindows.value.length && !isLoadingAvailability.value) {
    loadAvailabilityManager()
  }
})

watch([activeStatus, activeYear], () => {
  selectFirstFilteredRequest()
})

watch(selectedRequest, (request) => {
  adminNote.value = request?.adminNote || ''
  selectedHistory.value = []
  if (request?.id) loadSelectedHistory(request.id)
})

async function loadRequests() {
  try {
    const { data, meta } = await fetchAdminRentalRequests({
      status: 'all', includeDeleted: includeDeleted.value,
    })
    const normalizedRequests = data.map(normalizeAdminRequest)

    requests.value = normalizedRequests
    nextCursor.value = meta.nextCursor
    ensureActiveYear()
    selectFirstFilteredRequest()

    loadNotice.value = normalizedRequests.length
      ? '최신 신청내역을 불러왔습니다.'
      : '접수된 대관 신청이 없습니다.'
  } catch (error) {
    loadNotice.value = '대관 신청내역을 불러오지 못했습니다.'
  }
}

async function loadMoreRequests() {
  if (!nextCursor.value) return
  try {
    const { data, meta } = await fetchAdminRentalRequests({
      status: 'all', includeDeleted: includeDeleted.value, cursor: nextCursor.value,
    })
    requests.value.push(...data.map(normalizeAdminRequest))
    nextCursor.value = meta.nextCursor
    ensureActiveYear()
  } catch (error) {
    loadNotice.value = error.message || '추가 신청내역을 불러오지 못했습니다.'
  }
}

async function loadSelectedHistory(id) {
  try {
    selectedHistory.value = await fetchAdminRentalHistory(id)
  } catch {
    selectedHistory.value = []
  }
}

async function loadAvailabilityManager() {
  isLoadingAvailability.value = true

  try {
    const [windows, requestData, googleSync] = await Promise.all([
      fetchAdminRentalWindows(),
      fetchAdminRentalRequests({ status: 'all' }),
      fetchGoogleCalendarSync().catch(() => ({
        events: [],
        meta: { configured: true, success: false, syncedAt: null },
      })),
    ])
    const normalizedRequests = requestData.data.map(normalizeAdminRequest)

    rentalWindows.value = windows.map(normalizeRentalWindow)
    requests.value = normalizedRequests
    googleUsageEvents.value = googleSync.events.map(normalizeGoogleUsageEvent)
    googleSyncMeta.value = googleSync.meta
    ensureActiveYear()
    selectFirstFilteredRequest()
    focusAvailabilityMonth()

    availabilityNotice.value = '가능일정과 iCal 사용일정을 불러왔습니다.'
  } catch (error) {
    availabilityNotice.value = error.message || '가능일정을 불러오지 못했습니다.'
  } finally {
    isLoadingAvailability.value = false
  }
}

async function applyStatus(status) {
  if (!selectedRequest.value) return

  isUpdating.value = true

  try {
    const updated = normalizeAdminRequest(await updateAdminRentalStatus(selectedRequest.value.id, {
      status,
      adminNote: adminNote.value,
    }))
    const index = requests.value.findIndex(request => request.id === updated.id)

    if (index >= 0) requests.value.splice(index, 1, updated)
    else requests.value.unshift(updated)

    activeStatus.value = status
    selectedRequest.value = updated
    loadNotice.value = `${updated.statusLabel} 상태로 저장했습니다.`
  } catch (error) {
    loadNotice.value = error.message || '상태를 저장하지 못했습니다.'
  } finally {
    isUpdating.value = false
  }
}

async function deleteSelectedRequest() {
  if (!selectedRequest.value) return

  const confirmed = window.confirm('선택한 신청내역을 휴지통으로 이동할까요? 30일 동안 복원할 수 있습니다.')
  if (!confirmed) return

  isDeleting.value = true

  try {
    await deleteAdminRentalRequest(selectedRequest.value.id)

    requests.value = requests.value.filter(request => request.id !== selectedRequest.value.id)
    ensureActiveYear()
    selectFirstFilteredRequest()
    loadNotice.value = '신청내역을 삭제했습니다.'
  } catch (error) {
    loadNotice.value = error.message || '신청내역을 삭제하지 못했습니다.'
  } finally {
    isDeleting.value = false
  }
}

async function retrySelectedNotification() {
  if (!selectedRequest.value || isRetryingEmail.value) return
  isRetryingEmail.value = true
  try {
    await retryAdminRentalNotification(selectedRequest.value.id)
    selectedRequest.value.notificationStatus = 'pending'
    selectedRequest.value.notificationErrorCode = null
    loadNotice.value = '메일 재발송을 요청했습니다.'
  } catch (error) {
    loadNotice.value = error.message || '메일 재발송을 요청하지 못했습니다.'
  } finally {
    isRetryingEmail.value = false
  }
}

async function restoreSelectedRequest() {
  if (!selectedRequest.value?.deletedAt) return
  isUpdating.value = true
  try {
    const restored = normalizeAdminRequest(await restoreAdminRentalRequest(selectedRequest.value.id))
    const index = requests.value.findIndex(request => request.id === restored.id)
    if (index >= 0) requests.value.splice(index, 1, restored)
    selectedRequest.value = restored
    loadNotice.value = '신청내역을 복원했습니다.'
  } catch (error) {
    loadNotice.value = error.message || '신청내역을 복원하지 못했습니다.'
  } finally {
    isUpdating.value = false
  }
}

async function saveRentalWindow() {
  const input = normalizeRentalWindowForm()
  if (!input) return

  isSavingWindow.value = true

  try {
    const saved = activeWindowId.value
      ? await updateAdminRentalWindow(activeWindowId.value, input)
      : await createAdminRentalWindow(input)
    const normalized = normalizeRentalWindow(saved)
    const index = rentalWindows.value.findIndex(window => window.id === normalized.id)

    if (index >= 0) rentalWindows.value.splice(index, 1, normalized)
    else rentalWindows.value.push(normalized)

    editRentalWindow(normalized)
    availabilityNotice.value = normalized.status === 'available'
      ? '대관 가능 일정으로 저장했습니다.'
      : '차단 일정으로 저장했습니다.'
  } catch (error) {
    availabilityNotice.value = error.message || '가능일정을 저장하지 못했습니다.'
  } finally {
    isSavingWindow.value = false
  }
}

async function deleteRentalWindow() {
  if (!activeWindowId.value) return

  const confirmed = window.confirm('선택한 가능일정을 삭제할까요? 활성 신청과 겹치면 삭제되지 않습니다.')
  if (!confirmed) return

  isDeletingWindow.value = true

  try {
    await deleteAdminRentalWindow(activeWindowId.value)

    rentalWindows.value = rentalWindows.value.filter(window => window.id !== activeWindowId.value)
    resetRentalWindowForm()
    availabilityNotice.value = '가능일정을 삭제했습니다.'
  } catch (error) {
    availabilityNotice.value = error.message || '가능일정을 삭제하지 못했습니다.'
  } finally {
    isDeletingWindow.value = false
  }
}

function normalizeRentalWindowForm() {
  const startDate = availabilityForm.startDate
  const endDate = availabilityForm.endDate || startDate
  const label = availabilityForm.label.trim()

  if (!startDate || !endDate || !label) {
    availabilityNotice.value = '시작일, 종료일, 라벨을 입력해주세요.'
    return null
  }

  return {
    startDate: startDate <= endDate ? startDate : endDate,
    endDate: startDate <= endDate ? endDate : startDate,
    status: availabilityForm.status,
    label,
    publicDescription: availabilityForm.publicDescription.trim(),
    adminNotes: availabilityForm.adminNotes.trim(),
  }
}

function selectManagerTab(tab) {
  activeManagerTab.value = tab
}

function selectAvailabilityDay(day) {
  activeWindowId.value = ''

  if (!pendingAvailabilityStart.value) {
    availabilityForm.startDate = day.key
    availabilityForm.endDate = day.key
    pendingAvailabilityStart.value = day.key
  } else {
    const startDate = pendingAvailabilityStart.value <= day.key
      ? pendingAvailabilityStart.value
      : day.key
    const endDate = pendingAvailabilityStart.value <= day.key
      ? day.key
      : pendingAvailabilityStart.value

    availabilityForm.startDate = startDate
    availabilityForm.endDate = endDate
    pendingAvailabilityStart.value = ''
  }

  syncDefaultWindowLabel()
}

function editRentalWindow(window) {
  activeWindowId.value = window.id
  pendingAvailabilityStart.value = ''
  availabilityForm.startDate = window.startDate
  availabilityForm.endDate = window.endDate || window.startDate
  availabilityForm.status = window.status
  availabilityForm.label = window.label
  availabilityForm.publicDescription = window.publicDescription || ''
  availabilityForm.adminNotes = window.adminNotes || ''
  setAvailabilityMonth(window.startDate)
}

function resetRentalWindowForm() {
  activeWindowId.value = ''
  pendingAvailabilityStart.value = ''
  availabilityForm.startDate = ''
  availabilityForm.endDate = ''
  availabilityForm.status = 'available'
  availabilityForm.label = ''
  availabilityForm.publicDescription = ''
  availabilityForm.adminNotes = ''
}

function syncDefaultWindowLabel() {
  if (!availabilityForm.startDate || activeWindowId.value) return

  availabilityForm.label = defaultWindowLabel(availabilityForm.startDate, availabilityForm.status)
}

function defaultWindowLabel(dateKey, status) {
  const month = Number(dateKey.slice(5, 7))

  return status === 'available'
    ? `${month}월 대관 가능 일정`
    : `${month}월 차단 일정`
}

function normalizeAdminRequest(request) {
  const statusMeta = getStatusMeta(request.status)

  return {
    ...request,
    teamName: request.teamName || request.applicantName,
    projectIntro: request.projectIntro || request.projectDescription,
    statusLabel: statusMeta.label,
    dateRange: request.dateRange || formatDateRange(request.requestedStartDate, request.requestedEndDate),
    notificationStatus: request.notificationStatus || 'not_applicable',
    notificationAttemptedAt: request.notificationAttemptedAt || null,
    notificationErrorCode: request.notificationErrorCode || null,
  }
}

function normalizeRentalWindow(window) {
  return {
    id: window.id,
    startDate: window.startDate,
    endDate: window.endDate || window.startDate,
    status: window.status || 'available',
    label: window.label || labelForCalendarType(window.type || 'rental-available'),
    title: window.title || window.label || '대관 가능 일정',
    publicDescription: window.publicDescription || '',
    adminNotes: window.adminNotes || '',
    type: window.type || (window.status === 'blocked' ? 'rental-blocked' : 'rental-available'),
  }
}

function normalizeGoogleUsageEvent(event) {
  const type = event.type || 'exhibition'

  return {
    id: `google-${event.id}`,
    startDate: event.startDate,
    endDate: event.endDate || event.startDate,
    type,
    label: event.label || labelForCalendarType(type),
    title: event.title || 'Google Calendar 일정',
    status: event.status || 'confirmed',
    source: 'google-calendar',
  }
}

function formatSyncTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
}

function windowToCalendarEvent(window) {
  return {
    ...window,
    type: window.status === 'blocked' ? 'rental-blocked' : 'rental-available',
    label: window.status === 'blocked' ? '차단' : '대관 가능',
    title: window.label,
    source: 'rental-window',
  }
}

function requestToCalendarEvent(request) {
  const confirmed = request.status === 'approved'

  return {
    id: `request-${request.id}`,
    startDate: request.requestedStartDate,
    endDate: request.requestedEndDate,
    type: confirmed ? 'rental' : 'rental-requested',
    label: confirmed ? '예약 확정' : '예약신청',
    title: request.teamName,
    status: request.status,
    source: 'rental-request',
  }
}

function addEventToDateMap(map, event) {
  if (!event.startDate) return

  const start = parseDateKey(event.startDate)
  const end = parseDateKey(event.endDate || event.startDate)
  const cursor = new Date(start)

  while (cursor <= end) {
    const dateKey = formatDateKey(cursor)

    if (!map[dateKey]) map[dateKey] = []

    map[dateKey].push({
      ...event,
      date: dateKey,
      isRangeStart: dateKey === event.startDate,
      isRangeEnd: dateKey === (event.endDate || event.startDate),
    })

    cursor.setDate(cursor.getDate() + 1)
  }
}

function makeRangeClasses(events) {
  const classes = []

  events.forEach((event) => {
    classes.push(`range-${event.type}`)

    if (event.isRangeStart) classes.push(`range-start-${event.type}`)
    if (event.isRangeEnd) classes.push(`range-end-${event.type}`)
  })

  return classes
}

function visibleMarks(events) {
  return events.filter(event => event.isRangeStart || event.isRangeEnd)
}

function uniqueEvents(events) {
  const map = new Map()

  events.forEach((event) => {
    map.set(event.id, event)
  })

  return [...map.values()]
}

function countByStatus(status) {
  return requests.value.filter(request => (
    request.status === status && requestYearMatches(request)
  )).length
}

function createStatusOption(status) {
  const statusMeta = getStatusMeta(status)

  return {
    id: status,
    status,
    label: statusMeta.label,
    iconPath: statusMeta.iconPath,
    count: countByStatus(status),
  }
}

function getStatusMeta(status) {
  return STATUS_META[status] || {
    label: status || '상태미정',
    className: 'status-unknown',
  }
}

function statusClass(status) {
  return getStatusMeta(status).className
}

function supportProgramLabel(value) {
  const labels = {
    none: '해당 없음',
    'k-art': 'K-ART',
    'gwangju-foundation': '광주문화재단',
    other: '기타 지원사업',
  }

  return labels[value] || value
}

function yearOfRequest(request) {
  const dateSource = request.requestedStartDate || request.createdAt || ''
  const match = String(dateSource).match(/^\d{4}/)

  return match?.[0] || ''
}

function requestYearMatches(request) {
  return activeYear.value === 'all' || yearOfRequest(request) === activeYear.value
}

function ensureActiveYear() {
  if (activeYear.value === 'all') return
  if (requests.value.some(request => yearOfRequest(request) === activeYear.value)) return

  activeYear.value = 'all'
}

function selectFirstFilteredRequest() {
  if (filteredRequests.value.some(request => request.id === selectedRequest.value?.id)) return

  selectedRequest.value = filteredRequests.value[0] || null
}

function isSelectedAvailabilityDay(dateKey) {
  if (!availabilityForm.startDate) return false

  return dateKey >= availabilityForm.startDate
    && dateKey <= (availabilityForm.endDate || availabilityForm.startDate)
}

function availabilityDayAriaLabel(day) {
  if (!day.events.length) return `${day.date}일`

  return `${day.date}일, ${uniqueEvents(day.events).map(event => `${event.label}: ${event.title}`).join(', ')}`
}

function labelForCalendarType(type) {
  if (type === 'rental') return '예약 확정'
  if (type === 'rental-requested') return '예약신청'
  if (type === 'rental-available') return '대관 가능'
  if (type === 'rental-blocked') return '차단'
  if (type === 'workshop') return '워크샵'
  return '전시'
}

function focusAvailabilityMonth() {
  const firstWindow = sortedRentalWindows.value[0]
  const firstGoogleEvent = googleUsageEvents.value[0]
  const target = firstWindow?.startDate || firstGoogleEvent?.startDate

  if (target) setAvailabilityMonth(target)
}

function setAvailabilityMonth(dateKey) {
  const date = parseDateKey(dateKey)

  currentAvailabilityYear.value = date.getFullYear()
  currentAvailabilityMonth.value = date.getMonth()
}

function prevAvailabilityMonth() {
  const nextDate = new Date(currentAvailabilityYear.value, currentAvailabilityMonth.value - 1, 1)

  currentAvailabilityYear.value = nextDate.getFullYear()
  currentAvailabilityMonth.value = nextDate.getMonth()
}

function nextAvailabilityMonth() {
  const nextDate = new Date(currentAvailabilityYear.value, currentAvailabilityMonth.value + 1, 1)

  currentAvailabilityYear.value = nextDate.getFullYear()
  currentAvailabilityMonth.value = nextDate.getMonth()
}

function goAvailabilityToday() {
  currentAvailabilityYear.value = today.getFullYear()
  currentAvailabilityMonth.value = today.getMonth()
}

function formatDateRange(startDate, endDate) {
  if (!startDate) return ''

  const end = endDate || startDate

  return `${startDate.replaceAll('-', '.')} - ${end.replaceAll('-', '.')}`
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)

  return new Date(year, month - 1, day)
}

function formatDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
</script>

<style scoped>
.admin-rentals-page {
  --line: var(--ddf-line);
  --page-x: var(--ddf-page-x);
  --status-color: #1C1C1C;
  --status-bg: #f4f4f4;
  --status-border: #d8d8d8;

  min-height: 100dvh;
  padding: 60px var(--page-x);
  color: #1C1C1C;
  background: #fff;
}

.admin-rentals-header,
.admin-availability-toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--line);
}

.admin-rentals-header p,
.admin-rentals-header span,
.admin-availability-toolbar p,
.admin-window-editor-head p {
  margin: 0 0 8px;
  font-family: 'D2Coding', monospace;
  font-size: 12px;
  line-height: 1.2;
  color: #666;
}

.admin-rentals-header h1 {
  margin: 0;
  font-size: clamp(42px, 6vw, 88px);
  line-height: 0.95;
  letter-spacing: 0;
}

.admin-availability-toolbar h2,
.admin-window-editor-head h2 {
  margin: 0;
  font-size: 28px;
  line-height: 1.1;
}

.admin-manager-tabs,
.admin-year-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.admin-manager-tabs {
  padding: 22px 0 0;
}

.admin-year-tabs {
  padding: 0 0 20px;
}

.admin-rentals-tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  padding: 22px 0 12px;
}

.admin-rentals-tabs button,
.admin-year-tabs button,
.admin-manager-tabs button,
.admin-refresh-button,
.admin-request-row,
.admin-action-row button,
.admin-action-row a,
.admin-window-row {
  border: 1px solid #d8d8d8;
  color: #1C1C1C;
  background: #fff;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}

.admin-manager-tabs button,
.admin-year-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 700;
}

.admin-manager-tabs button.is-active,
.admin-year-tabs button.is-active {
  border-color: #1C1C1C;
  background: #1C1C1C;
  color: #fff;
}

.admin-year-tabs strong {
  font-family: 'D2Coding', monospace;
  font-size: 11px;
}

.status-new {
  --status-color: #d66b00;
  --status-bg: #fff3e2;
  --status-border: #f1b15c;
}

.status-reviewing {
  --status-color: #1f5fbf;
  --status-bg: #ebf2ff;
  --status-border: #8bb2f0;
}

.status-approved {
  --status-color: #168a4f;
  --status-bg: #e7f6ee;
  --status-border: #76c596;
}

.status-rejected {
  --status-color: #c8372d;
  --status-bg: #fdecea;
  --status-border: #ef9a93;
}

.status-cancelled_by_user,
.status-unknown {
  --status-color: #6b7280;
  --status-bg: #f1f3f5;
  --status-border: #c8ced6;
}

.admin-status-tab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding: 10px;
  border-color: var(--status-border);
  box-shadow: inset 0 -3px 0 var(--status-bg);
}

.admin-status-tab.is-active {
  border-color: var(--status-color);
  background: var(--status-color);
  color: #fff;
  box-shadow: none;
}

.admin-rentals-tabs span {
  font-size: 13px;
  line-height: 1.2;
}

.admin-rentals-tabs strong {
  font-family: 'D2Coding', monospace;
  font-size: 12px;
}

.admin-refresh-button {
  min-height: 34px;
  margin: 0 0 16px;
  padding: 0 12px;
  font-size: 12px;
  line-height: 1;
  font-weight: 700;
}

.admin-refresh-button:hover,
.admin-refresh-button:focus-visible {
  border-color: #1C1C1C;
  background: #1C1C1C;
  color: #fff;
  outline: none;
}

.admin-rentals-notice,
.admin-empty-state {
  margin: 0;
  color: #555;
  font-size: 12px;
  line-height: 1.5;
}

.admin-rentals-notice {
  padding: 0 0 16px;
}

.admin-rentals-layout,
.admin-availability-layout {
  display: grid;
  gap: 18px;
  align-items: start;
}

.admin-rentals-layout {
  grid-template-columns: minmax(280px, 0.78fr) minmax(0, 1.22fr);
}

.admin-availability-layout {
  grid-template-columns: minmax(430px, 1fr) minmax(360px, 0.72fr);
  padding-top: 20px;
}

.admin-request-list,
.admin-window-list {
  display: grid;
  gap: 8px;
}

.admin-request-row,
.admin-window-row {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 12px;
  border-left-width: 4px;
  text-align: left;
}

.admin-request-row {
  border-left-color: var(--status-color);
  background: linear-gradient(90deg, var(--status-bg), #fff 72%);
}

.admin-request-row:hover,
.admin-request-row:focus-visible,
.admin-request-row.is-active {
  border-color: var(--status-color);
  box-shadow: inset 0 0 0 1px var(--status-color);
  outline: none;
}

.admin-window-row.window-available {
  border-left-color: #008c7a;
  background: linear-gradient(90deg, rgba(0, 140, 122, 0.1), #fff 72%);
}

.admin-window-row.window-blocked {
  border-left-color: #6b7280;
  background: linear-gradient(90deg, rgba(107, 114, 128, 0.1), #fff 72%);
}

.admin-window-row.is-active {
  border-color: #1C1C1C;
  box-shadow: inset 0 0 0 1px #1C1C1C;
}

.admin-window-row span {
  font-family: 'D2Coding', monospace;
  font-size: 11px;
  color: #666;
}

.admin-window-row strong {
  font-size: 14px;
  line-height: 1.3;
}

.admin-window-row em {
  font-style: normal;
  font-size: 12px;
  color: #555;
}

.admin-status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  min-height: 22px;
  padding: 0 8px;
  border: 1px solid var(--status-border);
  border-radius: 999px;
  background: var(--status-bg);
  color: var(--status-color);
  font-family: 'D2Coding', monospace;
  font-size: 11px;
  line-height: 1;
  font-weight: 700;
}

.admin-request-row strong {
  font-size: 16px;
  line-height: 1.35;
}

.admin-request-row em {
  font-style: normal;
  font-size: 12px;
  color: #555;
}

.admin-request-detail,
.admin-window-editor {
  display: grid;
  gap: 18px;
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--line);
}

.admin-detail-head {
  display: grid;
  gap: 6px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}

.admin-detail-head h2 {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
}

.admin-detail-head p {
  margin: 0;
  font-size: 14px;
  color: #444;
}

.admin-detail-list {
  display: grid;
  gap: 10px;
  margin: 0;
}

.admin-detail-list div {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 14px;
  padding-top: 10px;
  border-top: 1px solid #e4e4e4;
}

.admin-detail-list dt,
.admin-note span,
.admin-window-form span {
  font-family: 'D2Coding', monospace;
  font-size: 12px;
  color: #666;
}

.admin-detail-list dd {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
}

.notification-state {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.notification-state::before {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: currentColor;
  content: '';
}

.notification-pending {
  color: #d66b00;
}

.notification-sent {
  color: #168a4f;
}

.notification-failed {
  color: #c8372d;
}

.notification-not-applicable {
  color: #737373;
}

.notification-help {
  margin: 3px 0 0;
  font-size: 12px;
  color: #555;
}

.admin-note,
.admin-window-form label {
  display: grid;
  gap: 8px;
}

.admin-note textarea,
.admin-window-form textarea,
.admin-window-form input,
.admin-window-form select {
  width: 100%;
  min-width: 0;
  padding: 10px;
  border: 1px solid #d8d8d8;
  border-radius: 0;
  font: inherit;
  font-size: 13px;
  line-height: 1.45;
  background: #fff;
}

.admin-note textarea,
.admin-window-form textarea {
  resize: vertical;
}

.admin-window-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.admin-window-form-wide,
.admin-window-actions {
  grid-column: 1 / -1;
}

.admin-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.admin-action-row button,
.admin-action-row a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 12px;
  font-size: 12px;
  line-height: 1;
  font-weight: 700;
}

.admin-action-icon {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.2;
}

.admin-action-row .admin-action-button {
  border-color: var(--status-color);
  color: #fff;
  background: var(--status-color);
}

.admin-action-row .admin-action-button:hover,
.admin-action-row .admin-action-button:focus-visible {
  border-color: var(--status-color);
  background: var(--status-color);
  color: #fff;
  filter: brightness(0.92);
  outline: none;
}

.admin-action-row .admin-delete-button {
  border-color: #c8372d;
  background: #c8372d;
  color: #fff;
}

.admin-action-row .admin-delete-button:hover,
.admin-action-row .admin-delete-button:focus-visible {
  border-color: #c8372d;
  background: #c8372d;
  color: #fff;
  filter: brightness(0.92);
  outline: none;
}

.admin-reset-button {
  border-color: #d8d8d8;
  background: #fff;
  color: #1C1C1C;
}

.admin-action-row a:hover,
.admin-action-row a:focus-visible,
.admin-reset-button:hover,
.admin-reset-button:focus-visible {
  border-color: #1C1C1C;
  background: #1C1C1C;
  color: #fff;
  outline: none;
}

.admin-action-row button:disabled {
  cursor: wait;
  opacity: 0.58;
}

.admin-availability-calendar.ddf-calendar {
  height: min(720px, calc(100dvh - 210px));
  min-height: 620px;
}

@media (max-width: 1100px) {
  .admin-availability-layout {
    grid-template-columns: 1fr;
  }

  .admin-availability-calendar.ddf-calendar {
    height: auto;
  }
}

@media (max-width: 900px) {
  .admin-rentals-page {
    padding: 56px 14px 44px;
  }

  .admin-rentals-header,
  .admin-availability-toolbar,
  .admin-rentals-layout {
    grid-template-columns: 1fr;
  }

  .admin-rentals-header,
  .admin-availability-toolbar {
    display: grid;
  }

  .admin-rentals-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-year-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-window-form {
    grid-template-columns: 1fr;
  }
}
</style>
