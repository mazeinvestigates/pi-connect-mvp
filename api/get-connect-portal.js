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
      .select('stripe_connect_id')
      .eq('user_id', userId)
      .single()

    if (!pi?.stripe_connect_id) {
      return res.status(400).json({ error: 'No Connect account found' })
    }

    // Generate a login link for the Express dashboard
    const loginLink = await stripe.accounts.createLoginLink(pi.stripe_connect_id)

    return res.status(200).json({ url: loginLink.url })
  } catch (err) {
    console.error('Get connect portal error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
