// Vercel serverless function — handles Stripe webhook events
// POST /api/stripe-webhook
// Set this URL in Stripe Dashboard → Webhooks

const Stripe = require('stripe')
const { createClient } = require('@supabase/supabase-js')

// Supabase service role client — bypasses RLS for trusted server-side writes
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const sig = req.headers['stripe-signature']

  let event
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object
        const { job_id, pi_id, client_id, labor_cents, expenses_cents, platform_fee_cents } = pi.metadata

        // Update transaction record
        await supabase
          .from('transactions')
          .update({ status: 'completed' })
          .eq('stripe_payment_intent_id', pi.id)

        // Update job application payment status
        if (job_id && pi_id) {
          await supabase
            .from('job_applications')
            .update({ payment_status: 'paid' })
            .eq('job_id', job_id)
            .eq('applicant_id', pi_id)
        }

        // Notify PI
        if (pi_id) {
          await supabase.from('notifications').insert({
            user_id: pi_id,
            type: 'payment_received',
            title: 'Payment Received',
            message: `Payment of $${(pi.amount / 100).toFixed(2)} has been received for your job.`,
            related_id: job_id,
            related_type: 'job'
          })
        }

        // Notify client
        if (client_id) {
          await supabase.from('notifications').insert({
            user_id: client_id,
            type: 'payment_confirmed',
            title: 'Payment Confirmed',
            message: `Your payment of $${(pi.amount / 100).toFixed(2)} has been processed.`,
            related_id: job_id,
            related_type: 'job'
          })
        }

        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object
        await supabase
          .from('transactions')
          .update({ status: 'failed' })
          .eq('stripe_payment_intent_id', pi.id)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return res.status(500).json({ error: err.message })
  }
}

// Required: Vercel needs raw body for Stripe signature verification
export const config = {
  api: { bodyParser: false }
}
