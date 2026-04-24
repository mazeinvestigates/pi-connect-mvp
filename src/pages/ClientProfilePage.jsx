import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function ClientProfilePage({ user, profile, onNavigate }) {
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    company: '',
  })
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [passwordMessage, setPasswordMessage] = useState(null)
  const [passwordError, setPasswordError] = useState(null)

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.full_name || '',
        phone: profile.phone || '',
        company: profile.company || '',
      })
    }
  }, [profile])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
          phone: formData.phone || null,
          company: formData.company || null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
      if (error) throw error
      setMessage('Profile updated successfully.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPasswordMessage(null)
    setPasswordError(null)
    if (passwords.new !== passwords.confirm) {
      setPasswordError('New passwords do not match.')
      return
    }
    if (passwords.new.length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: passwords.new })
      if (error) throw error
      setPasswordMessage('Password updated successfully.')
      setPasswords({ current: '', new: '', confirm: '' })
    } catch (err) {
      setPasswordError(err.message)
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>Account Settings</h1>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>{user?.email}</p>
      </div>

      {/* Profile Info */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '20px' }}>Personal Information</h2>

        {message && <div className="alert alert-success" style={{ marginBottom: '16px' }}>{message}</div>}
        {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={e => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="Your full name"
              required
            />
          </div>

          <div className="form-group">
            <label>Phone (optional)</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Your phone number"
            />
          </div>

          <div className="form-group">
            <label>Company / Organization (optional)</label>
            <input
              type="text"
              value={formData.company}
              onChange={e => setFormData({ ...formData, company: e.target.value })}
              placeholder="Law firm, insurance company, etc."
            />
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={user?.email || ''} disabled
              style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
            <small>Contact support to change your email address</small>
          </div>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Password Change */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '20px' }}>Change Password</h2>

        {passwordMessage && <div className="alert alert-success" style={{ marginBottom: '16px' }}>{passwordMessage}</div>}
        {passwordError && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{passwordError}</div>}

        <form onSubmit={handlePasswordChange}>
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={passwords.new}
              onChange={e => setPasswords({ ...passwords, new: e.target.value })}
              placeholder="At least 6 characters"
              required
            />
          </div>

          <div className="form-group">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={passwords.confirm}
              onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
              placeholder="Repeat new password"
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={savingPassword}>
            {savingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Email Preferences link */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Email Preferences</h2>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
          Manage which email notifications you receive from PI Connect.
        </p>
        <button className="btn-secondary" onClick={() => onNavigate('email-preferences')}>
          ✉️ Manage Email Preferences
        </button>
      </div>
    </div>
  )
}
