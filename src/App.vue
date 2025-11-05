<template>
  <div id="app" class="layout">
    <!-- 항상 최상단에 보이는 Home 버튼 -->
    <router-link to="/home" class="home-btn">
      <img src="@/assets/logo.png" alt="Space DDF" />
    </router-link>

    <!-- 모바일 전용 햄버거 버튼 -->
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

    <!-- 모바일 전용 백드롭 -->
    <div v-if="isAsideOpen" class="backdrop" @click="closeAside"></div>

    <!-- 왼쪽 섹션 (접힘/펼침) -->
    <aside
      id="app-aside"
      class="section-left"
      :class="{ open: isAsideOpen }"
      @keydown.esc="closeAside"
      tabindex="-1"
    >
      <!-- ✅ 스크롤해도 항상 상단에 보이는 영역 -->
      <div class="intro-wrap" role="region" aria-label="소개글">
        <p class="intro-kr">
          광주 충장로에 위치한 스페이스 DDF는 2021년부터 지역 예술 생태계의 핵심 거점 역할을 해온 대안 예술 공간입니다.
          전시, 워크숍, 프로젝트를 통해 시각 예술, 전자음악, 퍼포먼스, 미디어 아트 등 다양한 매체를 아우르는
          신진 작가들의 실험적 활동을 지원합니다.
        </p>
        <p class="intro-en">
          Space DDF, located in Chungjang-ro, Gwangju, is an alternative art space that has
          served as a key hub for the local art ecosystem since 2021. Through exhibitions, workshops,
          and projects, it supports experimental practices by emerging artists across various media.
        </p>
      </div>

      <!-- 본문(스크롤되는 나머지 콘텐츠가 들어올 자리) -->
      <div class="left-body">
        <!-- 필요 시 사이드 메뉴/링크/리스트 등 배치 -->
      </div>

      <!-- ✅ 항상 하단에 붙는 푸터 -->
      <div class="footer-wrap">
        <div class="intro-en">
          <a href="https://www.instagram.com/space.ddf" target="_blank" rel="noopener">@space_ddf</a>
        </div>
        <div class="intro-en"><a href="mailto:space.ddf@gmail.com">space.ddf@gmail.com</a></div>
        <span>COPYRIGHT©2025 Space DDF</span>
      </div>
    </aside>

    <!-- 우측 컨텐츠 -->
    <main class="main-content" @click="closeAside">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const isAsideOpen = ref(false)
const toggleAside = () => { isAsideOpen.value = !isAsideOpen.value }
const closeAside = () => { isAsideOpen.value = false }

const onKeydown = (e) => { if (e.key === 'Escape') closeAside() }
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>

/* 레이아웃 */
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
  flex-direction: column;      /* 푸터를 아래로 밀기 위해 column */
  padding: 20px;
  padding-top: 50px;           /* 상단 여백(로고 버튼 간섭 방지) */
  border-right: 1px solid #1C1C1C;
  min-height: 100dvh;          /* 뷰포트 높이 기준 */
  box-sizing: border-box;
  background: #fff;
  z-index: 20;

  /* ✅ 내부 스크롤 컨테이너: sticky 기준이 이 컨테이너가 됨 */
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* ✅ 상단 고정(Sticky Top) 영역 */
.intro-wrap {
  position: fie;            /* 스크롤해도 상단에 붙음 */
  top: 0;                      /* 컨테이너 상단 기준 */
  background: #fff;            /* 아래 내용 비침 방지 */
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
  z-index: 10;
}

/* 본문(스크롤되는 영역) */
.left-body {
  padding: 12px 0;
}

/* 소개글 타이포 */
.intro-kr,
.intro-en {
  font-size: 14px;
  line-height: 1.6;
  margin: 8px 0;
}

/* ✅ 하단 고정(Sticky Bottom) 푸터 */
.footer-wrap {
  margin-top: auto;            /* 남은 공간 채워 바닥으로 밀기 */
  position: sticky;            /* 컨테이너 내부 하단에 붙도록 */
  bottom: 0;
  background: #fff;
  padding-top: 12px;
  padding-bottom: 8px;
  border-top: 1px solid #1C1C1C;
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
  padding: 8px;
  box-sizing: border-box;
}
.hamburger .bar {
  display: block;
  height: 2px;
  margin: 5px 0;
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

  .hamburger { display: inline-flex; }

  .backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.32);
    z-index: 15;
    backdrop-filter: blur(1px);
  }

  .section-left {
    position: fixed;
    top: 0;
    left: 0;
    width: 80vw;
    max-width: 320px;
    transform: translateX(-100%);
    transition: transform 220ms ease-out;
    box-shadow: 0 10px 30px rgba(0,0,0,0.12);
    padding: 16px;
    padding-top: 50px;

    /* ✅ 내부 스크롤 유지 (sticky top/bottom 정상 동작) */
  }
  .section-left.open {
    transform: translateX(0);
  }

  .home-btn img { width: 40px; }
}
</style>