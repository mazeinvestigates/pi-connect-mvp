import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { newPiUserId, newPiEmail, refCode } = req.body
    if (!newPiUserId || !newPiEmail || !refCode) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Find the referring PI
    const { data: referrer } = await supabase
      .from('pi_profiles')
      .select('user_id')
      .eq('referral_code', refCode.toUpperCase())
      .maybeSingle()

    if (!referrer) {
      return res.status(404).json({ error: 'Referral code not found' })
    }

    // Check if referral already exists to prevent duplicates
    const { data: existing } = await supabase
      .from('subscription_referrals')
      .select('id')
      .eq('referred_pi_id', newPiUserId)
      .maybeSingle()

    if (existing) {
      return res.status(200).json({ message: 'Referral already recorded' })
    }

    // Insert referral record using service role — bypasses RLS
    const { error } = await supabase
      .from('subscription_referrals')
      .insert({
        referring_pi_id: referrer.user_id,
        referred_pi_id: newPiUserId,
        referred_pi_email: newPiEmail,
        status: 'pending',
        credit_amount_cents: 999
      })

    if (error) throw error

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Record referral error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
