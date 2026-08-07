<template>
  <div id="app" class="layout">
    <header class="archive-site-header">
    <router-link to="/home" class="home-btn">
      <img
        src="@/assets/logo.png"
        alt="Space DDF"
        width="2363"
        height="2363"
        decoding="async"
      />
    </router-link>

    <button
      ref="menuButtonRef"
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
      <nav class="archive-site-nav" aria-label="콘텐츠 바로가기">
        <router-link to="/home#show">Show</router-link>
        <router-link to="/home#project">Project</router-link>
        <router-link to="/archive-map">Archive</router-link>
        <button type="button" class="archive-about-trigger" @click="toggleAside">About</button>
        <router-link to="/rental">Rental</router-link>
      </nav>
    </header>

    <div v-if="isAsideOpen" class="backdrop" @click="closeAside"></div>

    <aside
      id="app-aside"
      ref="asideRef"
      class="section-left"
      :class="{ open: isAsideOpen }"
      :inert="isAsideOpen ? undefined : ''"
      :aria-hidden="isAsideOpen ? 'false' : 'true'"
      @keydown.esc="closeAside"
      tabindex="-1"
    >
      <div class="intro-wrap" role="region" aria-label="소개글">
        <p class="intro-kr">
          광주 충장로에 위치한 스페이스 DDF는 2021년부터 지역 예술 생태계의 핵심 거점 역할을 해온 대안 예술 공간입니다. 전시, 워크숍, 프로젝트를 통해 동시대 사진과 이미지 기반 작업을 중심으로 다양한 작가와 기획자들의 실험적 실천과 교류를 지원하고 있습니다.
        </p>
        <p class="intro-en">
          Space DDF, located in Chungjang-ro, Gwangju, is an alternative art space that has served as a key hub for the local art ecosystem since 2021. Through exhibitions, workshops, and projects, it supports experimental practices and exchanges centered on contemporary photography and image-based works by a wide range of artists and curators.
        </p>
      </div>

      <nav class="side-nav" aria-label="주요 페이지">
        <router-link to="/archive-map" class="side-nav-link" @click="closeAside">
          <span>Regional Archive</span>
          <strong>📍전시 지도📍</strong>
        </router-link>
        <router-link to="/rental" class="side-nav-link" @click="closeAside">
          <span>Space Rental</span>
          <strong>대관 신청</strong>
        </router-link>
      </nav>

      <section class="location-wrap" aria-label="공간 위치">
        <h3 class="side-title">Location</h3>

        <figure v-if="showSidebarMap" class="side-map-box">
          <iframe
            class="side-map"
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3262.2521703589455!2d126.90988227667317!3d35.150331258953756!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x35718dcb0676ea25%3A0xe52a9bee2121a68e!2z7Iqk7Y6Y7J207IqkIOuUlOuUlOyXkO2UhA!5e0!3m2!1sko!2skr!4v1754984708875!5m2!1sko!2skr"
            loading="lazy"
            allowfullscreen
            referrerpolicy="strict-origin-when-cross-origin"
            title="스페이스 디디에프 위치 지도"
          ></iframe>
        </figure>

        <div class="location-info">
          <div class="location-name">스페이스 디디에프</div>
          <div class="location-line">광주광역시 동구 충장로46번길 8-8 1층</div>
          <a
            class="location-link"
            href="https://www.google.com/maps/search/?api=1&query=%EC%8A%A4%ED%8E%98%EC%9D%B4%EC%8A%A4%20%EB%94%94%EB%94%94%EC%97%90%ED%94%84%2C%20%EA%B4%91%EC%A3%BC%EA%B4%91%EC%97%AD%EC%8B%9C%20%EB%8F%99%EA%B5%AC%20%EC%B6%A9%EC%9E%A5%EB%A1%9C46%EB%B2%88%EA%B8%B8%208-8"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Maps에서 위치 보기
          </a>
          <div class="location-line">운영시간 11:00–18:00</div>
          <div class="location-line">월요일 및 공휴일 휴관</div>
        </div>
      </section>

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
        <span>COPYRIGHT©2026 Space DDF</span>
      </div>
    </aside>

    <main class="main-content" @click="closeAside">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed, ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isAsideOpen = ref(false)
const asideRef = ref(null)
const menuButtonRef = ref(null)
const showSidebarMap = computed(() => Boolean(route.name) && route.name !== 'archive-route')

const toggleAside = () => {
  isAsideOpen.value = !isAsideOpen.value
  if (isAsideOpen.value) nextTick(() => asideRef.value?.focus())
}

const closeAside = () => {
  const wasOpen = isAsideOpen.value
  isAsideOpen.value = false
  if (wasOpen) nextTick(() => menuButtonRef.value?.focus())
}

const onKeydown = (e) => {
  if (e.key === 'Escape' && isAsideOpen.value) {
    closeAside()
  }
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

overflow: hidden;
overscroll-behavior: none;
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

/* 소개글 */
.intro-wrap {
  position: static;
  background: #fff;
  padding-top: 16px;
  padding-bottom: 14px;
  border-bottom: none;
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

/* Location */
.location-wrap {
  padding-top: 14px;
  padding-bottom: 14px;

  border-top: 1px solid #1C1C1C;
}

.side-map-box {
  width: 100%;
  aspect-ratio: 1 / 1;

  margin: 0;
  margin-top: 10px;

  border: 1px solid #1C1C1C;
  overflow: hidden;
}

.side-map {
  display: block;
  width: 100%;
  height: 100%;

  border: 0;
}

.location-info {
  margin-top: 10px;

  display: grid;
  gap: 4px;
}

.location-name {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
}

.location-line {
  font-size: 12px;
  line-height: 1.5;
  color: #555;

  word-break: keep-all;
  overflow-wrap: break-word;
}

.location-link {
  width: fit-content;
  color: inherit;
  font-size: 12px;
  line-height: 1.5;
}

.location-link:hover,
.location-link:focus-visible {
  text-decoration-thickness: 2px;
}

.left-body {
  padding: 12px 0;
  flex: 1 1 auto;
}

.side-nav {
  border-top: 1px solid #1C1C1C;
  padding: 10px 0;
}

.side-nav-link {
  display: grid;
  gap: 4px;
  color: inherit;
  text-decoration: none;
}

.side-nav-link span {
  font-family: 'D2Coding', monospace;
  font-size: 12px;
  line-height: 1.2;
  color: #666;
}

.side-nav-link strong {
  font-size: 14px;
  line-height: 1.35;
  font-weight: 700;
}

.side-nav-link:hover strong {
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
    overflow-x: clip;
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
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .section-left.open {
    transform: translateX(0);
  }

  .home-btn img {
    width: 40px;
  }
}

/* Archive Index shell */
.layout {
  grid-template-columns: 1fr;
  padding-top: 48px;
  overflow-x: clip;
}

.archive-site-header {
  position: fixed;
  inset: 0 0 auto;
  z-index: 40;
  height: 48px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 14px;
  border-bottom: 1px solid var(--ddf-line);
  background: rgba(255, 255, 255, .96);
  backdrop-filter: blur(8px);
}

.home-btn {
  position: static;
  justify-self: start;
}

.home-btn img { width: 32px; }

.archive-site-nav {
  grid-column: 2;
  display: flex;
  align-self: stretch;
  gap: 26px;
}

.archive-site-nav a {
  display: flex;
  align-items: center;
  border-bottom: 2px solid transparent;
  color: var(--ddf-ink);
  text-decoration: none;
  font: 11px/1 var(--ddf-font-mono);
  text-transform: uppercase;
}

.archive-about-trigger {
  min-height: 44px;
  padding: 0;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--ddf-ink);
  font: 11px/1 var(--ddf-font-mono);
  text-transform: uppercase;
  cursor: pointer;
}

.archive-about-trigger:hover { border-bottom-color: var(--ddf-line); }

.archive-site-nav a:hover,
.archive-site-nav a.router-link-active { border-bottom-color: var(--ddf-line); }

.hamburger {
  position: static;
  grid-column: 3;
  grid-row: 1;
  display: inline-flex;
  justify-self: end;
  flex-direction: column;
  justify-content: center;
  width: 44px;
  min-height: 44px;
  padding: 6px;
  border-radius: 0;
}

.section-left {
  position: fixed;
  inset: 48px auto 0 0;
  z-index: 30;
  width: min(360px, 88vw);
  min-height: 0;
  height: calc(100dvh - 48px);
  transform: translateX(-100%);
  transition: transform 220ms ease-out;
  overflow-y: auto;
  overscroll-behavior: contain;
  box-shadow: 16px 0 32px rgba(0,0,0,.08);
}

.section-left.open { transform: translateX(0); }
.backdrop { position: fixed; inset: 48px 0 0; z-index: 25; display: block; background: rgba(0,0,0,.28); }
.main-content { grid-column: 1; }

@media (max-width: 700px) {
  .archive-site-header { grid-template-columns: 1fr 1fr; }
  .archive-site-nav { display: none; }
  .hamburger { grid-column: 2; }
  .section-left { top: 48px; width: min(340px, 88vw); height: calc(100dvh - 48px); }
}
</style>
