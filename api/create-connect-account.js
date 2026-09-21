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
      .select('stripe_connect_id, email, first_name, last_name')
      .eq('user_id', userId)
      .single()

    if (!pi) return res.status(404).json({ error: 'PI profile not found' })

    let connectId = pi.stripe_connect_id

    // Create Connect account if one doesn't exist yet
    if (!connectId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: pi.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        business_type: 'individual',
        metadata: { supabase_user_id: userId }
      })

      connectId = account.id

      await supabase
        .from('pi_profiles')
        .update({ stripe_connect_id: connectId })
        .eq('user_id', userId)
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: connectId,
      refresh_url: `${process.env.VITE_APP_URL}?page=dashboard&connect=refresh`,
      return_url: `${process.env.VITE_APP_URL}?page=dashboard&connect=success`,
      type: 'account_onboarding'
    })

    return res.status(200).json({ url: accountLink.url, connectId })
  } catch (err) {
    console.error('Create connect account error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
