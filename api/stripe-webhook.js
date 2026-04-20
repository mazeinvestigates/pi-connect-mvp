import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TIER_MAP = {
  basic: 'standard',
  featured: 'featured',
  premium: 'premium'
}

async function updatePISubscription(userId, updates) {
  await supabase
    .from('pi_profiles')
    .update(updates)
    .eq('user_id', userId)
}

export default async function handler(req, res) {
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

      // ─── Payment intent (job payments) ───────────────────────────────
      case 'payment_intent.succeeded': {
        const pi = event.data.object
        const { job_id, pi_id, client_id } = pi.metadata

        await supabase
          .from('transactions')
          .update({ status: 'completed' })
          .eq('stripe_payment_intent_id', pi.id)

        if (job_id && pi_id) {
          await supabase
            .from('job_applications')
            .update({ payment_status: 'paid' })
            .eq('job_id', job_id)
            .eq('applicant_id', pi_id)
        }

        if (pi_id) {
          await supabase.from('notifications').insert({
            user_id: pi_id,
            type: 'payment_received',
            title: 'Payment Received',
            message: `Payment of $${(pi.amount / 100).toFixed(2)} has been received.`,
            related_id: job_id,
            related_type: 'job'
          })
        }

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

      // ─── Checkout session completed (subscription started) ────────────
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode !== 'subscription') break

        const userId = session.metadata?.supabase_user_id
        const tier = session.metadata?.tier
        const interval = session.metadata?.interval
        if (!userId || !tier) break

        // Retrieve the subscription to get period end
        const subscription = await stripe.subscriptions.retrieve(session.subscription)

        await updatePISubscription(userId, {
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          membership_tier: TIER_MAP[tier] || tier,
          subscription_status: subscription.status,
          subscription_interval: interval,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: false
        })

        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'subscription_activated',
          title: 'Subscription Activated',
          message: `Your ${tier.charAt(0).toUpperCase() + tier.slice(1)} membership is now active.`,
          related_type: 'subscription'
        })

        break
      }

      // ─── Subscription updated (renewal, cancel_at_period_end set) ────
      case 'customer.subscription.updated': {
        const sub = event.data.object
        const userId = sub.metadata?.supabase_user_id
        if (!userId) break

        await updatePISubscription(userId, {
          subscription_status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end
        })

        break
      }

      // ─── Subscription deleted (cancelled, period expired) ─────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const userId = sub.metadata?.supabase_user_id
        if (!userId) break

        await updatePISubscription(userId, {
          membership_tier: 'standard',
          subscription_status: 'canceled',
          stripe_subscription_id: null,
          current_period_end: null,
          cancel_at_period_end: false
        })

        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'subscription_cancelled',
          title: 'Subscription Ended',
          message: 'Your membership has ended. You have reverted to the standard tier.',
          related_type: 'subscription'
        })

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

export const config = {
  api: { bodyParser: false }
}
