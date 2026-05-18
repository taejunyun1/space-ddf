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
          },
          ...day.rangeClasses
        ]"
        :aria-label="dayAriaLabel(day)"
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
        <span>대관</span>
      </div>
    </footer>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import '@/assets/styles/calendar.css'

const calendarStore = useCalendarStore()

const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const today = new Date()
today.setHours(0, 0, 0, 0)

const currentYear = ref(today.getFullYear())
const currentMonth = ref(today.getMonth())

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

    return {
      key: dateKey,
      date: date.getDate(),
      currentMonth: isCurrentMonth,
      today: isToday,
      closed: isCurrentMonth && isMonday,
      events,
      rangeClasses: makeRangeClasses(events),
    }
  })
})

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

  return `${day.date}일, ${eventText}`
}
</script>