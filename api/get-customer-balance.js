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
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single()

    if (!pi?.stripe_customer_id) {
      return res.status(200).json({ balance: 0, balanceCents: 0 })
    }

    const customer = await stripe.customers.retrieve(pi.stripe_customer_id)
    // Stripe balance is stored as negative for credits (e.g. -999 = $9.99 credit)
    const balanceCents = customer.balance ? Math.abs(customer.balance) : 0

    return res.status(200).json({
      balanceCents,
      balance: (balanceCents / 100).toFixed(2)
    })
  } catch (err) {
    console.error('Get customer balance error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
