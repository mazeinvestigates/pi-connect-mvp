import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const { paymentIntentId, reason, jobId, piUserId, workStarted = false } = req.body

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'paymentIntentId is required' })
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment has not been captured yet' })
    }

    const totalCents = paymentIntent.amount

    // Option A — cancelled before work started:
    // Reverse the transfer to PI first, then issue full refund to client
    // Platform absorbs the fee loss

    // Option B — cancelled after work started:
    // PI keeps what they've earned, client receives no automatic refund
    // Refund is handled directly between PI and client

    if (!workStarted && piUserId) {
      // Look up the transfer to reverse
      const { data: transaction } = await supabase
        .from('transactions')
        .select('payout_transfer_id, payout_amount_cents')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle()

      if (transaction?.payout_transfer_id) {
        try {
          // Reverse the transfer from PI's Connect account back to platform
          await stripe.transfers.createReversal(transaction.payout_transfer_id, {
            amount: transaction.payout_amount_cents,
            metadata: {
              reason: reason || 'Job cancelled before work started',
              job_id: jobId || ''
            }
          })
          console.log(`Transfer ${transaction.payout_transfer_id} reversed — $${(transaction.payout_amount_cents / 100).toFixed(2)} returned to platform`)

          // Update transaction record
          await supabase.from('transactions')
            .update({ payout_status: 'reversed' })
            .eq('stripe_payment_intent_id', paymentIntentId)

        } catch (reverseErr) {
          console.error('Transfer reversal error:', reverseErr.message)
          // Continue with refund even if reversal fails — log for manual review
        }
      }

      // Always notify PI of cancellation regardless of transfer status
      const refundAmountDollars = (totalCents / 100).toFixed(2)
      await supabase.from('notifications').insert({
        user_id: piUserId,
        type: 'job_cancelled',
        title: 'Job Cancelled by Client',
        message: `The client has cancelled this job. The retainer of $${refundAmountDollars} has been refunded to the client and your payout has been reversed. The job has been moved to your archive.`
      })
    }

    if (workStarted) {
      // Option B — work has started, no automatic refund
      // Return instructions for PI to handle directly
      return res.status(200).json({
        refundId: null,
        status: 'manual_required',
        message: 'Work has already started. The PI must issue the refund directly from their Stripe account. Contact support if assistance is needed.',
        workStarted: true
      })
    }

    // Issue full refund to client
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer',
      metadata: {
        reason: reason || 'Job cancelled',
        job_id: jobId || '',
        work_started: String(workStarted)
      }
    })

    return res.status(200).json({
      refundId: refund.id,
      status: refund.status,
      amount: refund.amount,
      workStarted: false
    })

  } catch (err) {
    console.error('Refund error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
