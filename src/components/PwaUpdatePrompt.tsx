import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

const CHECK_EVERY_MS = 15 * 60 * 1000

// Releases are applied automatically (see vite.config.ts). This component only keeps the
// service worker checking for new builds while the app stays open all day, and shows a short
// notice when a new version has just taken over so a surprise reload is explained.
export function PwaUpdatePrompt() {
  const [updated, setUpdated] = useState(false)

  useEffect(() => {
    let timer: number | undefined
    let onVisible: (() => void) | undefined
    registerSW({
      immediate: true,
      onRegisteredSW(_url, registration) {
        if (!registration) return
        const check = () => { if (navigator.onLine) void registration.update().catch(() => {}) }
        timer = window.setInterval(check, CHECK_EVERY_MS)
        onVisible = () => { if (document.visibilityState === 'visible') check() }
        document.addEventListener('visibilitychange', onVisible)
      },
    })
    // Fires once the new worker controls the page, right before autoUpdate reloads it.
    const onControllerChange = () => setUpdated(true)
    navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange)
    return () => {
      if (timer) window.clearInterval(timer)
      if (onVisible) document.removeEventListener('visibilitychange', onVisible)
      navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  if (!updated) return null

  return (
    <aside className="update-prompt" role="status" aria-live="polite">
      <RefreshCw size={20} aria-hidden />
      <div>
        <strong>Updating…</strong>
        <span>The latest PRINCE AMOFAH AUTOS version is loading.</span>
      </div>
    </aside>
  )
}
