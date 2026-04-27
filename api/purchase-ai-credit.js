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
    const { userId, quantity = 1 } = req.body

    if (!userId) return res.status(400).json({ error: 'userId required' })

    // Get price from config
    const { data: config } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'ai_credit_price_cents')
      .single()

    const priceCents = parseInt(config?.value || '199')
    const totalCents = priceCents * quantity

    // Get PI's Stripe customer ID
    const { data: pi } = await supabase
      .from('pi_profiles')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single()

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      customer: pi?.stripe_customer_id || undefined,
      metadata: {
        supabase_user_id: userId,
        feature: 'ai_credits',
        quantity: String(quantity)
      },
      description: `PI Connect AI Credits (${quantity} credit${quantity !== 1 ? 's' : ''})`,
      automatic_payment_methods: { enabled: true }
    })

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      amount: totalCents,
      quantity,
      pricePerCredit: priceCents
    })
  } catch (err) {
    console.error('Purchase AI credit error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
