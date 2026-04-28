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

  // Find the referring PI by referral code
  const { data: referrer } = await supabase
    .from('pi_profiles')
    .select('user_id')
    .eq('referral_code', refCode.toUpperCase())
    .maybeSingle()

  if (!referrer) {
    console.warn('No PI found with referral code:', refCode)
    return
  }

  // Create subscription referral record immediately
  // (pi_profiles for the referred PI may not exist yet — created during onboarding)
  const { error } = await supabase
    .from('subscription_referrals')
    .insert({
      referring_pi_id: referrer.user_id,
      referred_pi_id: newPiUserId,
      referred_pi_email: newPiEmail,
      status: 'pending',
      credit_amount_cents: 999
    })

  if (error) {
    console.error('Failed to create subscription referral:', error)
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
