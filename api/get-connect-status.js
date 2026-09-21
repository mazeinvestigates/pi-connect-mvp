import Stripe from 'stripe'
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
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const { userId } = req.body
    if (!userId) return res.status(400).json({ error: 'userId required' })

    const { data: pi } = await supabase
      .from('pi_profiles')
      .select('stripe_connect_id, stripe_connect_enabled')
      .eq('user_id', userId)
      .single()

    if (!pi?.stripe_connect_id) {
      return res.status(200).json({ connected: false, enabled: false })
    }

    const account = await stripe.accounts.retrieve(pi.stripe_connect_id)
    const enabled = account.charges_enabled && account.payouts_enabled

    // Update DB if status changed
    if (enabled !== pi.stripe_connect_enabled) {
      await supabase
        .from('pi_profiles')
        .update({ stripe_connect_enabled: enabled })
        .eq('user_id', userId)
    }

    return res.status(200).json({
      connected: true,
      enabled,
      connectId: pi.stripe_connect_id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      requirementsDisabled: account.requirements?.disabled_reason || null,
      pendingRequirements: account.requirements?.currently_due || []
    })
  } catch (err) {
    console.error('Get connect status error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
