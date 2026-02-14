import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import './style.css'
import App from './App.vue'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      // Add translations here
    }
  }
})
app.use(i18n)

app.mount('#app')