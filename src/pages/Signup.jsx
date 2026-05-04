import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './auth-forms.css'

const USERNAME_RE = /^[a-zA-Z0-9_]{2,32}$/

function usernameToFakeEmail(raw) {
  return `${raw.trim().toLowerCase()}@75hard.app`
}

function mapSignupError(error) {
  if (!error) return 'Something went wrong. Try again.'
  const msg = error.message?.toLowerCase() ?? ''
  if (
    msg.includes('user already registered') ||
    msg.includes('already been registered') ||
    msg.includes('already exists')
  ) {
    return 'That username is already taken.'
  }
  if (msg.includes('password')) {
    return 'Password must be at least 6 characters.'
  }
  if (msg.includes('email')) {
    return 'Invalid username for sign-up. Use letters, numbers, or underscores only.'
  }
  if (msg.includes('too many requests')) {
    return 'Too many attempts. Wait a moment and try again.'
  }
  return error.message || 'Something went wrong. Try again.'
}

export default function Signup() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    const displayName = username.trim()
    if (!displayName || !password) {
      setError('Choose a username and password.')
      return
    }
    if (!USERNAME_RE.test(displayName)) {
      setError(
        'Username must be 2–32 characters: letters, numbers, or underscores only.'
      )
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    const email = usernameToFakeEmail(displayName)

    setLoading(true)
    try {
      const { data, error: signError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      })

      if (signError) {
        setError(mapSignupError(signError))
        return
      }

      if (data.session) {
        navigate('/onboarding', { replace: true })
        return
      }

      setInfo(
        'Account created. If email confirmation is enabled, check your inbox — then sign in.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="auth-brand">75 Hard</p>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-sub">
          Pick a username and password. We use a private sign-in address behind
          the scenes.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {error ? <p className="auth-error">{error}</p> : null}
          {info ? <p className="auth-success">{info}</p> : null}

          <div className="auth-field">
            <label htmlFor="signup-username">Username</label>
            <input
              id="signup-username"
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
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
