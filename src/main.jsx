import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

let refreshing = false

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        const activateWaitingWorker = () => {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          }
        }

        activateWaitingWorker()

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          if (!worker) {
            return
          }

          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              activateWaitingWorker()
            }
          })
        })

        window.setInterval(() => {
          registration.update().catch(() => {})
        }, 60 * 60 * 1000)
      })
      .catch((error) => {
        console.warn('Service worker registration failed', error)
      })

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) {
        return
      }

      refreshing = true
      window.location.reload()
    })
  })
}
