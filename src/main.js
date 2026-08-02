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

const updateRouteSeo = async (route) => {
  const { updateSeo } = await import(/* webpackChunkName: "seo" */ './lib/seo')
  updateSeo(route, pinia)
}

router.afterEach(updateRouteSeo)

installGoogleAnalytics()

async function bootstrap() {
  await useContentStore(pinia).hydratePublishedContents()
  app.mount('#app')
  await router.isReady()
  await updateRouteSeo(router.currentRoute.value)
}

bootstrap()
