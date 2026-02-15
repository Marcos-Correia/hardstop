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
      // ── Navigation ──────────────────────────────────
      nav: {
        questions: 'Questions',
        practice: 'Practice',
        logout: 'Logout',
      },
      // ── Common ──────────────────────────────────────
      common: {
        save: 'Save',
        cancel: 'Cancel',
        edit: 'Edit',
        delete: 'Delete',
        back: 'Back',
      },
      // ── Categories ──────────────────────────────────
      categories: {
        title: 'Categories',
        counter: '{current} of {min}–{max} categories',
        add: 'Add',
        limitReached: 'Max reached',
        namePlaceholder: 'Category name (e.g. "Teamwork")',
        descriptionPlaceholder: 'Optional description',
        emptyTitle: 'No categories yet',
        emptyDescription: 'Create 5–10 categories to organize your interview questions. Tap "Add" to get started.',
        questionCount: '{count} question(s)',
        needMore: 'need {need} more',
        deleteTitle: 'Delete Category',
        deleteConfirm: 'Delete "{name}" and all its questions?',
        deleteWarning: 'This will also delete {count} question(s).',
      },
      // ── Questions ───────────────────────────────────
      questions: {
        counter: '{current} of {min}–{max} questions',
        add: 'Add',
        limitReached: 'Max reached',
        titlePlaceholder: 'Question (e.g. "Tell me about a conflict you resolved")',
        hintPlaceholder: 'Optional hint or key points',
        timeLabel: 'Time:',
        seconds: 'sec',
        emptyTitle: 'No questions yet',
        emptyDescription: 'Add {min}–{max} questions to this category.',
        hintPrefix: 'Hint:',
        deleteTitle: 'Delete Question',
        deleteConfirm: 'Are you sure you want to delete this question?',
      },
      // ── Management wrapper ──────────────────────────
      management: {
        setupIncomplete: 'Setup incomplete — fix the items below to start practicing:',
        andMore: '…and {count} more',
        ready: 'Ready to practice!',
        startPractice: 'Start Session',
      },
    },
  },
})
app.use(i18n)

app.mount('#app')