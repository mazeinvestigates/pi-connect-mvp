import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

const TIERS = [
  {
    key: 'basic',
    name: 'Basic',
    badge: 'standard',
    color: '#6b7280',
    monthlyPrice: 9.99,
    annualPrice: 99.99,
    annualMonthly: 8.33,
    features: [
      'Full platform access',
      'Apply to unlimited jobs',
      'Messaging and consultations',
      'Subcontract and referral network',
      'Listed in All Investigators section',
      'Verified badge on profile',
    ]
  },
  {
    key: 'premium',
    name: 'Premium',
    badge: 'premium',
    color: '#667eea',
    monthlyPrice: 15.99,
    annualPrice: 159.99,
    annualMonthly: 13.33,
    popular: true,
    features: [
      'Everything in Basic',
      '💎 Dedicated "Premium Investigators" section',
      'Shown above all standard listings',
      'Premium badge on profile and search results',
      'First access to new platform features',
    ]
  }
]

export default function SubscriptionPage({ user, profile, onNavigate }) {
  const [interval, setInterval] = useState('month')
  const [loading, setLoading] = useState(null)
  const [changeMessage, setChangeMessage] = useState(null)
  const [error, setError] = useState(null)

  const currentTier = profile?.membership_tier || 'standard'
  const isSubscribed = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing'
  const cancelAtPeriodEnd = profile?.cancel_at_period_end
  const periodEnd = profile?.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  const handleSubscribe = async (tierKey) => {
    setLoading(tierKey)
    setError(null)
    setChangeMessage(null)
    try {
      // If already subscribed, use change-subscription route
      if (isSubscribed && profile?.stripe_subscription_id) {
        const res = await fetch('/api/change-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            newTier: tierKey,
            newInterval: interval,
            subscriptionId: profile.stripe_subscription_id
          })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setChangeMessage({ type: data.type, text: data.message })
        if (data.effectiveImmediately) {
          setTimeout(() => window.location.reload(), 2000)
        }
      } else {
        // New subscription — go through Stripe Checkout
        const res = await fetch('/api/create-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tier: tierKey,
            interval,
            userId: user.id,
            email: user.email,
            existingCustomerId: profile?.stripe_customer_id || null
          })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        window.location.href = data.sessionUrl
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(null)
    }
  }

  const handleCancel = async () => {
    if (!window.confirm('Cancel your subscription? You will keep your current benefits until the end of your billing period.')) return
    setLoading('cancel')
    setError(null)
    try {
      const res = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: profile?.stripe_subscription_id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await supabase.from('pi_profiles').update({
        cancel_at_period_end: true,
        current_period_end: data.currentPeriodEnd
      }).eq('user_id', user.id)
      alert(`Subscription cancelled. Your benefits remain active until ${new Date(data.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`)
      window.location.reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(null)
    }
  }

  const tierLabel = (t) => {
    if (t === 'standard') return 'Basic'
    return t.charAt(0).toUpperCase() + t.slice(1)
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>Choose Your Membership</h1>
        <p style={{ color: '#6b7280', fontSize: '16px' }}>Higher tiers give you a boost in search placement so clients find you first.</p>
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 16px', marginTop: '16px', display: 'inline-block' }}>
          <p style={{ fontSize: '13px', color: '#92400e', margin: 0 }}>
            🧪 <strong>Beta:</strong> All features are free during the beta period. Select a plan to lock in your rate for when billing goes live.
          </p>
        </div>
      </div>

      {isSubscribed && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '16px 20px', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <p style={{ fontWeight: '600', fontSize: '15px', margin: '0 0 4px' }}>
              ✓ Active: {tierLabel(currentTier)} membership
              {profile?.subscription_interval === 'year' ? ' (Annual)' : ' (Monthly)'}
            </p>
            {cancelAtPeriodEnd ? (
              <p style={{ fontSize: '13px', color: '#dc2626', margin: 0 }}>Cancels on {periodEnd} — you keep your benefits until then</p>
            ) : (
              <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Renews on {periodEnd}</p>
            )}
          </div>
          {!cancelAtPeriodEnd && (
            <button onClick={handleCancel} disabled={!!loading}
              style={{ background: 'none', border: '1px solid #dc2626', color: '#dc2626', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
              {loading === 'cancel' ? 'Cancelling...' : 'Cancel Subscription'}
            </button>
          )}
        </div>
      )}

      {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{error}</div>}

      {changeMessage && (
        <div style={{
          background: changeMessage.type === 'upgrade' ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${changeMessage.type === 'upgrade' ? '#86efac' : '#fcd34d'}`,
          borderRadius: '10px', padding: '14px 18px', marginBottom: '20px'
        }}>
          <p style={{ fontWeight: '600', fontSize: '14px', margin: '0 0 4px', color: changeMessage.type === 'upgrade' ? '#166534' : '#92400e' }}>
            {changeMessage.type === 'upgrade' ? '✓ Plan upgraded' : '📅 Plan change scheduled'}
          </p>
          <p style={{ fontSize: '13px', margin: 0, color: '#374151' }}>{changeMessage.text}</p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
        <button onClick={() => setInterval('month')}
          style={{ padding: '8px 24px', border: '1px solid #e5e7eb', borderRight: 'none', borderRadius: '6px 0 0 6px', background: interval === 'month' ? '#667eea' : 'white', color: interval === 'month' ? 'white' : '#374151', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
          Monthly
        </button>
        <button onClick={() => setInterval('year')}
          style={{ padding: '8px 24px', border: '1px solid #e5e7eb', borderRadius: '0 6px 6px 0', background: interval === 'year' ? '#667eea' : 'white', color: interval === 'year' ? 'white' : '#374151', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
          Annual <span style={{ fontSize: '12px', background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>Save ~17%</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {TIERS.map(tier => {
          const isCurrentTier = (currentTier === tier.badge) || (currentTier === 'standard' && tier.key === 'basic')
          const perMonth = interval === 'year' ? tier.annualMonthly : tier.monthlyPrice
          const price = interval === 'month' ? tier.monthlyPrice : tier.annualPrice

          return (
            <div key={tier.key} style={{ border: tier.popular ? '2px solid #667eea' : '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', position: 'relative', background: 'white' }}>
              {tier.popular && (
                <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#667eea', color: 'white', fontSize: '12px', fontWeight: '600', padding: '4px 12px', borderRadius: '20px' }}>
                  Most Popular
                </div>
              )}
              <h2 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 4px', color: tier.color }}>{tier.name}</h2>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                <span style={{ fontSize: '32px', fontWeight: '700' }}>${perMonth.toFixed(2)}</span>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>/mo</span>
              </div>
              {interval === 'year' && (
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px' }}>Billed as ${price.toFixed(2)}/year</p>
              )}
              <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tier.features.map((f, i) => (
                  <li key={i} style={{ fontSize: '13px', color: '#374151', display: 'flex', gap: '8px' }}>
                    <span style={{ color: '#059669', flexShrink: 0 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              {isCurrentTier && isSubscribed ? (
                <button disabled style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#f9fafb', color: '#9ca3af', cursor: 'default', fontSize: '14px' }}>
                  Current Plan
                </button>
              ) : (
                <button onClick={() => handleSubscribe(tier.key)} disabled={!!loading}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', background: tier.popular ? '#667eea' : '#1f2937', color: 'white', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600', opacity: loading ? 0.7 : 1 }}>
                  {loading === tier.key ? (isSubscribed ? 'Updating...' : 'Redirecting to Stripe...') : (() => {
                    if (!isSubscribed) return `Get ${tier.name}`
                    const currentRank = { standard: 1, featured: 2, premium: 3 }[currentTier] || 1
                    const newRank = { basic: 1, featured: 2, premium: 3 }[tier.key] || 1
                    if (newRank > currentRank) return `⬆ Upgrade to ${tier.name}`
                    if (newRank < currentRank) return `⬇ Downgrade to ${tier.name} at renewal`
                    if (interval !== profile?.subscription_interval) return `Switch to ${interval === 'year' ? 'Annual' : 'Monthly'}`
                    return `Switch to ${tier.name}`
                  })()}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {!isSubscribed && (
        <div style={{ textAlign: 'center' }}>
          <button onClick={() => onNavigate('dashboard')}
            style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}>
            Continue for free during beta →
          </button>
        </div>
      )}

      <div style={{ marginTop: '32px', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
        <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0, textAlign: 'center' }}>
          All plans include full platform access. Membership fees are separate from the 10% platform fee on job transactions.{' '}
          <strong>Upgrades</strong> take effect immediately with prorated billing.{' '}
          <strong>Downgrades</strong> take effect at the end of your current billing period — you keep your current benefits until then.{' '}
          Cancel anytime. Powered by Stripe.
        </p>
      </div>
    </div>
  )
}
