import { supabase } from './supabaseClient'

// Email template wrapper
const emailTemplate = (content, actionUrl = null, actionText = null) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PI Connect</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">PI Connect</h1>
              <p style="margin: 5px 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">Private Investigator Marketplace</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              ${content}
            </td>
          </tr>
          
          <!-- Action Button (if provided) -->
          ${actionUrl && actionText ? `
          <tr>
            <td style="padding: 0 30px 30px; text-align: center;">
              <a href="${actionUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                ${actionText}
              </a>
            </td>
          </tr>
          ` : ''}
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px 30px; border-top: 1px solid #e0e0e0; text-align: center;">
              <p style="margin: 0 0 10px; color: #666; font-size: 12px;">
                © 2026 PI Connect. All rights reserved.
              </p>
              <p style="margin: 0; color: #999; font-size: 11px;">
                <a href="https://pi-connect-mvp.vercel.app/settings" style="color: #667eea; text-decoration: none;">Email Preferences</a>
                •
                <a href="https://pi-connect-mvp.vercel.app/unsubscribe" style="color: #667eea; text-decoration: none;">Unsubscribe</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

// Queue an email (stored in database, will be sent by backend service)
export async function queueEmail({
  userId,
  emailType,
  recipientEmail,
  subject,
  content,
  actionUrl = null,
  actionText = null,
  relatedId = null,
  relatedType = null
}) {
  try {
    const bodyHtml = emailTemplate(content, actionUrl, actionText)
    
    // Call database function to queue email
    const { data, error } = await supabase.rpc('queue_email', {
      p_user_id: userId,
      p_email_type: emailType,
      p_recipient_email: recipientEmail,
      p_subject: subject,
      p_body_html: bodyHtml,
      p_body_text: subject, // Plain text fallback
      p_related_id: relatedId,
      p_related_type: relatedType
    })

    if (error) throw error
    
    return { success: true, emailId: data }
  } catch (error) {
    console.error('Error queueing email:', error)
    return { success: false, error: error.message }
  }
}

// Email notification functions for different events

export async function sendNewMessageEmail(recipientUserId, recipientEmail, senderName, messagePreview) {
  return queueEmail({
    userId: recipientUserId,
    emailType: 'new_message',
    recipientEmail,
    subject: `New message from ${senderName}`,
    content: `
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">You have a new message</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 15px; line-height: 1.6;">
        <strong>${senderName}</strong> sent you a message:
      </p>
      <div style="background-color: #f9f9f9; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #444; font-size: 14px; font-style: italic;">
          "${messagePreview}${messagePreview.length > 100 ? '...' : ''}"
        </p>
      </div>
      <p style="margin: 20px 0 0; color: #666; font-size: 15px;">
        Click below to view and reply to this message.
      </p>
    `,
    actionUrl: 'https://pi-connect-mvp.vercel.app/messages',
    actionText: 'View Message'
  })
}

export async function sendNewJobEmail(piUserId, piEmail, jobTitle, jobLocation, budget) {
  return queueEmail({
    userId: piUserId,
    emailType: 'new_job',
    recipientEmail: piEmail,
    subject: `New job opportunity: ${jobTitle}`,
    content: `
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">New Job Opportunity</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 15px; line-height: 1.6;">
        A new job has been posted that matches your expertise:
      </p>
      <div style="background-color: #f0f4ff; padding: 20px; margin: 20px 0; border-radius: 8px;">
        <h3 style="margin: 0 0 10px; color: #667eea; font-size: 18px;">${jobTitle}</h3>
        <p style="margin: 5px 0; color: #666; font-size: 14px;">
          📍 <strong>Location:</strong> ${jobLocation}
        </p>
        <p style="margin: 5px 0; color: #666; font-size: 14px;">
          💰 <strong>Budget:</strong> ${budget}
        </p>
      </div>
      <p style="margin: 20px 0 0; color: #666; font-size: 15px;">
        Apply now to secure this opportunity.
      </p>
    `,
    actionUrl: 'https://pi-connect-mvp.vercel.app/jobs',
    actionText: 'View Job & Apply'
  })
}

export async function sendJobApplicationEmail(clientUserId, clientEmail, piName, jobTitle) {
  return queueEmail({
    userId: clientUserId,
    emailType: 'job_application',
    recipientEmail: clientEmail,
    subject: `New application for: ${jobTitle}`,
    content: `
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">You received a new application</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 15px; line-height: 1.6;">
        <strong>${piName}</strong> has applied to your job posting:
      </p>
      <div style="background-color: #f0f4ff; padding: 20px; margin: 20px 0; border-radius: 8px;">
        <h3 style="margin: 0; color: #667eea; font-size: 18px;">${jobTitle}</h3>
      </div>
      <p style="margin: 20px 0 0; color: #666; font-size: 15px;">
        Review their proposal and credentials to make your decision.
      </p>
    `,
    actionUrl: 'https://pi-connect-mvp.vercel.app/dashboard',
    actionText: 'Review Application'
  })
}

export async function sendPaymentConfirmationEmail(userId, userEmail, amount, piName, jobTitle) {
  return queueEmail({
    userId,
    emailType: 'payment_confirmation',
    recipientEmail: userEmail,
    subject: `Payment confirmation - $${amount}`,
    content: `
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Payment Successful</h2>
      <p style="margin: 0 0 15px; color: #10b981; font-size: 18px; font-weight: bold;">
        ✓ Your payment of $${amount} has been processed
      </p>
      <div style="background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 8px; border: 1px solid #e0e0e0;">
        <p style="margin: 0 0 10px; color: #666; font-size: 14px;">
          <strong>Job:</strong> ${jobTitle}
        </p>
        <p style="margin: 0 0 10px; color: #666; font-size: 14px;">
          <strong>PI:</strong> ${piName}
        </p>
        <p style="margin: 0; color: #666; font-size: 14px;">
          <strong>Amount:</strong> $${amount}
        </p>
      </div>
      <p style="margin: 20px 0 0; color: #666; font-size: 15px;">
        View your transaction history for details.
      </p>
    `,
    actionUrl: 'https://pi-connect-mvp.vercel.app/transactions',
    actionText: 'View Transaction'
  })
}

export async function sendReviewNotificationEmail(piUserId, piEmail, reviewerName, rating, jobTitle) {
  const stars = '⭐'.repeat(rating)
  
  return queueEmail({
    userId: piUserId,
    emailType: 'review_notification',
    recipientEmail: piEmail,
    subject: `New ${rating}-star review from ${reviewerName}`,
    content: `
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">You received a new review</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 15px; line-height: 1.6;">
        <strong>${reviewerName}</strong> left you a review:
      </p>
      <div style="background-color: #fffbeb; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #fbbf24;">
        <p style="margin: 0 0 10px; font-size: 24px;">${stars}</p>
        <p style="margin: 0; color: #666; font-size: 14px;">
          For: ${jobTitle}
        </p>
      </div>
      <p style="margin: 20px 0 0; color: #666; font-size: 15px;">
        Great reviews help you attract more clients!
      </p>
    `,
    actionUrl: 'https://pi-connect-mvp.vercel.app/dashboard',
    actionText: 'View Review'
  })
}

export async function sendConsultationRequestEmail(piUserId, piEmail, clientName, caseTitle, location) {
  return queueEmail({
    userId: piUserId,
    emailType: 'consultation_request',
    recipientEmail: piEmail,
    subject: `New consultation request from ${clientName}`,
    content: `
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">New Consultation Request</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 15px; line-height: 1.6;">
        <strong>${clientName}</strong> has requested a consultation:
      </p>
      <div style="background-color: #f0f4ff; padding: 20px; margin: 20px 0; border-radius: 8px;">
        <h3 style="margin: 0 0 10px; color: #667eea; font-size: 18px;">${caseTitle}</h3>
        <p style="margin: 0; color: #666; font-size: 14px;">
          📍 ${location}
        </p>
      </div>
      <p style="margin: 20px 0 0; color: #666; font-size: 15px;">
        Respond quickly to increase your chances of winning this case.
      </p>
    `,
    actionUrl: 'https://pi-connect-mvp.vercel.app/dashboard',
    actionText: 'View & Respond'
  })
}

export async function sendReferralNotificationEmail(piUserId, piEmail, referrerName, jobTitle, location) {
  return queueEmail({
    userId: piUserId,
    emailType: 'referral_notification',
    recipientEmail: piEmail,
    subject: `${referrerName} referred a job to you`,
    content: `
      <h2 style="margin: 0 0 20px; color: #333; font-size: 22px;">Job Referral</h2>
      <p style="margin: 0 0 15px; color: #666; font-size: 15px; line-height: 1.6;">
        <strong>${referrerName}</strong> thinks you'd be perfect for this job:
      </p>
      <div style="background-color: #f0fdf4; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #10b981;">
        <h3 style="margin: 0 0 10px; color: #059669; font-size: 18px;">${jobTitle}</h3>
        <p style="margin: 0; color: #666; font-size: 14px;">
          📍 ${location}
        </p>
      </div>
      <p style="margin: 20px 0 0; color: #666; font-size: 15px;">
        Accept this referral to apply for the job.
      </p>
    `,
    actionUrl: 'https://pi-connect-mvp.vercel.app/referrals',
    actionText: 'View Referral'
  })
}
