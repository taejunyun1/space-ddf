import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      alias: ['/home'] // ← /home도 동일 컴포넌트로 매칭
      // 혹은: { path: '/home', redirect: { name: 'home' } }
    },
    {
      path: '/archive-map',
      name: 'regional-archive',
      component: () => import('@/views/RegionalArchiveView.vue'),
      alias: ['/map']
    },
    {
      path: '/rental',
      name: 'rental',
      component: () => import('@/views/RentalView.vue')
    },
    {
      path: '/admin',
      redirect: { name: 'admin-rentals' }
    },
    {
      path: '/admin/rental',
      redirect: { name: 'admin-rentals' }
    },
    {
      path: '/admin/rentals',
      name: 'admin-rentals',
      component: () => import('@/views/AdminRentalsView.vue')
    },
    {
      path: '/admin/contents',
      redirect: { name: 'manage-contents' }
    },
    {
      path: '/manage',
      redirect: { name: 'manage-rentals' }
    },
    {
      path: '/manage/rentals',
      name: 'manage-rentals',
      component: () => import('@/views/AdminRentalsView.vue')
    },
    {
      path: '/manage/contents',
      name: 'manage-contents',
      component: () => import('@/views/AdminContentsView.vue')
    },
    {
      path: '/manage/contents/:id/preview',
      name: 'manage-content-preview',
      component: () => import('@/views/AdminContentPreviewView.vue')
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
