import Stripe from 'stripe'

const PRICE_IDS = {
  basic_month:   'price_1TOIkm2OuViCaVLFyDBAnNWr',
  basic_year:    'price_1TOIkm2OuViCaVLF1ADIhwVN',
  premium_month: 'price_1TQsRr2OuViCaVLFQAsGeQU0',
  premium_year:  'price_1TQsS82OuViCaVLFQeiDaofw',
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const { tier, interval, userId, email, existingCustomerId } = req.body

    if (!tier || !interval || !userId || !email) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const priceKey = `${tier}_${interval}`
    const priceId = PRICE_IDS[priceKey]
    if (!priceId) return res.status(400).json({ error: `Invalid tier/interval: ${priceKey}` })

    // Create or reuse Stripe customer
    let customerId = existingCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId }
      })
      customerId = customer.id
    }

    const appUrl = process.env.VITE_APP_URL || 'https://pi-connect-mvp.vercel.app'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}?page=dashboard&subscription=success`,
      cancel_url: `${appUrl}?page=subscription`,
      metadata: {
        supabase_user_id: userId,
        tier,
        interval
      },
      subscription_data: {
        metadata: {
          supabase_user_id: userId,
          tier,
          interval
        }
      }
    })

    return res.status(200).json({
      sessionUrl: session.url,
      customerId
    })
  } catch (err) {
    console.error('Subscription checkout error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
