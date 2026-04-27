import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TIER_MAP = { basic: 'standard', premium: 'premium' }

async function updatePISubscription(userId, updates) {
  await supabase.from('pi_profiles').update(updates).eq('user_id', userId)
}

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => {
      chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk))
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const sig = req.headers['stripe-signature']

  let event
  try {
    const buf = await buffer(req)
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook error:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    switch (event.type) {

      case 'payment_intent.succeeded': {
        const piIntent = event.data.object
        // Handle AI credit purchases
        if (piIntent.metadata?.feature === 'ai_credits') {
          const userId = piIntent.metadata?.supabase_user_id
          const quantity = parseInt(piIntent.metadata?.quantity || '1')
          if (userId) {
            const { data: pi } = await supabase.from('pi_profiles').select('ai_credits_balance').eq('user_id', userId).single()
            await supabase.from('pi_profiles').update({
              ai_credits_balance: (pi?.ai_credits_balance || 0) + quantity
            }).eq('user_id', userId)
            await supabase.from('notifications').insert({
              user_id: userId,
              type: 'ai_credits_purchased',
              title: 'AI Credits Added',
              message: `${quantity} AI credit${quantity !== 1 ? 's' : ''} added to your account.`,
              related_type: 'ai'
            })
          }
          break
        }

        // Handle job payments (existing logic below)
        const pi = piIntent
        const { job_id, pi_id, client_id } = pi.metadata
        await supabase.from('transactions').update({ status: 'completed' }).eq('stripe_payment_intent_id', pi.id)
        if (job_id && pi_id) await supabase.from('job_applications').update({ payment_status: 'paid' }).eq('job_id', job_id).eq('applicant_id', pi_id)
        if (pi_id) await supabase.from('notifications').insert({ user_id: pi_id, type: 'payment_received', title: 'Payment Received', message: `Payment of $${(pi.amount / 100).toFixed(2)} received.`, related_id: job_id, related_type: 'job' })
        if (client_id) await supabase.from('notifications').insert({ user_id: client_id, type: 'payment_confirmed', title: 'Payment Confirmed', message: `Payment of $${(pi.amount / 100).toFixed(2)} processed.`, related_id: job_id, related_type: 'job' })
        break
      }

      case 'payment_intent.payment_failed': {
        await supabase.from('transactions').update({ status: 'failed' }).eq('stripe_payment_intent_id', event.data.object.id)
        break
      }

      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode !== 'subscription') break
        const userId = session.metadata?.supabase_user_id
        const tier = session.metadata?.tier
        const interval = session.metadata?.interval
        if (!userId || !tier) break

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

        await supabase.from('notifications').insert({ user_id: userId, type: 'subscription_activated', title: 'Subscription Activated', message: `Your ${tier.charAt(0).toUpperCase() + tier.slice(1)} membership is now active.`, related_type: 'subscription' })

        const { data: referral } = await supabase
          .from('subscription_referrals')
          .select('*, referring_pi:referring_pi_id (stripe_customer_id, stripe_subscription_id)')
          .eq('referred_pi_id', userId).eq('status', 'pending').maybeSingle()

        if (referral?.referring_pi?.stripe_customer_id) {
          try {
            let creditCents = referral.credit_amount_cents
            if (referral.referring_pi.stripe_subscription_id) {
              const rs = await stripe.subscriptions.retrieve(referral.referring_pi.stripe_subscription_id)
              const p = rs.items.data[0]?.price
              if (p) creditCents = p.recurring?.interval === 'year' ? Math.round(p.unit_amount / 12) : p.unit_amount
            }
            await stripe.customers.createBalanceTransaction(referral.referring_pi.stripe_customer_id, { amount: -creditCents, currency: 'usd', description: `Referral bonus — ${referral.referred_pi_email} subscribed` })
            await supabase.from('subscription_referrals').update({ status: 'credited', credited_at: new Date().toISOString(), credit_amount_cents: creditCents }).eq('id', referral.id)
            await supabase.from('notifications').insert({ user_id: referral.referring_pi_id, type: 'referral_bonus', title: 'Referral Bonus Earned!', message: `${referral.referred_pi_email} subscribed. A $${(creditCents/100).toFixed(2)} credit applied.`, related_type: 'subscription' })
          } catch (err) { console.error('Referral credit error:', err.message) }
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const userId = sub.metadata?.supabase_user_id
        if (!userId) break
        await updatePISubscription(userId, { subscription_status: sub.status, current_period_end: new Date(sub.current_period_end * 1000).toISOString(), cancel_at_period_end: sub.cancel_at_period_end })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const userId = sub.metadata?.supabase_user_id
        if (!userId) break
        await updatePISubscription(userId, { membership_tier: 'standard', subscription_status: 'canceled', stripe_subscription_id: null, current_period_end: null, cancel_at_period_end: false })
        await supabase.from('notifications').insert({ user_id: userId, type: 'subscription_cancelled', title: 'Subscription Ended', message: 'Your membership has ended and reverted to standard.', related_type: 'subscription' })
        break
      }

      default:
        console.log(`Unhandled: ${event.type}`)
    }

    res.status(200).json({ received: true })
  } catch (err) {
    console.error('Handler error:', err)
    res.status(500).json({ error: err.message })
  }
}
