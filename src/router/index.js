import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(), // Vue CLI면 createWebHistory(process.env.BASE_URL)도 가능
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      alias: ['/home'] // ← /home도 동일 컴포넌트로 매칭
      // 혹은: { path: '/home', redirect: { name: 'home' } }
    },
    {
      path: '/projects/:slug',
      name: 'project-detail',
      component: () => import('@/views/DetailView.vue'),
      props: r => ({ type: 'project', slug: r.params.slug })
    },
    {
      path: '/shows/:slug',
      name: 'show-detail',
      component: () => import('@/views/DetailView.vue'),
      props: r => ({ type: 'show', slug: r.params.slug })
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFound.vue') },
  ],
  scrollBehavior() { return { top: 0 } }
})

export default router
