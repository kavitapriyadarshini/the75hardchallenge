import { useCallback, useEffect, useRef, useState } from 'react'

function isStandaloneDisplay() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

/**
 * Captures `beforeinstallprompt` for Android/Chrome install UI.
 * iOS Safari: use `showIosHint` (no beforeinstallprompt).
 */
export function usePWAInstall() {
  const deferredPromptRef = useRef(null)
  const [canInstall, setCanInstall] = useState(false)
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneDisplay())
  const [isIos, setIsIos] = useState(() => isIosDevice())

  useEffect(() => {
    setIsStandalone(isStandaloneDisplay())
    setIsIos(isIosDevice())

    if (isStandaloneDisplay()) return undefined

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault()
      deferredPromptRef.current = event
      setCanInstall(true)
    }

    const onAppInstalled = () => {
      deferredPromptRef.current = null
      setCanInstall(false)
      setIsStandalone(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    const promptEvent = deferredPromptRef.current
    if (!promptEvent) return
    await promptEvent.prompt()
    await promptEvent.userChoice
    deferredPromptRef.current = null
    setCanInstall(false)
  }, [])

  const showInstallButton = canInstall && !isStandalone
  const showIosHint = isIos && !isStandalone && !canInstall

  return {
    showInstallButton,
    showIosHint,
    promptInstall,
  }
}

/** Login / Signup install prompt — Android `beforeinstallprompt` or iOS Safari hint. */
export function AuthPWAInstallPrompt() {
  const { showInstallButton, showIosHint, promptInstall } = usePWAInstall()

  if (showInstallButton) {
    return (
      <button
        type="button"
        className="auth-pwa-install"
        onClick={() => void promptInstall()}
      >
        <span className="auth-pwa-install-icon" aria-hidden>
          📲
        </span>
        Add Unlock75 to your home screen
      </button>
    )
  }

  if (showIosHint) {
    return (
      <p className="auth-pwa-ios-hint" role="note">
        <span className="auth-pwa-ios-share" aria-hidden title="Share">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 3v10M12 3l4 4M12 3L8 7M5 11v8a2 2 0 002 2h10a2 2 0 002-2v-8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        On iPhone: tap <strong>Share</strong> → <strong>Add to Home Screen</strong>
      </p>
    )
  }

  return null
}
