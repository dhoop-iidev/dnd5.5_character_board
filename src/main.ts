/// <reference types="vite-plugin-pwa/client" />
import { mount } from 'svelte'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource/cinzel/400.css'
import '@fontsource/cinzel/700.css'
import '@fontsource/cinzel-decorative/700.css'
import '@fontsource/im-fell-english-sc/400.css'
import '@fontsource/eb-garamond/400.css'
import '@fontsource/eb-garamond/600.css'
import '@fontsource/eb-garamond/700.css'
import '@fontsource/eb-garamond/400-italic.css'
import './app.css'
import App from './App.svelte'

const app = mount(App, {
  target: document.getElementById('app')!,
})

// Offline app: when a new version has been deployed, the service worker installs it and the page reloads
// once to run it (otherwise the old cached version keeps running until the next visit).
registerSW({ immediate: true })

export default app
