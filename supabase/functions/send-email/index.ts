// Supabase Edge Function: send-email
// Deploy with: supabase functions deploy send-email
// Set secret: supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
//
// Called by database triggers or directly from the app when email sending is needed.
// Handles all transactional email types for PI Connect.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = 'noreply@piconnect.co'
const PLATFORM_NAME = 'PI Connect'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Email templates
const templates = {
  new_message: ({ recipientName, senderName }) => ({
    subject: `New message from ${senderName} — PI Connect`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">New Message</h2>
        <p>Hi ${recipientName},</p>
        <p><strong>${senderName}</strong> sent you a message on PI Connect.</p>
        <p>Log in to view and reply.</p>
        <a href="https://pi-connect-mvp.vercel.app?page=messages" style="display:inline-block;background:#667eea;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">
          View Message
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px;">You're receiving this because you have message notifications enabled. Manage preferences in your account settings.</p>
      </div>
    `
  }),

  job_application: ({ recipientName, piName, jobTitle }) => ({
    subject: `New application for "${jobTitle}" — PI Connect`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">New Job Application</h2>
        <p>Hi ${recipientName},</p>
        <p><strong>${piName}</strong> has applied to your job: <strong>${jobTitle}</strong>.</p>
        <p>Log in to review their application and proposal.</p>
        <a href="https://piconnect.com" style="display:inline-block;background:#667eea;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">
          Review Application
        </a>
      </div>
    `
  }),

  application_accepted: ({ recipientName, jobTitle, clientName }) => ({
    subject: `Your application was accepted — ${jobTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Application Accepted! 🎉</h2>
        <p>Hi ${recipientName},</p>
        <p><strong>${clientName}</strong> has accepted your application for: <strong>${jobTitle}</strong>.</p>
        <p>Log in to message your client and get started.</p>
        <a href="https://pi-connect-mvp.vercel.app?page=jobs&tab=my-jobs" style="display:inline-block;background:#667eea;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">
          Go to My Jobs
        </a>
      </div>
    `
  }),

  payment_confirmation: ({ recipientName, amount, jobTitle, role }) => ({
    subject: `Payment ${role === 'client' ? 'confirmed' : 'received'} — ${jobTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">Payment ${role === 'client' ? 'Confirmed' : 'Received'}</h2>
        <p>Hi ${recipientName},</p>
        ${role === 'client'
          ? `<p>Your payment of <strong>$${amount}</strong> for <strong>${jobTitle}</strong> has been processed successfully.</p>`
          : `<p>You've received a payment of <strong>$${amount}</strong> for <strong>${jobTitle}</strong>.</p>`
        }
        <p>View your full transaction history in the Payments section.</p>
        <a href="https://pi-connect-mvp.vercel.app?page=transactions" style="display:inline-block;background:#667eea;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">
          View Transactions
        </a>
      </div>
    `
  }),

  consultation_request: ({ recipientName, requesterName, caseType, budget }) => ({
    subject: `New consultation request — PI Connect`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">New Consultation Request</h2>
        <p>Hi ${recipientName},</p>
        <p><strong>${requesterName}</strong> has requested a consultation with you.</p>
        <p><strong>Case type:</strong> ${caseType || 'Not specified'}<br>
           <strong>Budget:</strong> ${budget || 'Not specified'}</p>
        <a href="https://piconnect.com" style="display:inline-block;background:#667eea;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">
          View Request
        </a>
      </div>
    `
  }),

  subcontract_offer: ({ recipientName, jobTitle, primaryPIName, rate }) => ({
    subject: `New subcontract offer — PI Connect`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">New Subcontract Offer</h2>
        <p>Hi ${recipientName},</p>
        <p><strong>${primaryPIName}</strong> has offered you a subcontract position for: <strong>${jobTitle}</strong>.</p>
        ${rate ? `<p><strong>Rate:</strong> ${rate}</p>` : ''}
        <p>Log in to review the job details and accept or decline.</p>
        <a href="https://piconnect.com" style="display:inline-block;background:#667eea;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">
          View Offer
        </a>
      </div>
    `
  }),

  referral_offer: ({ recipientName, jobTitle, referringPIName, referralPct }) => ({
    subject: `New job referral — PI Connect`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">New Job Referral</h2>
        <p>Hi ${recipientName},</p>
        <p><strong>${referringPIName}</strong> has referred a job to you: <strong>${jobTitle}</strong>.</p>
        ${referralPct ? `<p>A <strong>${referralPct}% referral fee</strong> will be owed upon completion.</p>` : ''}
        <p>Log in to see the handoff note and accept or decline. Full client details are revealed upon acceptance.</p>
        <a href="https://piconnect.com" style="display:inline-block;background:#667eea;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">
          View Referral
        </a>
      </div>
    `
  }),

  report_submitted: ({ recipientName, jobTitle }) => ({
    subject: `Report ready for review — ${jobTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">Report Submitted for Review</h2>
        <p>Hi ${recipientName},</p>
        <p>Your subcontractor has submitted a report for <strong>${jobTitle}</strong>. Please review and either approve it or request revisions.</p>
        <a href="https://piconnect.com" style="display:inline-block;background:#667eea;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">
          Review Report
        </a>
      </div>
    `
  }),

  revision_requested: ({ recipientName, jobTitle, notes }) => ({
    subject: `Report revisions requested — ${jobTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f97316;">Revision Requested</h2>
        <p>Hi ${recipientName},</p>
        <p>The primary PI has requested revisions to your report for <strong>${jobTitle}</strong>.</p>
        ${notes ? `<div style="background:#fff7ed;border-left:3px solid #f97316;padding:12px;margin:16px 0;"><strong>Notes:</strong><br>${notes}</div>` : ''}
        <a href="https://piconnect.com" style="display:inline-block;background:#667eea;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">
          Submit Revision
        </a>
      </div>
    `
  }),

  review_posted: ({ recipientName, reviewerName, rating }) => ({
    subject: `New review from ${reviewerName} — PI Connect`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">New Review Posted</h2>
        <p>Hi ${recipientName},</p>
        <p><strong>${reviewerName}</strong> left you a <strong>${rating}-star review</strong> on PI Connect.</p>
        <a href="https://piconnect.co" style="display:inline-block;background:#667eea;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">
          View Review
        </a>
      </div>
    `
  }),

  pi_verified: ({ recipientName }) => ({
    subject: `You're verified! Your PI Connect profile is now live`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">You're Verified! 🎉</h2>
        <p>Hi ${recipientName},</p>
        <p>Great news — your PI Connect profile has been reviewed and approved. You're now fully verified and ready to start connecting with clients.</p>
        <p><strong>What you can do now:</strong></p>
        <ul>
          <li>Apply to open jobs in the marketplace</li>
          <li>Message clients directly</li>
          <li>Accept consultation requests</li>
          <li>Offer and accept subcontract work</li>
        </ul>
        <a href="https://pi-connect-mvp.vercel.app?page=dashboard" style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">
          Go to My Dashboard
        </a>
      </div>
    `
  }),

  invoice_sent: ({ recipientName, jobTitle, amount, notes }) => ({
    subject: `Invoice received for ${jobTitle} — PI Connect`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">Invoice Ready for Payment</h2>
        <p>Hi ${recipientName},</p>
        <p>Your PI has completed work on <strong>${jobTitle}</strong> and sent you an invoice.</p>
        ${amount ? `<p><strong>Amount due: $${amount}</strong></p>` : ''}
        ${notes ? `<div style="background:#f9fafb;border-left:3px solid #667eea;padding:12px;margin:16px 0;"><strong>Note from PI:</strong><br>${notes}</div>` : ''}
        <p>Log in to your dashboard to review and pay.</p>
        <a href="https://pi-connect-mvp.vercel.app?page=dashboard" style="display:inline-block;background:#667eea;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">
          Pay Invoice
        </a>
      </div>
    `
  }),

  job_match: ({ recipientName, jobTitle, jobLocation, jobType, budgetMin, budgetMax, jobId }) => ({
    subject: `New job match: ${jobTitle} — PI Connect`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">New Job Match 🎯</h2>
        <p>Hi ${recipientName},</p>
        <p>A new job matching your specialties was just posted on PI Connect.</p>
        <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="font-weight:600;font-size:16px;margin:0 0 8px;">${jobTitle}</p>
          <p style="margin:4px 0;color:#6b7280;">📍 ${jobLocation}</p>
          <p style="margin:4px 0;color:#6b7280;">🔍 ${jobType}</p>
          ${budgetMin && budgetMax ? `<p style="margin:4px 0;color:#6b7280;">💰 $${budgetMin} – $${budgetMax}</p>` : ''}
        </div>
        <a href="https://pi-connect-mvp.vercel.app?page=jobs" style="display:inline-block;background:#667eea;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">
          View & Apply
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px;">You're receiving this because you have job match notifications enabled. Manage preferences in your account settings.</p>
      </div>
    `
  }),

  contract_signed: ({ recipientName, clientName, clientEmail, jobTitle, signedAt, contractType }) => ({
    subject: `Contract signed by ${clientName} — ${jobTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Contract Accepted ✓</h2>
        <p>Hi ${recipientName},</p>
        <p><strong>${clientName}</strong> has accepted and signed the engagement contract for:</p>
        <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="font-weight:600;margin:0 0 8px;">${jobTitle}</p>
          <p style="margin:4px 0;color:#6b7280;font-size:14px;">Contract type: ${contractType === 'platform' ? 'PI Connect Standard Agreement' : 'Custom contract (uploaded)'}</p>
          <p style="margin:4px 0;color:#6b7280;font-size:14px;">Signed by: ${clientName}</p>
          <p style="margin:4px 0;color:#6b7280;font-size:14px;">Signed at: ${signedAt}</p>
        </div>
        <p style="font-size:13px;color:#374151;">This email serves as your acceptance record. The timestamp and client identity have been recorded in PI Connect and are available in your job dashboard at any time.</p>
        <a href="https://pi-connect-mvp.vercel.app?page=jobs&tab=my-jobs" style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">
          Go to My Jobs
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px;">PI Connect — piconnect.co</p>
      </div>
    `
  }),

  contract_declined: ({ recipientName, clientName, jobTitle, reason }) => ({
    subject: `Contract declined by ${clientName} — ${jobTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Contract Declined</h2>
        <p>Hi ${recipientName},</p>
        <p><strong>${clientName}</strong> has declined the engagement contract for <strong>${jobTitle}</strong>.</p>
        ${reason ? `<div style="background:#fef2f2;border-left:3px solid #dc2626;padding:12px;margin:16px 0;"><strong>Reason:</strong><br>${reason}</div>` : ''}
        <p>The job has been returned to open status. You may repost it or reach out to the client directly to discuss the terms.</p>
        <a href="https://pi-connect-mvp.vercel.app" style="display:inline-block;background:#667eea;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">
          View Jobs
        </a>
      </div>
    `
  }),

  pi_rejected: ({ recipientName, notes }) => ({
    subject: `Update on your PI Connect verification`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Verification Update</h2>
        <p>Hi ${recipientName},</p>
        <p>After reviewing your application, we were unable to verify your credentials at this time.</p>
        ${notes ? `
        <div style="background:#fef2f2;border-left:3px solid #dc2626;padding:12px;margin:16px 0;">
          <strong>Reason:</strong><br>${notes}
        </div>` : ''}
        <p>If you believe this is an error or would like to resubmit with updated documentation, please update your profile and contact us.</p>
        <a href="https://pi-connect-mvp.vercel.app?page=profile-edit" style="display:inline-block;background:#667eea;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px;">
          Update My Profile
        </a>
      </div>
    `
  }),
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, type, data } = await req.json()

    if (!to || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const template = templates[type]
    if (!template) {
      return new Response(
        JSON.stringify({ error: `Unknown email type: ${type}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { subject, html } = template(data || {})

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${PLATFORM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || 'Resend API error')
    }

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
