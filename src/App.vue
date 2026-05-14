<template>
  <div id="app" class="layout">
    <router-link to="/home" class="home-btn">
      <img src="@/assets/logo.png" alt="Space DDF" />
    </router-link>

    <button
      class="hamburger"
      type="button"
      aria-label="Open sidebar"
      :aria-expanded="isAsideOpen ? 'true' : 'false'"
      aria-controls="app-aside"
      @click="toggleAside"
    >
<span class="bar"></span>
<span class="bar"></span>
<span class="bar"></span>

    </button>

    <div v-if="isAsideOpen" class="backdrop" @click="closeAside"></div>

    <aside
      id="app-aside"
      class="section-left"
      :class="{ open: isAsideOpen }"
      @keydown.esc="closeAside"
      tabindex="-1"
    >
      <section class="upcoming-wrap" aria-label="다가오는 전시">
        <h3 class="side-title">Upcoming</h3>

        <article
          v-for="item in upcomingItems"
          :key="item.title"
          class="upcoming-item"
        >
          <div class="upcoming-title">{{ item.title }}</div>
          <div class="upcoming-line">{{ item.artist }}</div>
          <div class="upcoming-line">{{ item.curator }}</div>
          <div class="upcoming-period">{{ item.period }}</div>
        </article>
      </section>

      <div class="intro-wrap" role="region" aria-label="소개글">
        <p class="intro-kr">
          광주 충장로에 위치한 스페이스 DDF는 2021년부터 지역 예술 생태계의 핵심 거점 역할을 해온 대안 예술 공간입니다. 전시, 워크숍, 프로젝트를 통해 동시대 사진과 이미지 기반 작업을 중심으로 다양한 작가와 기획자들의 실험적 실천과 교류를 지원하고 있습니다.
        </p>
        <p class="intro-en">
          Space DDF, located in Chungjang-ro, Gwangju, is an alternative art space that has served as a key hub for the local art ecosystem since 2021. Through exhibitions, workshops, and projects, it supports experimental practices and exchanges centered on contemporary photography and image-based works by a wide range of artists and curators.
        </p>
      </div>

      <div class="left-body"></div>

      <div class="footer-wrap">
        <div class="intro-en">
          <a href="https://www.instagram.com/space.ddf" target="_blank" rel="noopener">
            @space_ddf
          </a>
        </div>
        <div class="intro-en">
          <a href="mailto:space.ddf@gmail.com">space.ddf@gmail.com</a>
        </div>
        <span>COPYRIGHT©2025 Space DDF</span>
      </div>
    </aside>

    <main class="main-content" @click="closeAside">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const isAsideOpen = ref(false)

const upcomingItems = ref([
  {
    title: '지역작가 GB토크',
    artist: '윤태준 작가  / 광주비엔날레',
    curator: '스페이스 디디에프',
    period: '2026.8.10 — 2026.08.28',
  },{
    title: '광주비엔날레 라트비아 파빌리온',
    artist: '라트비아 파빌리온',
    curator: '광주비엔날레',
    period: '2026.08.30 — 2026.11.20',
  },
  
])

const toggleAside = () => {
  isAsideOpen.value = !isAsideOpen.value
}

const closeAside = () => {
  isAsideOpen.value = false
}

const onKeydown = (e) => {
  if (e.key === 'Escape') closeAside()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  min-height: 100vh;
  position: relative;
}

/* Home 버튼 */
.home-btn {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 100;

  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.home-btn img {
  width: 40px;
  height: auto;
}

/* 좌측 섹션 */
.section-left {
  display: flex;
  flex-direction: column;

  padding: 20px;
  padding-top: 60px;

  border-right: 1px solid #1C1C1C;
  min-height: 100dvh;
  box-sizing: border-box;

  background: #fff;
  z-index: 20;

  overflow-y: auto;
  overscroll-behavior: contain;
}

/* Upcoming */
.upcoming-wrap {
  margin-top: 0;
  padding-top: 0;
  padding-bottom: 14px;

  border-bottom: 1px solid #1C1C1C;
}

.side-title {
  margin: 0 0 10px;

  font-family: 'D2Coding', monospace;
  font-size: 14px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.upcoming-item {
  padding: 10px 0;
  border-top: 1px solid #e5e5e5;
}

.upcoming-title {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;

  word-break: keep-all;
  overflow-wrap: break-word;
}

.upcoming-line,
.upcoming-period {
  margin-top: 4px;

  font-size: 12px;
  line-height: 1.45;
  color: #444;

  word-break: keep-all;
  overflow-wrap: break-word;
}

.upcoming-period {
  color: #666;
}

/* 소개글 */
.intro-wrap {
  position: static;
  background: #fff;
  padding-top: 16px;
  padding-bottom: 12px;
  border-bottom: none;
}

.left-body {
  padding: 12px 0;
  flex: 1 1 auto;
}

.intro-kr,
.intro-en {
  font-size: 14px;
  line-height: 1.6;
  margin: 8px 0;
}

.intro-en a {
  color: inherit;
  text-decoration: none;
}

.intro-en a:hover {
  text-decoration: underline;
}

/* 푸터 */
.footer-wrap {
  position: sticky;
  bottom: 0;

  background: #fff;

  padding-top: 12px;
  padding-bottom: 8px;

  border-top: 1px solid #1C1C1C;
}

.footer-wrap span {
  display: block;
  margin-top: 8px;

  font-size: 11px;
  line-height: 1.4;
  color: #666;
}

/* 우측 컨텐츠 */
.main-content {
  min-width: 0;
}

/* 모바일 햄버거 */
.hamburger {
  display: none;

  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 35;

  width: 30px;

  border: 1px solid #1C1C1C;
  background: #fff;
  border-radius: 8px;

  padding: 6px;
  box-sizing: border-box;
}

.hamburger .bar {
  display: block;
  height: 2px;
  margin: 3px 0;
  background: #222;
  width: 100%;
}

/* 모바일 백드롭 */
.backdrop {
  display: none;
}

/* 반응형 */
@media (max-width: 1024px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .hamburger {
    display: inline-flex;
    flex-direction: column;
    justify-content: center;
  }

  .backdrop {
    display: block;

    position: fixed;
    inset: 0;

    background: rgba(0, 0, 0, 0.32);
    z-index: 15;

    backdrop-filter: blur(1px);
  }

  .section-left {
    position: fixed;
    top: 0;
    left: 0;

    width: 80vw;
    max-width: 320px;
    height: 100dvh;

    transform: translateX(-100%);
    transition: transform 220ms ease-out;

    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);

    padding: 16px;
    padding-top: 60px;
  }

  .section-left.open {
    transform: translateX(0);
  }

  .home-btn img {
    width: 40px;
  }
}
</style>