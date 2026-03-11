// emailSender.js — calls the Supabase Edge Function to send transactional emails
// This replaces the old emailUtils.js which only queued emails to the DB without sending them.
//
// Usage:
//   import { sendEmail } from '../emailSender'
//   await sendEmail('user@example.com', 'new_message', { recipientName: 'John', senderName: 'Jane' })

import { supabase } from './supabaseClient'

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`

export async function sendEmail(to, type, data = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession()

    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ to, type, data })
    })

    if (!response.ok) {
      const err = await response.json()
      console.error('Email send failed:', err)
      return { success: false, error: err.error }
    }

    return { success: true }
  } catch (err) {
    console.error('Email send error:', err)
    return { success: false, error: err.message }
  }
}

// Convenience helpers for common email types

export const emailNotifications = {
  newMessage: (to, recipientName, senderName) =>
    sendEmail(to, 'new_message', { recipientName, senderName }),

  jobApplication: (to, recipientName, piName, jobTitle) =>
    sendEmail(to, 'job_application', { recipientName, piName, jobTitle }),

  applicationAccepted: (to, recipientName, jobTitle, clientName) =>
    sendEmail(to, 'application_accepted', { recipientName, jobTitle, clientName }),

  paymentConfirmation: (to, recipientName, amount, jobTitle, role) =>
    sendEmail(to, 'payment_confirmation', { recipientName, amount, jobTitle, role }),

  consultationRequest: (to, recipientName, requesterName, caseType, budget) =>
    sendEmail(to, 'consultation_request', { recipientName, requesterName, caseType, budget }),

  subcontractOffer: (to, recipientName, jobTitle, primaryPIName, rate) =>
    sendEmail(to, 'subcontract_offer', { recipientName, jobTitle, primaryPIName, rate }),

  referralOffer: (to, recipientName, jobTitle, referringPIName, referralPct) =>
    sendEmail(to, 'referral_offer', { recipientName, jobTitle, referringPIName, referralPct }),

  reportSubmitted: (to, recipientName, jobTitle) =>
    sendEmail(to, 'report_submitted', { recipientName, jobTitle }),

  revisionRequested: (to, recipientName, jobTitle, notes) =>
    sendEmail(to, 'revision_requested', { recipientName, jobTitle, notes }),

  reviewPosted: (to, recipientName, reviewerName, rating) =>
    sendEmail(to, 'review_posted', { recipientName, reviewerName, rating }),
}
