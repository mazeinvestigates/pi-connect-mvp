import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function EmailPreferencesPage({ user, onNavigate }) {
  const [preferences, setPreferences] = useState({
    new_messages: true,
    new_jobs: true,
    job_applications: true,
    payment_confirmations: true,
    reviews: true,
    consultation_requests: true,
    referrals: true,
    admin_actions: true,
    daily_digest: false,
    marketing_emails: true
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (user) {
      loadPreferences()
    }
  }, [user])

  const loadPreferences = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('email_preferences')
        .eq('user_id', user.id)
        .single()

      if (error) throw error

      if (data?.email_preferences) {
        setPreferences(data.email_preferences)
      }
    } catch (error) {
      console.error('Error loading preferences:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = (key) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setMessage(null)

      const { error } = await supabase
        .from('profiles')
        .update({ email_preferences: preferences })
        .eq('user_id', user.id)

      if (error) throw error

      setMessage({ type: 'success', text: 'Email preferences saved successfully!' })
      
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error saving preferences:', error)
      setMessage({ type: 'error', text: 'Failed to save preferences. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const preferenceOptions = [
    {
      key: 'new_messages',
      title: 'New Messages',
      description: 'Get notified when someone sends you a message'
    },
    {
      key: 'new_jobs',
      title: 'New Job Postings',
      description: 'Receive alerts for new jobs matching your expertise (PIs only)'
    },
    {
      key: 'job_applications',
      title: 'Job Applications',
      description: 'Get notified when PIs apply to your jobs (Clients only)'
    },
    {
      key: 'payment_confirmations',
      title: 'Payment Confirmations',
      description: 'Receive receipts and confirmation emails for all payments'
    },
    {
      key: 'reviews',
      title: 'New Reviews',
      description: 'Get notified when someone leaves you a review'
    },
    {
      key: 'consultation_requests',
      title: 'Consultation Requests',
      description: 'Receive alerts for new consultation requests (PIs only)'
    },
    {
      key: 'referrals',
      title: 'Referral Notifications',
      description: 'Get notified when you receive or send job referrals'
    },
    {
      key: 'admin_actions',
      title: 'Admin Actions',
      description: 'Notifications about account verification and moderation'
    },
    {
      key: 'daily_digest',
      title: 'Daily Digest',
      description: 'Receive one summary email per day instead of individual notifications'
    },
    {
      key: 'marketing_emails',
      title: 'Marketing & Updates',
      description: 'Product updates, tips, and platform news'
    }
  ]

  if (!user) {
    return (
      <div className="email-prefs-page">
        <div className="empty-state">
          <h2>Email Preferences</h2>
          <p>Please sign in to manage your email preferences.</p>
          <button onClick={() => onNavigate('auth')} className="btn-primary">
            Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="email-prefs-page">
      <div className="page-header">
        <h1>📧 Email Preferences</h1>
        <p>Control which email notifications you receive</p>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading preferences...</p>
        </div>
      ) : (
        <div className="prefs-container">
          <div className="prefs-list">
            {preferenceOptions.map(option => (
              <div key={option.key} className="pref-item">
                <div className="pref-info">
                  <h3>{option.title}</h3>
                  <p>{option.description}</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={preferences[option.key]}
                    onChange={() => handleToggle(option.key)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            ))}
          </div>

          <div className="prefs-actions">
            <button
              onClick={handleSave}
              className="btn-primary btn-large"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>

          <div className="info-box">
            <h3>About Email Notifications</h3>
            <p>We respect your inbox. You can turn off any notification type at any time.</p>
            <p>Even with all notifications disabled, you'll still receive:</p>
            <ul>
              <li>Security alerts and password reset emails</li>
              <li>Legal notices and terms updates</li>
              <li>Account verification emails</li>
            </ul>
            <p>
              <strong>Note:</strong> In-app notifications are controlled separately and will 
              continue to work even if you disable email notifications.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
