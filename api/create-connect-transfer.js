import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const PLATFORM_FEE_PERCENT = 0.10

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const { piUserId, amountCents, jobId, description } = req.body

    if (!piUserId || !amountCents) {
      return res.status(400).json({ error: 'piUserId and amountCents required' })
    }

    const { data: pi } = await supabase
      .from('pi_profiles')
      .select('stripe_connect_id, stripe_connect_enabled')
      .eq('user_id', piUserId)
      .single()

    if (!pi?.stripe_connect_id) {
      return res.status(400).json({
        error: 'PI has not connected their bank account',
        requiresConnect: true
      })
    }

    if (!pi.stripe_connect_enabled) {
      return res.status(400).json({
        error: 'PI payout account is not fully verified',
        requiresConnect: true
      })
    }

    const platformFeeCents = Math.round(amountCents * PLATFORM_FEE_PERCENT)
    const transferCents = amountCents - platformFeeCents

    const transfer = await stripe.transfers.create({
      amount: transferCents,
      currency: 'usd',
      destination: pi.stripe_connect_id,
      description: description || `PI Connect payout — job ${jobId || 'unknown'}`,
      metadata: {
        job_id: jobId || '',
        pi_user_id: piUserId,
        platform_fee_cents: String(platformFeeCents),
        transfer_cents: String(transferCents)
      }
    })

    // Record the transfer in transactions
    if (jobId) {
      await supabase.from('transactions').update({
        payout_transfer_id: transfer.id,
        payout_amount_cents: transferCents,
        platform_fee_cents: platformFeeCents,
        payout_status: 'transferred'
      }).eq('job_id', jobId).eq('user_id', piUserId)

      await supabase.from('notifications').insert({
        user_id: piUserId,
        type: 'payout_sent',
        title: 'Payout Sent',
        message: `$${(transferCents / 100).toFixed(2)} has been transferred to your connected bank account.`
      })
    }

    return res.status(200).json({
      success: true,
      transferId: transfer.id,
      transferCents,
      platformFeeCents
    })
  } catch (err) {
    console.error('Create connect transfer error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
