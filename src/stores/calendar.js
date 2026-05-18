import { defineStore } from 'pinia'

export const useCalendarStore = defineStore('calendar', {
  state: () => ({
    events: [
      {
        id: 'exhibition-2026-08-03-gb-talk',
        startDate: '2026-08-10',
        endDate: '2026-08-25',
        type: 'exhibition',
        label: '전시',
        title: '광주비엔날레 GB토크 윤태준 작가',
      },
      {
        id: 'rental-2026-08-30-latvia-pavilion',
        startDate: '2026-08-30',
        endDate: '2026-11-20',
        type: 'rental',
        label: '대관',
        title: '광주비엔날레 라트비아 파빌리온',
      },
        {
        id: 'show-kimsohee-2026-winter',
        startDate: '2026-11-28',
        endDate: '2026-12-12',
        type: 'rental',
        label: '대관',
        title: '김소희 작가',
      },
    ],
  }),

  getters: {
    eventsByDate: (state) => {
      const map = {}

      state.events.forEach((event) => {
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
      })

      return map
    },
  },
})

function formatDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}