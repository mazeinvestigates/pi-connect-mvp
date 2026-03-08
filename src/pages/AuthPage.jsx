import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function AuthPage({ onSuccess }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'pi-signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

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
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      })

      if (error) throw error

      setMessage('Account created! Please check your email to verify.')
      setTimeout(() => onSuccess(), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePISignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // First create the auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      })

      if (authError) throw authError

      // Then create a PI profile
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('pi_profiles')
          .insert({
            user_id: authData.user.id,
            first_name: fullName.split(' ')[0] || '',
            last_name: fullName.split(' ').slice(1).join(' ') || '',
            email: email,
            is_verified: false
          })

        if (profileError) throw profileError
      }

      setMessage('PI account created! Please complete your profile and submit for verification.')
      setTimeout(() => onSuccess(), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h2>
            {mode === 'login' && 'Sign In'}
            {mode === 'signup' && 'Create Account'}
            {mode === 'pi-signup' && 'PI Registration'}
          </h2>
          <p>
            {mode === 'login' && 'Welcome back to PI Connect'}
            {mode === 'signup' && 'Find investigators for your case'}
            {mode === 'pi-signup' && 'Join our network of verified investigators'}
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="btn-primary btn-large" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="auth-links">
              <button
                type="button"
                className="link-button"
                onClick={() => setMode('signup')}
              >
                Need an account? Sign up
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => setMode('pi-signup')}
              >
                Are you a PI? Register here
              </button>
            </div>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignup} className="auth-form">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="John Doe"
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="At least 6 characters"
              />
            </div>

            <button type="submit" className="btn-primary btn-large" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

            <div className="auth-links">
              <button
                type="button"
                className="link-button"
                onClick={() => setMode('login')}
              >
                Already have an account? Sign in
              </button>
            </div>
          </form>
        )}

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
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Jane Smith"
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="jane@smithinvestigations.com"
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="At least 6 characters"
              />
            </div>

            <button type="submit" className="btn-primary btn-large" disabled={loading}>
              {loading ? 'Creating PI account...' : 'Register as PI'}
            </button>

            <div className="auth-links">
              <button
                type="button"
                className="link-button"
                onClick={() => setMode('login')}
              >
                Already have an account? Sign in
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => setMode('signup')}
              >
                Looking for a PI? Create client account
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
