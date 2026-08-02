<template>
  <main class="rental-page" data-build-revision="2026-08-01">
    <header class="rental-header">
      <div>
        <p class="rental-kicker">Space DDF Rental</p>
        <h1>대관 신청</h1>
      </div>

      <p>
        사진, 영상, 설치, 사운드, 출판, 리서치 기반 프로젝트 등 동시대 시각예술을
        중심으로 한 전시와 프로젝트를 기다립니다.
      </p>
    </header>

    <section class="rental-layout" aria-label="Space DDF 대관 신청">
      <div class="rental-calendar-column">
        <section class="rental-guidance" aria-label="대관 운영 안내">
          <h2>대관 가능 일정</h2>
          <p>
            표시된 가능 범위 안에서 시작일과 종료일을 차례로 선택한 뒤 신청 정보를 작성해주세요.
            결제는 대관 승인 후 별도 안내됩니다.
          </p>

          <dl>
            <div>
              <dt>운영 방식</dt>
              <dd>접수 후 공간 검토, 일정 확인, 승인 안내</dd>
            </div>
            <div>
              <dt>지원사업 할인</dt>
              <dd>K-ART, 광주문화재단 등 문화예술 지원사업 준비자는 10% 할인 검토</dd>
            </div>
          </dl>
        </section>

        <CalendarComponent
          booking-variant="none"
          :booking-reset-key="resetSelectionKey"
          :rental-availability-sync="false"
          class="rental-calendar"
          @select-rental-range="setSelectedDateFromCalendar"
        />
      </div>

      <aside class="ddf-rental-application" aria-label="대관 신청서">
        <div class="rental-selection">
          <div class="rental-selection-header">
            <span>선택 기간</span>
            <button
              type="button"
              class="rental-selection-reset"
              :disabled="!selectedDateRange.startDate"
              aria-label="선택 기간 초기화"
              @click="clearSelectedDateRange"
            >
              ↺
            </button>
          </div>
          <strong>{{ selectedRangeLabel }}</strong>
          <small v-if="selectedWindow">{{ selectedWindow.title }}</small>
        </div>

        <div class="rental-availability-list" aria-label="선택 가능 범위">
          <p>선택 가능 범위</p>
          <ul>
            <li
              v-for="window in bookableWindows"
              :key="window.id"
            >
              <span>{{ formatWindowRange(window) }}</span>
              <strong>{{ window.title }}</strong>
            </li>
          </ul>
        </div>

        <form class="rental-form" @submit.prevent="submitRentalApplication">
          <label class="rental-honeypot" aria-hidden="true">
            <span>웹사이트</span>
            <input v-model="form.website" type="text" tabindex="-1" autocomplete="off">
          </label>
          <label>
            <span>희망 일정</span>
            <input :value="selectedRangeLabel" type="text" readonly>
          </label>

          <label>
            <span>신청자/팀명</span>
            <input
              v-model.trim="form.name"
              type="text"
              autocomplete="name"
              maxlength="100"
              placeholder="작가명 또는 팀명"
            >
          </label>

          <label>
            <span>연락처</span>
            <input
              v-model.trim="form.contact"
              type="text"
              autocomplete="email"
              maxlength="200"
              placeholder="이메일 또는 전화번호"
            >
          </label>

          <label>
            <span>지원사업 여부</span>
            <select v-model="form.supportProgram">
              <option value="none">해당 없음</option>
              <option value="k-art">K-ART</option>
              <option value="gwangju-foundation">광주문화재단</option>
              <option value="other">기타 지원사업</option>
            </select>
          </label>

          <label class="rental-form-wide">
            <span>프로젝트 소개</span>
            <textarea
              v-model.trim="form.projectIntro"
              rows="7"
              maxlength="4000"
              placeholder="전시/프로젝트 형식, 참여자, 설치 방식, 필요한 일정 등을 적어주세요."
            ></textarea>
          </label>

          <label class="rental-form-wide rental-privacy-consent">
            <input v-model="form.privacyConsent" type="checkbox">
            <span>대관 검토와 연락을 위한 개인정보 수집·이용에 동의합니다.</span>
          </label>

          <button class="rental-submit" type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? '신청 저장 중' : '대관 신청 접수' }}
          </button>

          <p v-if="notice" class="rental-notice">
            {{ notice }}
          </p>
        </form>
      </aside>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import CalendarComponent from '@/components/CalendarComponent.vue'
import { useCalendarStore } from '@/stores/calendar'
import { fetchRentalAvailability, submitRentalRequest } from '@/services/rentals'

const calendarStore = useCalendarStore()
const bookableWindows = computed(() => calendarStore.bookableWindows)
const selectedWindow = ref(null)
const notice = ref('')
const isSubmitting = ref(false)
const resetSelectionKey = ref(0)
const selectedDateRange = reactive({
  startDate: '',
  endDate: '',
  windowId: '',
})
const form = reactive({
  name: '',
  contact: '',
  supportProgram: 'none',
  projectIntro: '',
  privacyConsent: false,
  website: '',
})
const PRIVACY_POLICY_VERSION = '2026-07-11'
let idempotencyKey = crypto.randomUUID()

const selectedRangeLabel = computed(() => (
  selectedDateRange.startDate && selectedDateRange.endDate
    ? formatWindowRange(selectedDateRange)
    : '캘린더에서 시작일과 종료일을 선택해주세요'
))

onMounted(loadRentalAvailability)

async function loadRentalAvailability() {
  try {
    const availability = await fetchRentalAvailability()

    calendarStore.setRentalAvailability(availability)

    if (selectedDateRange.windowId && !bookableWindows.value.some(window => window.id === selectedDateRange.windowId)) {
      clearSelectedDateRange()
    }
  } catch {
    notice.value = '대관 가능 일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
  }
}

function setSelectedDateFromCalendar(selection) {
  selectedWindow.value = selection.window || bookableWindows.value.find(window => window.id === selection.windowId) || null
  selectedDateRange.startDate = selection.startDate
  selectedDateRange.endDate = selection.endDate
  selectedDateRange.windowId = selection.windowId
  notice.value = ''
}

function clearSelectedDateRange() {
  selectedWindow.value = null
  selectedDateRange.startDate = ''
  selectedDateRange.endDate = ''
  selectedDateRange.windowId = ''
  resetSelectionKey.value += 1
}

function formatWindowRange(window) {
  return `${formatKoreanDate(window.startDate)} - ${formatKoreanDate(window.endDate || window.startDate)}`
}

function formatKoreanDate(dateKey) {
  const [year, month, day] = dateKey.split('-')

  return `${year}.${month}.${day}`
}

async function submitRentalApplication() {
  if (!selectedDateRange.startDate || !selectedDateRange.endDate) {
    notice.value = '캘린더에서 희망 시작일과 종료일을 선택해주세요.'
    return
  }

  if (!form.name || !form.contact || !form.projectIntro) {
    notice.value = '신청자/팀명, 연락처, 프로젝트 소개를 입력해주세요.'
    return
  }

  if (!form.privacyConsent) {
    notice.value = '개인정보 수집·이용에 동의해주세요.'
    return
  }

  isSubmitting.value = true

  try {
    await submitRentalRequest({
      applicantName: form.name,
      contact: form.contact,
      requestedStartDate: selectedDateRange.startDate,
      requestedEndDate: selectedDateRange.endDate,
      supportProgram: form.supportProgram,
      projectDescription: form.projectIntro,
      privacyConsent: form.privacyConsent,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      idempotencyKey,
      website: form.website,
    })

    notice.value = '신청이 접수되었습니다. Space DDF에서 검토 후 연락드립니다.'
    form.name = ''
    form.contact = ''
    form.supportProgram = 'none'
    form.projectIntro = ''
    form.privacyConsent = false
    form.website = ''
    idempotencyKey = crypto.randomUUID()
    clearSelectedDateRange()
    await loadRentalAvailability()
  } catch (error) {
    notice.value = error.message || '신청을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.rental-page {
  --line: var(--ddf-line);
  --page-x: var(--ddf-page-x);

  width: 100%;
  min-height: 100dvh;
  padding: 48px var(--page-x);
  color: #1C1C1C;
  background: #fff;
}

.rental-header {
  display: grid;
  grid-template-columns: minmax(0, 0.7fr) minmax(280px, 1fr);
  gap: 24px;
  align-items: end;

  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}

.rental-kicker {
  margin: 0 0 10px;
  font-family: 'D2Coding', monospace;
  font-size: 13px;
  line-height: 1.2;
  color: #666;
}

.rental-header h1 {
  margin: 0;
  font-size: 28px;
  line-height: 1.16;
  font-weight: 700;
  letter-spacing: 0;
}

.rental-header p {
  margin: 0;
  max-width: 520px;
  font-size: 13px;
  line-height: 1.6;
  word-break: keep-all;
}

.rental-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(340px, 0.92fr);
  gap: 24px;
  align-items: start;

  padding-top: 24px;
}

.rental-calendar-column {
  min-width: 0;
}

.rental-guidance {
  display: grid;
  grid-template-columns: minmax(0, 0.72fr) minmax(0, 1fr);
  gap: 20px;

  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}

.rental-guidance h2 {
  margin: 0;
  font-size: 18px;
  line-height: 1.25;
}

.rental-guidance p {
  margin: 0;
  color: #444;
  font-size: 13px;
  line-height: 1.6;
}

.rental-guidance dl {
  grid-column: 1 / 3;
  display: grid;
  gap: 8px;
  margin: 0;
}

.rental-guidance dl > div {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 16px;
  padding-top: 8px;
  border-top: 1px solid #e2e2e2;
}

.rental-guidance dt {
  font-family: 'D2Coding', monospace;
  font-size: 12px;
  line-height: 1.35;
  color: #666;
}

.rental-guidance dd {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #333;
}

.rental-calendar {
  margin-top: 18px;
  min-height: 560px;
}

.ddf-rental-application {
  position: sticky;
  top: 24px;

  display: grid;
  gap: 16px;

  min-width: 0;
  padding: 18px;

  border: 1px solid var(--line);
  background: #fff;
}

.rental-selection {
  display: grid;
  gap: 6px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}

.rental-selection-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.rental-selection span {
  font-family: 'D2Coding', monospace;
  font-size: 12px;
  line-height: 1.2;
  color: #666;
}

.rental-selection-reset {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #1C1C1C;
  border-radius: 999px;
  color: #1C1C1C;
  background: #fff;
  font: inherit;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.rental-selection-reset:hover,
.rental-selection-reset:focus-visible {
  color: #fff;
  background: #1C1C1C;
  outline: none;
}

.rental-selection-reset:disabled {
  cursor: not-allowed;
  opacity: 0.32;
}

.rental-selection strong {
  font-size: 18px;
  line-height: 1.25;
  font-weight: 700;
}

.rental-selection small {
  font-family: 'D2Coding', monospace;
  font-size: 11px;
  line-height: 1.35;
  color: #666;
}

.rental-availability-list {
  display: grid;
  gap: 8px;
}

.rental-availability-list p {
  margin: 0;
  font-family: 'D2Coding', monospace;
  font-size: 12px;
  line-height: 1.2;
  color: #666;
}

.rental-availability-list ul {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid #e2e2e2;
}

.rental-availability-list li {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #e2e2e2;
}

.rental-availability-list span {
  font-family: 'D2Coding', monospace;
  font-size: 11px;
  line-height: 1.35;
  color: #666;
}

.rental-availability-list strong {
  font-size: 12px;
  line-height: 1.35;
  font-weight: 700;
}

.rental-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.rental-form label {
  display: grid;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  line-height: 1.2;
  color: #555;
}

.rental-form label span {
  font-weight: 700;
}

.rental-honeypot {
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.rental-privacy-consent {
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: start;
}

.rental-privacy-consent input {
  width: 16px;
  height: 16px;
  margin: 0;
  padding: 0;
}

.rental-form input,
.rental-form select,
.rental-form textarea {
  width: 100%;
  min-width: 0;
  padding: 10px;
  border: 1px solid #d8d8d8;
  border-radius: 0;
  color: #1C1C1C;
  background: #fff;
  font: inherit;
  font-size: 13px;
  line-height: 1.35;
}

.rental-form input:focus,
.rental-form select:focus,
.rental-form textarea:focus {
  border-color: #1C1C1C;
  outline: none;
}

.rental-form input[readonly] {
  background: #f7f7f7;
}

.rental-form textarea {
  resize: vertical;
}

.rental-form-wide,
.rental-submit,
.rental-notice {
  grid-column: 1 / 3;
}

.rental-submit {
  min-height: 42px;
  border: 1px solid #1C1C1C;
  color: #fff;
  background: #1C1C1C;
  font: inherit;
  font-size: 13px;
  line-height: 1;
  font-weight: 700;
  cursor: pointer;
}

.rental-submit:hover,
.rental-submit:focus-visible {
  color: #1C1C1C;
  background: #fff;
  outline: none;
}

.rental-submit:disabled {
  cursor: wait;
  opacity: 0.58;
}

.rental-notice {
  margin: 0;
  color: #444;
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 900px) {
  .rental-page {
    padding: 56px 14px 44px;
  }

  .rental-header,
  .rental-layout,
  .rental-guidance {
    grid-template-columns: 1fr;
  }

  .rental-header {
    gap: 16px;
  }

  .rental-header p {
    font-size: 14px;
  }

  .rental-guidance dl {
    grid-column: 1 / 2;
  }

  .ddf-rental-application {
    position: static;
  }

  .rental-availability-list li,
  .rental-form {
    grid-template-columns: 1fr;
  }

  .rental-form-wide,
  .rental-submit,
  .rental-notice {
    grid-column: 1 / 2;
  }
}
</style>
