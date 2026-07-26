import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// The app precaches its shell so it opens with no network, the treadmill is
// in a basement. The cost of that is a stale cache, so the worker is
// registered here rather than by the plugin's default injected script: that
// script only ever called register(), with no update check and no reload, so a
// new deploy first appeared on the SECOND reload and on an installed iOS PWA
// often never at all.
const UPDATE_CHECK_MS = 60 * 60 * 1000

if ('serviceWorker' in navigator) {
  // Reload once when control actually changes hands. `hadController` skips the
  // very first install, where nothing stale is on screen and a reload would be
  // a pointless flash; `reloading` guards against a loop.
  const hadController = !!navigator.serviceWorker.controller
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    window.location.reload()
  })
}

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    const check = () => { void registration.update() }
    setInterval(check, UPDATE_CHECK_MS)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>)
