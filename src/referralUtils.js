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
export async function recordSignupReferral(newPiUserId, newPiEmail, refCode) {
  if (!refCode) return

  // Find the referring PI
  const { data: referrer } = await supabase
    .from('pi_profiles')
    .select('user_id')
    .eq('referral_code', refCode.toUpperCase())
    .maybeSingle()

  if (!referrer) return

  // Store the referring code on the new PI's profile
  await supabase
    .from('pi_profiles')
    .update({ referred_by_code: refCode.toUpperCase() })
    .eq('user_id', newPiUserId)

  // Create subscription referral record
  await supabase
    .from('subscription_referrals')
    .insert({
      referring_pi_id: referrer.user_id,
      referred_pi_id: newPiUserId,
      referred_pi_email: newPiEmail,
      status: 'pending',
      credit_amount_cents: 999 // default $9.99 — updated to actual tier cost when credit is applied
    })
}

// Get referral link for a PI
export function getReferralLink(referralCode) {
  const base = 'https://pi-connect-mvp.vercel.app'
  return `${base}?ref=${referralCode}`
}
