import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

// Current terms version — bump this when ToS or Privacy Policy materially changes
const TERMS_VERSION = '2026-03'

export default function AuthPage({ onSuccess, onNavigate }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  // Terms acceptance state
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)

  const resetAcceptance = () => {
    setAcceptedTerms(false)
    setAcceptedPrivacy(false)
  }

  const bothAccepted = acceptedTerms && acceptedPrivacy

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      setMessage('Login successful!')
      setTimeout(() => onSuccess(), 500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    if (!bothAccepted) return
    setLoading(true)
    setError(null)
    try {
      const acceptedAt = new Date().toISOString()

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            terms_accepted_at: acceptedAt,
            terms_version: TERMS_VERSION
          }
        }
      })
      if (error) throw error

      // Write acceptance to profiles table
      if (data?.user) {
        await supabase
          .from('profiles')
          .update({
            terms_accepted_at: acceptedAt,
            terms_version: TERMS_VERSION
          })
          .eq('user_id', data.user.id)
      }

      setMessage('Account created! Check your email for a confirmation link and click it before signing in. Once confirmed, return here and sign in.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePISignup = async (e) => {
    e.preventDefault()
    if (!bothAccepted) return
    setLoading(true)
    setError(null)
    try {
      const acceptedAt = new Date().toISOString()

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            terms_accepted_at: acceptedAt,
            terms_version: TERMS_VERSION
          }
        }
      })
      if (authError) throw authError

      if (authData.user) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email, password
        })
        if (signInError) throw signInError

        // Write acceptance to profiles table
        await supabase
          .from('profiles')
          .update({
            terms_accepted_at: acceptedAt,
            terms_version: TERMS_VERSION
          })
          .eq('user_id', authData.user.id)

        // Create PI profile
        const { error: piProfileError } = await supabase
          .from('pi_profiles')
          .insert({
            user_id: authData.user.id,
            first_name: fullName.split(' ')[0] || '',
            last_name: fullName.split(' ').slice(1).join(' ') || '',
            email: email,
            is_verified: false
          })
        if (piProfileError) throw piProfileError
      }

      setMessage('Account created! Check your email for a confirmation link and click it before signing in. Once confirmed, return here and sign in to complete your profile.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/?reset=true`
      })
      if (error) throw error
      setMessage('Password reset email sent. Check your inbox and follow the link to reset your password.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      setLoading(false)
      return
    }
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setMessage('Password updated successfully! You can now sign in.')
      setTimeout(() => { setMode('login'); setPassword(''); setConfirmPassword('') }, 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('reset') === 'true') setMode('reset-password')
  }, [])

  // Shared terms acceptance checkboxes
  const TermsCheckboxes = () => (
    <div className="terms-acceptance">
      <label className="terms-checkbox-label">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={e => setAcceptedTerms(e.target.checked)}
        />
        <span>
          I have read and agree to the{' '}
          <button
            type="button"
            className="terms-link"
            onClick={() => onNavigate && onNavigate('terms')}
          >
            Terms of Service
          </button>
        </span>
      </label>
      <label className="terms-checkbox-label">
        <input
          type="checkbox"
          checked={acceptedPrivacy}
          onChange={e => setAcceptedPrivacy(e.target.checked)}
        />
        <span>
          I have read and agree to the{' '}
          <button
            type="button"
            className="terms-link"
            onClick={() => onNavigate && onNavigate('privacy')}
          >
            Privacy Policy
          </button>
        </span>
      </label>
      {!bothAccepted && (
        <p className="terms-required-note">
          You must accept both to create an account.
        </p>
      )}
    </div>
  )

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h2>
            {mode === 'login' && 'Sign In'}
            {mode === 'signup' && 'Create Account'}
            {mode === 'pi-signup' && 'PI Registration'}
            {mode === 'forgot-password' && 'Reset Password'}
            {mode === 'reset-password' && 'Set New Password'}
          </h2>
          <p>
            {mode === 'login' && 'Welcome back to PI Connect'}
            {mode === 'signup' && 'Find investigators for your case'}
            {mode === 'pi-signup' && 'Join our network of verified investigators'}
            {mode === 'forgot-password' && "We'll send you a reset link"}
            {mode === 'reset-password' && 'Choose a new password'}
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {/* ── LOGIN ── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your@email.com" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <button type="submit" className="btn-primary btn-large" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <div className="auth-links">
              <button type="button" className="link-button" onClick={() => { setMode('forgot-password'); setError(null); setMessage(null) }}>
                Forgot your password?
              </button>
              <button type="button" className="link-button" onClick={() => { setMode('signup'); setError(null); setMessage(null); resetAcceptance() }}>
                Need an account? Sign up
              </button>
              <button type="button" className="link-button" onClick={() => { setMode('pi-signup'); setError(null); setMessage(null); resetAcceptance() }}>
                Are you a PI? Register here
              </button>
            </div>
          </form>
        )}

        {/* ── CLIENT SIGNUP ── */}
        {mode === 'signup' && (
          <form onSubmit={handleSignup} className="auth-form">
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="John Doe" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your@email.com" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="At least 6 characters" />
            </div>

            <TermsCheckboxes />

            <button type="submit" className="btn-primary btn-large" disabled={loading || !bothAccepted}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
            <div className="auth-links">
              <button type="button" className="link-button" onClick={() => { setMode('login'); setError(null); setMessage(null) }}>
                Already have an account? Sign in
              </button>
            </div>
          </form>
        )}

        {/* ── PI SIGNUP ── */}
        {mode === 'pi-signup' && (
          <form onSubmit={handlePISignup} className="auth-form">
            <div className="info-box">
              <p>
                <strong>Private Investigators:</strong> Create your profile to connect with clients nationwide.
                All PIs must be verified before appearing in search results.
              </p>
            </div>
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Jane Smith" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="jane@smithinvestigations.com" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="At least 6 characters" />
            </div>

            <TermsCheckboxes />

            <button type="submit" className="btn-primary btn-large" disabled={loading || !bothAccepted}>
              {loading ? 'Creating PI account...' : 'Register as PI'}
            </button>
            <div className="auth-links">
              <button type="button" className="link-button" onClick={() => { setMode('login'); setError(null); setMessage(null) }}>
                Already have an account? Sign in
              </button>
              <button type="button" className="link-button" onClick={() => { setMode('signup'); setError(null); setMessage(null); resetAcceptance() }}>
                Looking for a PI? Create client account
              </button>
            </div>
          </form>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {mode === 'forgot-password' && (
          <form onSubmit={handleForgotPassword} className="auth-form">
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your@email.com" />
            </div>
            <button type="submit" className="btn-primary btn-large" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <div className="auth-links">
              <button type="button" className="link-button" onClick={() => { setMode('login'); setError(null); setMessage(null) }}>
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {/* ── RESET PASSWORD ── */}
        {mode === 'reset-password' && (
          <form onSubmit={handleResetPassword} className="auth-form">
            <div className="form-group">
              <label>New Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="At least 6 characters" />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} placeholder="Repeat your password" />
            </div>
            <button type="submit" className="btn-primary btn-large" disabled={loading}>
              {loading ? 'Updating...' : 'Set New Password'}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
