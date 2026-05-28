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
