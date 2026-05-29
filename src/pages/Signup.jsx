import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { friendlyDisplayFromEmail } from '../lib/emailDisplay'
import { AuthPWAInstallPrompt } from '../hooks/usePWAInstall.jsx'
import './auth-forms.css'

function isValidEmail(raw) {
  const s = String(raw ?? '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function mapSignupError(error) {
  if (!error) return 'Something went wrong. Try again.'
  const msg = error.message?.toLowerCase() ?? ''
  if (
    msg.includes('user already registered') ||
    msg.includes('already been registered') ||
    msg.includes('already exists')
  ) {
    return 'That email is already registered.'
  }
  if (msg.includes('password')) {
    return 'Password must be at least 6 characters.'
  }
  if (msg.includes('email')) {
    return 'Enter a valid email address.'
  }
  if (msg.includes('too many requests')) {
    return 'Too many attempts. Wait a moment and try again.'
  }
  return error.message || 'Something went wrong. Try again.'
}

export default function Signup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    const emailTrim = email.trim()
    if (!emailTrim || !password || !confirmPassword) {
      setError('Enter your email, password, and confirm password.')
      return
    }
    if (!isValidEmail(emailTrim)) {
      setError('Enter a valid email address.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    const displayName = friendlyDisplayFromEmail(emailTrim) || emailTrim

    setLoading(true)
    try {
      const { data, error: signError } = await supabase.auth.signUp({
        email: emailTrim,
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
        navigate('/challenge-select', { replace: true })
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
        <p className="auth-brand">THE 75 CHALLENGE</p>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-sub">Sign up with your email and password.</p>

        <form onSubmit={handleSubmit} noValidate>
          {error ? <p className="auth-error">{error}</p> : null}
          {info ? <p className="auth-success">{info}</p> : null}

          <div className="auth-field">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

          <div className="auth-field">
            <label htmlFor="signup-confirm-password">Confirm password</label>
            <input
              id="signup-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
            {passwordsMismatch ? (
              <p className="auth-field-inline-error" role="alert">
                Passwords do not match
              </p>
            ) : null}
          </div>

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Sign up'}
          </button>

          <AuthPWAInstallPrompt />
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
