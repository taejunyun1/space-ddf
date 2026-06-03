// main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

const updateRouteSeo = async (route) => {
  const { updateSeo } = await import(/* webpackChunkName: "seo" */ './lib/seo')
  updateSeo(route, pinia)
}

router.afterEach(updateRouteSeo)
router.isReady().then(() => updateRouteSeo(router.currentRoute.value))

app.mount('#app')
