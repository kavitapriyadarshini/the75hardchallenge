import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './auth-forms.css'

function challengeTypeLooksValid(raw) {
  const t = String(raw ?? '').toLowerCase().trim()
  return t === '75hard' || t === '75soft'
}

function usernameToFakeEmail(raw) {
  return `${raw.trim().toLowerCase()}@75hard.app`
}

function mapAuthError(error) {
  if (!error) return 'Something went wrong. Try again.'
  const msg = error.message?.toLowerCase() ?? ''
  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid credentials')
  ) {
    return 'Wrong username or password.'
  }
  if (msg.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.'
  }
  if (msg.includes('too many requests')) {
    return 'Too many attempts. Wait a moment and try again.'
  }
  return error.message || 'Something went wrong. Try again.'
}

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const u = username.trim()
    if (!u || !password) {
      setError('Enter your username and password.')
      return
    }

    setLoading(true)
    try {
      const email = usernameToFakeEmail(u)
      const { data, error: signError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        })

      if (signError) {
        setError(mapAuthError(signError))
        return
      }

      const user = data.user
      if (!user) {
        setError('Could not sign in. Try again.')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, challenge_type')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profileError) {
        setError(profileError.message || 'Could not load your profile.')
        return
      }

      if (!profile) {
        navigate('/challenge-select', { replace: true })
        return
      }
      if (!challengeTypeLooksValid(profile.challenge_type)) {
        navigate('/challenge-select', { replace: true })
        return
      }
      navigate('/dashboard', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="auth-brand">75 Hard</p>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Sign in with your username and password.</p>

        <form onSubmit={handleSubmit} noValidate>
          {error ? <p className="auth-error">{error}</p> : null}

          <div className="auth-field">
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="yourname"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-footer">
          No account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
