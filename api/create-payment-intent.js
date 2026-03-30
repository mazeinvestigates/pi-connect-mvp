// Vercel serverless function — runs server-side, never exposes secret key to client
// POST /api/create-payment-intent

const Stripe = require('stripe')

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    const {
      amountCents, jobId, piId, clientId,
      laborCents, expensesCents, platformFeeCents, description
    } = req.body

    if (!amountCents || amountCents < 50) {
      return res.status(400).json({ error: 'Invalid amount' })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        job_id: jobId || '',
        pi_id: piId || '',
        client_id: clientId || '',
        labor_cents: laborCents || 0,
        expenses_cents: expensesCents || 0,
        platform_fee_cents: platformFeeCents || 0,
        description: description || ''
      }
    })

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    })
  } catch (err) {
    console.error('Stripe error:', err)
    return res.status(500).json({ error: err.message })
  }
}
