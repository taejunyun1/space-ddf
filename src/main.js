// main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/styles/global.css'
import { installGoogleAnalytics } from './services/analytics'
import { useContentStore } from './stores/content'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

useContentStore(pinia).hydratePublishedContents()

const updateRouteSeo = async (route) => {
  const { updateSeo } = await import(/* webpackChunkName: "seo" */ './lib/seo')
  updateSeo(route, pinia)
}

router.afterEach(updateRouteSeo)
router.isReady().then(() => updateRouteSeo(router.currentRoute.value))

installGoogleAnalytics()

app.mount('#app')
