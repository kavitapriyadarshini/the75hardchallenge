import { usePWAInstall } from '../hooks/usePWAInstall'

export default function PWAInstallAuth() {
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
