import { supabase } from './supabaseClient'

// Generate a unique referral code from PI's name
export function generateReferralCode(firstName, lastName) {
  const base = `${firstName || ''}${lastName || ''}`.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8)
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `${base}${suffix}`
}

// Ensure PI has a referral code, generate one if not
export async function ensureReferralCode(userId, firstName, lastName) {
  const { data: pi } = await supabase
    .from('pi_profiles')
    .select('referral_code')
    .eq('user_id', userId)
    .single()

  if (pi?.referral_code) return pi.referral_code

  // Generate unique code
  let code = generateReferralCode(firstName, lastName)
  let attempts = 0
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from('pi_profiles')
      .select('user_id')
      .eq('referral_code', code)
      .maybeSingle()

    if (!existing) break
    code = generateReferralCode(firstName, lastName)
    attempts++
  }

  await supabase
    .from('pi_profiles')
    .update({ referral_code: code })
    .eq('user_id', userId)

  return code
}

// Record a referral when a new PI signs up with a ref code
// Called immediately after auth signup — pi_profiles may not exist yet
export async function recordSignupReferral(newPiUserId, newPiEmail, refCode) {
  if (!refCode) return

  // Create subscription referral via server-side API — bypasses RLS
  const res = await fetch('/api/record-referral', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      newPiUserId,
      newPiEmail,
      refCode: refCode.toUpperCase()
    })
  })

  if (!res.ok) {
    const data = await res.json()
    console.error('Failed to create subscription referral:', data.error)
    return
  }

  // Store ref code in localStorage so onboarding can update pi_profiles.referred_by_code
  // when the PI profile is actually created
  localStorage.setItem('pending_ref_code', refCode.toUpperCase())
}

// Called from onboarding after pi_profiles row is created
export async function applyPendingReferralToProfile(userId) {
  const refCode = localStorage.getItem('pending_ref_code')
  if (!refCode) return

  await supabase
    .from('pi_profiles')
    .update({ referred_by_code: refCode })
    .eq('user_id', userId)

  localStorage.removeItem('pending_ref_code')
}

// Get referral link for a PI
export function getReferralLink(referralCode) {
  const base = 'https://pi-connect-mvp.vercel.app'
  return `${base}?ref=${referralCode}`
}
