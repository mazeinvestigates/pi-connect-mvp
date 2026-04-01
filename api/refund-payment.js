import Stripe from 'stripe'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const { paymentIntentId, reason } = req.body

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'paymentIntentId is required' })
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment has not been captured yet' })
    }

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer',
      metadata: { reason: reason || 'Job cancelled' }
    })

    return res.status(200).json({
      refundId: refund.id,
      status: refund.status,
      amount: refund.amount
    })
  } catch (err) {
    console.error('Refund error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
