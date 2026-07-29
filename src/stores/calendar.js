import { defineStore } from 'pinia'

export const useCalendarStore = defineStore('calendar', {
  state: () => ({
    events: [],
    rentalAvailability: [],
    googleCalendarEvents: [],
    rentalBlocks: [],
  }),

  getters: {
    bookableWindows: (state) => (
      state.rentalAvailability.filter(window => window.status === 'available')
    ),

    calendarEvents: (state) => [
      ...state.events,
      ...state.googleCalendarEvents,
      ...state.rentalBlocks,
      ...state.rentalAvailability,
    ],

    eventsByDate: (state) => {
      const map = {}

      ;[
        ...state.events,
        ...state.googleCalendarEvents,
        ...state.rentalBlocks,
        ...state.rentalAvailability,
      ].forEach((event) => {
        addEventToDateMap(map, event)
      })

      return map
    },
  },

  actions: {
    setRentalAvailability({ windows = [], unavailable = [] } = {}) {
      if (Array.isArray(windows)) {
        this.rentalAvailability = windows.map(normalizeRentalWindow)
      }

      this.rentalBlocks = Array.isArray(unavailable)
        ? unavailable.map(normalizeRentalBlock)
        : []
    },

    setGoogleCalendarEvents(events = []) {
      this.googleCalendarEvents = Array.isArray(events)
        ? events.map(normalizeGoogleCalendarEvent)
        : []
    },
  },
})

function normalizeRentalWindow(window) {
  return {
    id: window.id || `rental-window-${window.startDate}-${window.endDate || window.startDate}-${window.status || 'available'}`,
    startDate: window.startDate,
    endDate: window.endDate || window.startDate,
    type: window.type || 'rental-available',
    label: window.label || '대관 가능',
    title: window.title || window.label || '대관 가능 일정',
    status: window.status || 'available',
    publicDescription: window.publicDescription || '',
  }
}

function normalizeRentalBlock(block) {
  const status = block.status || 'reviewing'
  const type = block.type || (isRequestedRentalStatus(status) ? 'rental-requested' : 'rental')
  const label = block.label || labelForType(type)

  return {
    id: block.id || `rental-block-${block.startDate}-${block.endDate || block.startDate}-${status}`,
    startDate: block.startDate,
    endDate: block.endDate || block.startDate,
    type,
    label,
    title: block.title || label,
    status,
  }
}

function normalizeGoogleCalendarEvent(event) {
  return {
    id: event.id,
    startDate: event.startDate,
    endDate: event.endDate || event.startDate,
    type: event.type || 'exhibition',
    label: event.label || labelForType(event.type),
    title: event.title || 'Google Calendar 일정',
    status: event.status || 'confirmed',
    source: event.source || 'google-calendar',
  }
}

function labelForType(type) {
  if (type === 'rental') return '예약확정'
  if (type === 'rental-requested') return '예약신청'
  if (type === 'rental-available') return '대관 가능'
  if (type === 'rental-blocked') return '차단'
  if (type === 'workshop') return '워크샵'
  return '전시'
}

function isRequestedRentalStatus(status) {
  return status === 'new' || status === 'reviewing'
}

function addEventToDateMap(map, event) {
  const start = new Date(event.startDate)
  const end = new Date(event.endDate || event.startDate)

  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

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

function formatDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
