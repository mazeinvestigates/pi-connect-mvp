import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const PRICE_IDS = {
  basic_month:    'price_1TOIkm2OuViCaVLFyDBAnNWr',
  basic_year:     'price_1TOIkm2OuViCaVLF1ADIhwVN',
  featured_month: 'price_1TOImL2OuViCaVLFembtxxzg',
  featured_year:  'price_1TOImL2OuViCaVLFQKOK7hid',
  premium_month:  'price_1TOIlE2OuViCaVLFe35cFk6V',
  premium_year:   'price_1TOIlW2OuViCaVLFI9inpMRC',
}

const TIER_ORDER = { basic: 1, featured: 2, premium: 3 }
const TIER_MAP = { basic: 'standard', featured: 'featured', premium: 'premium' }

// Monthly equivalent prices in cents for comparison
const MONTHLY_CENTS = {
  basic_month: 999, basic_year: 833,
  featured_month: 1499, featured_year: 1250,
  premium_month: 1999, premium_year: 1667,
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const { userId, newTier, newInterval, subscriptionId } = req.body

    if (!userId || !newTier || !newInterval || !subscriptionId) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Get current subscription from DB
    const { data: piProfile } = await supabase
      .from('pi_profiles')
      .select('membership_tier, subscription_interval, stripe_subscription_id')
      .eq('user_id', userId)
      .single()

    if (!piProfile) return res.status(404).json({ error: 'PI profile not found' })

    const currentTier = piProfile.membership_tier === 'standard' ? 'basic' : piProfile.membership_tier
    const currentInterval = piProfile.subscription_interval

    const currentRank = TIER_ORDER[currentTier] || 1
    const newRank = TIER_ORDER[newTier] || 1

    const isUpgrade = newRank > currentRank ||
      (newRank === currentRank && currentInterval === 'year' && newInterval === 'month') === false &&
      MONTHLY_CENTS[`${newTier}_${newInterval}`] > MONTHLY_CENTS[`${currentTier}_${currentInterval}`]

    const priceKey = `${newTier}_${newInterval}`
    const newPriceId = PRICE_IDS[priceKey]
    if (!newPriceId) return res.status(400).json({ error: `Invalid tier/interval: ${priceKey}` })

    // Get current subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const currentItemId = subscription.items.data[0]?.id

    if (!currentItemId) return res.status(400).json({ error: 'Could not find subscription item' })

    if (isUpgrade) {
      // UPGRADE — take effect immediately with proration
      const updatedSub = await stripe.subscriptions.update(subscriptionId, {
        items: [{ id: currentItemId, price: newPriceId }],
        proration_behavior: 'create_prorations',
        metadata: { supabase_user_id: userId, tier: newTier, interval: newInterval }
      })

      // Update DB immediately
      await supabase.from('pi_profiles').update({
        membership_tier: TIER_MAP[newTier],
        subscription_interval: newInterval,
        subscription_status: updatedSub.status,
        current_period_end: new Date(updatedSub.current_period_end * 1000).toISOString(),
        cancel_at_period_end: false
      }).eq('user_id', userId)

      return res.status(200).json({
        type: 'upgrade',
        message: `Upgraded to ${newTier} immediately. Prorated charge applied.`,
        effectiveImmediately: true
      })

    } else {
      // DOWNGRADE — schedule for end of current period
      // Store the pending downgrade, keep current plan active
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false, // don't cancel, just schedule price change
        metadata: {
          supabase_user_id: userId,
          pending_tier: newTier,
          pending_interval: newInterval,
          pending_price_id: newPriceId
        }
      })

      // Schedule the price change at period end using a phase
      const currentPeriodEnd = subscription.current_period_end

      await stripe.subscriptionSchedules.create({
        from_subscription: subscriptionId,
        phases: [
          {
            start_date: subscription.current_period_start,
            end_date: currentPeriodEnd,
            items: [{ price: subscription.items.data[0].price.id, quantity: 1 }],
          },
          {
            start_date: currentPeriodEnd,
            items: [{ price: newPriceId, quantity: 1 }],
            metadata: { supabase_user_id: userId, tier: newTier, interval: newInterval }
          }
        ]
      })

      // Record pending downgrade in DB
      await supabase.from('pi_profiles').update({
        cancel_at_period_end: false,
        // Store pending change in metadata — webhook will apply it at period end
      }).eq('user_id', userId)

      const periodEnd = new Date(currentPeriodEnd * 1000).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
      })

      return res.status(200).json({
        type: 'downgrade',
        message: `Your plan will change to ${newTier} on ${periodEnd}. You keep your current benefits until then.`,
        effectiveImmediately: false,
        effectiveDate: new Date(currentPeriodEnd * 1000).toISOString()
      })
    }

  } catch (err) {
    console.error('Change subscription error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
