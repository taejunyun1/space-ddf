<template>
  <section class="ddf-calendar" aria-label="Space DDF calendar">
    <header class="ddf-calendar-header">
      <div class="ddf-calendar-heading">
        <p class="ddf-calendar-eyebrow">Calendar</p>
        <h2>{{ monthLabel }}</h2>
      </div>

      <div class="ddf-calendar-control">
        <button
          type="button"
          aria-label="오늘로 이동"
          class="today-btn"
          @click="goToday"
        >
          Today
        </button>

        <button type="button" aria-label="이전 달" @click="prevMonth">
          ‹
        </button>

        <button type="button" aria-label="다음 달" @click="nextMonth">
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
        v-for="day in calendarDays"
        :key="day.key"
        type="button"
        class="ddf-calendar-day"
        :class="[
          {
            'is-muted': !day.currentMonth,
            'is-today': day.today,
            'is-closed': day.closed,
            'has-event': day.events.length,
            'is-bookable': day.bookableEvents.length,
            'is-rental-blocked': day.rentalBlocked,
            'is-selected-booking-window': isSelectedBookingDay(day.key),
            'is-selected-booking-range': isSelectedBookingDay(day.key),
          },
          ...day.rangeClasses
        ]"
        :aria-label="dayAriaLabel(day)"
        :aria-disabled="day.rentalBlocked ? 'true' : 'false'"
        :aria-pressed="isSelectedBookingDay(day.key) ? 'true' : 'false'"
        @click="selectDay(day)"
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

        <span v-else-if="day.closed" class="ddf-calendar-closed"></span>

        <span v-if="day.events.length" class="ddf-calendar-tooltip">
          <span
            v-for="event in uniqueEvents(day.events)"
            :key="event.id"
            class="tooltip-row"
          >
            <strong>{{ event.label }}</strong>
            {{ event.title }}
            <em>
              {{ event.startDate }} — {{ event.endDate || event.startDate }}
            </em>
          </span>
        </span>
      </button>
    </div>

    <footer class="ddf-calendar-footer">
      <div class="ddf-calendar-legend">
        <span class="ddf-calendar-legend-dot type-exhibition"></span>
        <span>전시</span>
      </div>

      <div class="ddf-calendar-legend">
        <span class="ddf-calendar-legend-dot type-workshop"></span>
        <span>워크샵</span>
      </div>

      <div class="ddf-calendar-legend">
        <span class="ddf-calendar-legend-dot type-rental"></span>
        <span>예약 확정</span>
      </div>

      <div class="ddf-calendar-legend">
        <span class="ddf-calendar-legend-dot type-rental-requested"></span>
        <span>예약신청</span>
      </div>

      <div class="ddf-calendar-legend">
        <span class="ddf-calendar-legend-dot type-rental-available"></span>
        <span>대관 가능</span>
      </div>

      <div class="ddf-calendar-legend">
        <span class="ddf-calendar-legend-dot type-rental-blocked"></span>
        <span>차단</span>
      </div>
    </footer>

    <section
      v-if="props.bookingVariant === 'summary'"
      class="ddf-booking-summary"
      aria-label="Space DDF 대관 신청 요약"
    >
      <div class="ddf-booking-summary-copy">
        <p class="ddf-booking-eyebrow">Rental Booking</p>
        <h3>대관 가능 일정</h3>
        <p>선택한 일정의 신청은 전용 페이지에서 이어집니다.</p>
      </div>

      <div class="ddf-booking-summary-window">
        <span>{{ selectedWindowLabel }}</span>
        <strong>{{ selectedWindow?.title || '대관 가능 일정 선택' }}</strong>
      </div>

      <RouterLink class="ddf-booking-summary-link" to="/rental">
        대관 신청
      </RouterLink>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useCalendarStore } from '@/stores/calendar'
import { fetchGoogleCalendarEvents } from '@/services/calendar-sync'
import { fetchRentalAvailability } from '@/services/rentals'
import '@/assets/styles/calendar.css'

const calendarStore = useCalendarStore()
const props = defineProps({
  bookingVariant: {
    type: String,
    default: 'summary',
  },
  bookingResetKey: {
    type: Number,
    default: 0,
  },
  googleCalendarSync: {
    type: Boolean,
    default: true,
  },
  rentalAvailabilitySync: {
    type: Boolean,
    default: true,
  },
})
const emit = defineEmits(['select-rental-window', 'select-rental-range'])

const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const today = new Date()
today.setHours(0, 0, 0, 0)

const bookableWindows = computed(() => calendarStore.bookableWindows)
const selectedWindow = ref(bookableWindows.value[0] || null)
const selectedBookingRange = ref(null)
const initialCalendarDate = selectedWindow.value
  ? parseDateKey(selectedWindow.value.startDate)
  : today

const currentYear = ref(initialCalendarDate.getFullYear())
const currentMonth = ref(initialCalendarDate.getMonth())

onMounted(() => {
  loadGoogleCalendarEvents()
  loadRentalAvailability()
})

watch(() => props.bookingResetKey, resetSelectedBookingRange)
watch(bookableWindows, (windows) => {
  if (selectedBookingRange.value) return

  const keepsSelectedWindow = selectedWindow.value
    && windows.some(window => window.id === selectedWindow.value.id)

  if (!keepsSelectedWindow) {
    selectedWindow.value = props.bookingVariant === 'summary'
      ? windows[0] || null
      : null
  }
})

const monthLabel = computed(() => {
  const date = new Date(currentYear.value, currentMonth.value, 1)

  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
})

const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value

  const firstDay = new Date(year, month, 1)
  const startDay = firstDay.getDay()
  const startDate = new Date(year, month, 1 - startDay)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + index)
    date.setHours(0, 0, 0, 0)

    const dateKey = formatDateKey(date)
    const isCurrentMonth = date.getMonth() === month
    const isToday = date.getTime() === today.getTime()
    const isMonday = date.getDay() === 1
    const events = calendarStore.eventsByDate[dateKey] || []
    const rentalBlocked = isBlockedRentalDay(events)
    const bookableEvents = rentalBlocked ? [] : events.filter(isBookableEvent)

    return {
      key: dateKey,
      date: date.getDate(),
      currentMonth: isCurrentMonth,
      today: isToday,
      closed: isCurrentMonth && isMonday,
      events,
      bookableEvents,
      rentalBlocked,
      rangeClasses: makeRangeClasses(events),
    }
  })
})

const selectedWindowLabel = computed(() => (
  selectedBookingRange.value
    ? formatWindowRange(selectedBookingRange.value)
    : selectedWindow.value
      ? formatWindowRange(selectedWindow.value)
      : '선택된 일정 없음'
))

function makeRangeClasses(events) {
  const classes = []

  events.forEach((event) => {
    classes.push(`range-${event.type}`)

    if (event.isRangeStart) {
      classes.push(`range-start-${event.type}`)
    }

    if (event.isRangeEnd) {
      classes.push(`range-end-${event.type}`)
    }
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

function formatDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)

  return new Date(year, month - 1, day)
}

function isBookableEvent(event) {
  return event.type === 'rental-available' && event.status === 'available'
}

function isBlockedRentalDay(events) {
  return events.some(isRentalBlockEvent)
}

function isRentalBlockEvent(event) {
  return ['rental', 'rental-requested', 'rental-blocked'].includes(event.type)
    && !['cancelled_by_user', 'rejected'].includes(event.status)
}

function isWithinWindow(dateKey, window) {
  if (!window) return false

  return dateKey >= window.startDate && dateKey <= (window.endDate || window.startDate)
}

function isSelectedBookingDay(dateKey) {
  return isWithinWindow(dateKey, selectedBookingRange.value)
}

function selectDay(day) {
  if (!day.bookableEvents.length) return

  selectRentalDay(day)
}

function selectRentalDay(day) {
  const window = day.bookableEvents[0]
  const currentRange = selectedBookingRange.value
  const shouldStartNewRange = !currentRange
    || currentRange.windowId !== window.id
    || currentRange.startDate !== currentRange.endDate
    || day.key < currentRange.startDate

  const nextRange = shouldStartNewRange
    ? makeSelectedBookingRange(day.key, day.key, window)
    : makeSelectedBookingRange(currentRange.startDate, day.key, window)

  if (!isRangeFullyBookable(nextRange.startDate, nextRange.endDate, window)) {
    selectWindow(window, makeSelectedBookingRange(day.key, day.key, window))
    return
  }

  selectWindow(window, nextRange)
}

function selectWindow(window, range = makeSelectedBookingRange(window.startDate, window.startDate, window)) {
  selectedWindow.value = window
  selectedBookingRange.value = range

  emit('select-rental-window', window)
  emit('select-rental-range', {
    ...range,
    window,
  })

  const start = parseDateKey(window.startDate)

  currentYear.value = start.getFullYear()
  currentMonth.value = start.getMonth()
}

function resetSelectedBookingRange() {
  selectedBookingRange.value = null
  selectedWindow.value = props.bookingVariant === 'summary'
    ? bookableWindows.value[0] || null
    : null
}

async function loadGoogleCalendarEvents() {
  if (!props.googleCalendarSync) return

  try {
    const events = await fetchGoogleCalendarEvents()

    calendarStore.setGoogleCalendarEvents(events)
  } catch {
    calendarStore.setGoogleCalendarEvents([])
  }
}

async function loadRentalAvailability() {
  if (!props.rentalAvailabilitySync) return

  try {
    const availability = await fetchRentalAvailability()

    calendarStore.setRentalAvailability(availability)
  } catch {
    // The rental page owns user-facing API errors. The home calendar stays empty if the API is unavailable.
  }
}

function makeSelectedBookingRange(startDate, endDate, window) {
  return {
    startDate,
    endDate,
    windowId: window.id,
  }
}

function isRangeFullyBookable(startDate, endDate, window) {
  if (!isWithinWindow(startDate, window) || !isWithinWindow(endDate, window)) return false

  const cursor = parseDateKey(startDate)
  const end = parseDateKey(endDate)

  while (cursor <= end) {
    const dateKey = formatDateKey(cursor)
    const events = calendarStore.eventsByDate[dateKey] || []

    if (!isWithinWindow(dateKey, window) || isBlockedRentalDay(events)) {
      return false
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return true
}

function formatWindowRange(window) {
  return `${formatKoreanDate(window.startDate)} - ${formatKoreanDate(window.endDate || window.startDate)}`
}

function formatKoreanDate(dateKey) {
  const [year, month, day] = dateKey.split('-')

  return `${year}.${month}.${day}`
}

function prevMonth() {
  const nextDate = new Date(currentYear.value, currentMonth.value - 1, 1)

  currentYear.value = nextDate.getFullYear()
  currentMonth.value = nextDate.getMonth()
}

function nextMonth() {
  const nextDate = new Date(currentYear.value, currentMonth.value + 1, 1)

  currentYear.value = nextDate.getFullYear()
  currentMonth.value = nextDate.getMonth()
}

function goToday() {
  currentYear.value = today.getFullYear()
  currentMonth.value = today.getMonth()
}

function dayAriaLabel(day) {
  if (!day.events.length) return `${day.date}일`

  const eventText = uniqueEvents(day.events)
    .map(event => `${event.label}: ${event.title}`)
    .join(', ')

  const rentalState = day.rentalBlocked
    ? ', 대관 선택 불가'
    : day.bookableEvents.length
      ? ', 대관 선택 가능'
      : ''

  return `${day.date}일, ${eventText}${rentalState}`
}
</script>
