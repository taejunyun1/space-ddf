 <template>
  <div class="home-wrap">
    <!-- 왼쪽: Location (구글 지도) -->
    <section class="col-left">
      <h3 class="code-block">Location</h3>
      <figure class="map-box">
        <iframe
          class="map-iframe"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3262.2521703589455!2d126.90988227667317!3d35.150331258953756!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x35718dcb0676ea25%3A0xe52a9bee2121a68e!2z7Iqk7Y6Y7J207IqkIOuUlOuUlOyXkO2UhA!5e0!3m2!1sko!2skr!4v1754984708875!5m2!1sko!2skr"
          loading="lazy"
          allowfullscreen
          referrerpolicy="no-referrer-when-downgrade"
          title="스페이스 디디에프 위치 지도"
        ></iframe>
      </figure>
      <div class="place-info">
        <div style="display:flex; justify-content:space-between; flex-wrap: wrap;">
          <div class="place-name">스페이스 디디에프</div>
          <div class="contact">
            <a href="mailto:space.ddf@gmail.com" aria-label="이메일로 문의하기">Space.ddf@gmail.com</a>
          </div>
        </div>
        <div class="addr">광주광역시 동구 충장로46-4 1층 스페이스 디디에프</div>
        <div class="hours">운영시간 11:00~18:00 / 월요일 및 공휴일 휴관</div>
      </div>
    </section>

    <!-- 가운데: Recent Updated (포스터) -->
    <section class="col-center">
      <RecentComponent
        v-if="recent"
        :image-src="recentThumb"
        :title="recent.title"
        :date-range="recent.dateRange"
        :desc="recentMeta"
        :link="recentLink"
        class="recent-card"
      />
      <RecentComponent
        v-else
        :image-src="recentThumb"
        title="준비 중"
        date-range=""
        desc="전시/프로젝트 업데이트를 기다려주세요."
        link="/shows"
        class="recent-card"
      />
    </section>

    <!-- 오른쪽: Project / Show 리스트 -->
    <aside class="col-right">
      <div class="list-section">
        <h3 class="code-block">Project</h3>
        <ul class="item-list">
          <li v-for="p in projects" :key="p.slug">
            <RouterLink class="row row-link" :to="`/projects/${p.slug}`" :aria-label="`${p.title} 상세로 이동`">
              <div class="title">{{ p.title }}</div>
              <div class="date">{{ p.dateRange }}</div>
              <div class="meta">
                {{ Array.isArray(p.credits) ? p.credits.join(', ') : (p.meta || '') }}
              </div>
            </RouterLink>
          </li>
        </ul>
      </div>

      <div class="divider"></div>

      <div class="list-section">
        <h3 class="code-block">Show</h3>
        <ul class="item-list">
          <li v-for="s in shows" :key="s.slug">
            <RouterLink class="row row-link" :to="`/shows/${s.slug}`" :aria-label="`${s.title} 상세로 이동`">
              <div class="title">{{ s.title }}</div>
              <div class="date">{{ s.dateRange }}</div>
              <div class="meta">
                {{ Array.isArray(s.credits) ? s.credits.join(', ') : (s.meta || '') }}
              </div>
            </RouterLink>
          </li>
        </ul>
      </div>
    </aside>
  </div>
</template>


<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useContentStore } from '@/stores/content'
import RecentComponent from '@/components/RecentComponent.vue'

const store = useContentStore()

// ✅ 최신순(내림차순) 게터 사용
const projects = computed(() => store.projectsSortedDesc) // 최신이 위
const shows    = computed(() => store.showsSortedDesc)    // 최신이 위

// 필요하면 상위 N개만:
// const projects = computed(() => store.projectsSortedDesc.slice(0, 20))
// const shows    = computed(() => store.showsSortedDesc.slice(0, 50))

// ✅ Recent는 그대로 (스토어 recent가 최신 1건 반환)
const recent      = computed(() => store.recent)
const recentMeta  = computed(() => store.recentMeta)
const recentThumb = computed(() => store.recentThumb)
const recentLink  = computed(() => store.recentLink)
</script>

<style scoped>
/* ===== 기본 레이아웃 ===== */
.home-wrap {
  --gap: 20px;
  --line: #1C1C1C;
  --muted: #666;
  padding: 24px 20px 60px;
  padding-top: 60px;
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr 0.85fr; /* ⬅︎ 좌/중 동일 비율 */
  grid-template-areas: "left center right"; /* 데스크톱 3열 */
  gap: var(--gap);
}
.col-left   { grid-area: left; }
.col-center { grid-area: center; min-width: 0; }
.col-right  { grid-area: right;  min-width: 0; }

/* 섹션 타이틀 */
.code-block {
  font-family: 'D2Coding', monospace;
  font-size: 18px;
  margin: 0 0 10px;
  font-weight: 700;
}

/* ===== 왼쪽 지도 ===== */
.map-box { border: 1px solid var(--line); }
.map-iframe {
  width: 100%;
  height: 800px;
  max-height: 1200px;
  display: block;
  border: 0;
}
.place-info {
  margin-top: 10px;
  font-size: 13px;
  color: #333;
  display: grid;
  gap: 4px;
}
.place-name { font-weight: 700; }
.contact a { color: inherit; text-decoration: none; }

/* ===== 오른쪽 리스트 ===== */
.col-right { display: flex; flex-direction: column; gap: 16px; }
.item-list { list-style: none; padding: 0; margin: 0; border-top: 1px solid var(--line); }
.item-list > li { margin: 0; padding: 0; }

/* 공통 행 레이아웃 */
.row {
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
  display: grid;
  grid-template-columns: 1fr auto; /* 제목 | 날짜(오른쪽) */
  row-gap: 4px;
}
.row-link {
  display: grid;
  /* grid-template-columns: inherit; */
  row-gap: inherit;
  text-decoration: none;
  color: inherit;
}
.row-link:hover .title { text-decoration: underline; }

/* ===== 공통 타이포그래피 (Recent / Project / Show) ===== */
.title {
  font-weight: 600;
  font-size: 16px;
  line-height: 1.35;
}
.date {
  color: var(--muted);
  font-size: 13px;
  justify-self: end;
  align-self: start;
  margin-left: 5px;
}
.meta {
  grid-column: 1 / 3;
  line-height: 1.45;
  color: #444;
  font-size: 13px;

  /* 🔽 말줄임 설정 */
  white-space: nowrap;       /* 여러 줄 대신 한 줄만 */
  overflow: hidden;          /* 넘치는 텍스트 숨기기 */
  text-overflow: ellipsis;   /* … 표시 */
}

.divider { height: 8px; }


/* ===== 태블릿 이하 (≤1024px) ===== */
@media (max-width: 1024px) {
  .col-right  { order: 3; }
  .col-center { order: 2; }
  .col-left   { order: 1; }

  .home-wrap {
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "left   left"
      "center right";
    gap: 16px;
    padding: 20px 16px 48px;
    padding-top: 60px;
  }

  .code-block { font-size: 14px; }
  .map-iframe { height: 560px; }
  .place-info { font-size: 11px; }

  .title { font-size: 14px; }
  .date,
  .meta { font-size: 11px; }
}

/* ===== 태블릿 중간: ≤768px → 1컬럼 ===== */
@media (max-width: 768px) {
  .home-wrap {
    grid-template-columns: 1fr;
    grid-template-areas:
      "left"
      "center"
      "right";
    gap: 16px;
    padding: 18px 14px 44px;
    padding-top: 56px;
  }

  .map-iframe { height: 420px; }
  .title { font-size: 15px; }
  .date,
  .meta { font-size: 12px; }
}

/* ===== 작은 모바일: 321px ~ 440px ===== */
@media (min-width: 321px) and (max-width: 440px) {
  .home-wrap {
    grid-template-columns: 1fr;
    grid-template-areas:
      "left"
      "center"
      "right";
    gap: 14px;
    padding: 18px 14px 40px;
    padding-top: 56px;
  }

  .map-iframe { height: 360px; }
  .title { font-size: 14px; }
  .date,
  .meta { font-size: 12px; }
}

/* ===== 초소형: ≤320px ===== */
@media (max-width: 320px) {
  .home-wrap {
    grid-template-columns: 1fr;
    grid-template-areas:
      "left"
      "center"
      "right";
    gap: 12px;
    padding: 16px 12px 36px;
    padding-top: 52px;
  }

  .code-block { font-size: 13px; }
  .map-iframe { height: 300px; }
  .place-info { font-size: 10.5px; }

  .title { font-size: 14px; }
  .date,
  .meta { font-size: 11px; }
}
/* ===== 아주 큰 화면(≥1280px): 우측열 최대폭 캡으로 안정화 ===== */
@media (min-width: 1280px) {
  .home-wrap {
    /* 좌/중은 동일하게 계속 커지고, 우측은 최대 28rem까지만 */
    grid-template-columns:
      minmax(340px, 1fr)
      minmax(340px, 1fr)
      minmax(280px, 28rem);
  }
}

</style>