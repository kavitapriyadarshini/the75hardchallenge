import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { resolvePostLoginPath } from './lib/authRouting'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import ChallengeSelect from './pages/ChallengeSelect.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Dashboard from './pages/Dashboard.jsx'

import Journey from './pages/Journey.jsx'

const AUTH_ENTRY_PATHS = ['/', '/signup']

export function isPublicJourneyPath(pathname) {
  return pathname.startsWith('/journey/')
}

function AuthBootstrap({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    const redirectAuthedFromEntry = async (session) => {
      if (!session?.user || !AUTH_ENTRY_PATHS.includes(location.pathname)) return
      const path = await resolvePostLoginPath(session.user.id)
      navigate(path, { replace: true })
    }

    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!cancelled && data.session) {
        await redirectAuthedFromEntry(data.session)
      }
      if (!cancelled) setReady(true)
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return
      if (event === 'SIGNED_OUT') {
        if (!AUTH_ENTRY_PATHS.includes(location.pathname) && !isPublicJourneyPath(location.pathname)) {
          navigate('/', { replace: true })
        }
        return
      }
      if (event === 'SIGNED_IN' && session) {
        await redirectAuthedFromEntry(session)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [navigate, location.pathname])

  if (!ready) {
    return <div className="app-loading">Loading…</div>
  }

  return children
}

function AuthenticatedAppRoutes() {
  return (
    <AuthBootstrap>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/challenge-select" element={<ChallengeSelect />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </AuthBootstrap>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public — no auth bootstrap, no session check */}
        <Route path="/journey/:username" element={<Journey />} />
        <Route path="*" element={<AuthenticatedAppRoutes />} />
      </Routes>
    </BrowserRouter>
  )
}
