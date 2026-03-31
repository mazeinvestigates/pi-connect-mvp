import { supabase } from './supabaseClient'

const EDGE_FUNCTION_URL = 'https://kpgcnqvlfbxhhtyhfxop.supabase.co/functions/v1/send-email'

// Map email type to preference key
const PREF_KEY_MAP = {
  new_message: 'new_messages',
  job_application: 'job_applications',
  application_accepted: 'job_applications',
  payment_confirmation: 'payment_confirmations',
  invoice_sent: 'invoice_sent',
  job_match: 'job_matches',
  consultation_request: 'consultation_requests',
  subcontract_offer: 'referrals',
  referral_offer: 'referrals',
  review_posted: 'reviews',
  pi_verified: 'admin_actions',
  pi_rejected: 'admin_actions',
}

// Check user's email preference for a given type
async function checkPreference(userId, emailType) {
  try {
    const prefKey = PREF_KEY_MAP[emailType]
    if (!prefKey) return true // unknown type — send by default

    const { data } = await supabase
      .from('profiles')
      .select('email_preferences')
      .eq('user_id', userId)
      .single()

    if (!data?.email_preferences) return true // no prefs set — send by default
    return data.email_preferences[prefKey] !== false
  } catch {
    return true // on error, default to sending
  }
}

// Core send function
async function sendEmail(to, type, data) {
  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, type, data })
    })
    const result = await response.json()
    if (!response.ok) console.warn('Email send failed:', result)
    return result
  } catch (err) {
    console.warn('Email send error (non-fatal):', err.message)
  }
}

// Send email respecting user preferences
async function sendEmailIfEnabled(userId, to, type, data) {
  const enabled = await checkPreference(userId, type)
  if (!enabled) return
  return sendEmail(to, type, data)
}

// ─── Specific email senders ───────────────────────────────────────────────────

export async function sendPaymentConfirmationEmails({ clientId, clientEmail, clientName, piId, piEmail, piName, jobTitle, clientAmount, piAmount }) {
  await Promise.all([
    sendEmailIfEnabled(clientId, clientEmail, 'payment_confirmation', {
      recipientName: clientName,
      amount: clientAmount,
      jobTitle,
      role: 'client'
    }),
    sendEmailIfEnabled(piId, piEmail, 'payment_confirmation', {
      recipientName: piName,
      amount: piAmount,
      jobTitle,
      role: 'pi'
    })
  ])
}

export async function sendInvoiceSentEmail({ clientId, clientEmail, clientName, jobTitle, amount, notes }) {
  await sendEmailIfEnabled(clientId, clientEmail, 'invoice_sent', {
    recipientName: clientName,
    jobTitle,
    amount,
    notes
  })
}

// Haversine distance in miles between two lat/lng points
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8 // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Geocode a location string using Nominatim
async function geocodeLocation(locationStr) {
  try {
    const encoded = encodeURIComponent(locationStr + ', USA')
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`, {
      headers: { 'User-Agent': 'PIConnect/1.0' }
    })
    const data = await res.json()
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
  } catch {}
  return null
}

export async function sendJobMatchEmails({ job }) {
  try {
    // Geocode the job location first
    const jobCoords = await geocodeLocation(job.location || `${job.city}, ${job.state}`)

    // Find verified PIs whose specialties match
    const { data: pis } = await supabase
      .from('pi_profiles')
      .select('user_id, first_name, specialties, email, city, state, notification_radius_miles')
      .eq('is_verified', true)
      .contains('specialties', job.investigation_type ? [job.investigation_type] : [])

    if (!pis?.length) return

    // Filter by distance and send emails
    const emailPromises = []
    for (const pi of pis) {
      const radius = pi.notification_radius_miles || 100
      
      // Nationwide option (-1) gets all jobs
      if (radius === -1) {
        emailPromises.push(
          sendEmailIfEnabled(pi.user_id, pi.email, 'job_match', {
            recipientName: pi.first_name,
            jobTitle: job.title,
            jobLocation: job.location,
            jobType: job.investigation_type,
            budgetMin: job.budget_min,
            budgetMax: job.budget_max
          })
        )
        continue
      }

      // Check distance if we have job coords and PI location
      if (jobCoords && pi.city && pi.state) {
        const piCoords = await geocodeLocation(`${pi.city}, ${pi.state}`)
        if (piCoords) {
          const distance = haversineDistance(jobCoords.lat, jobCoords.lon, piCoords.lat, piCoords.lon)
          if (distance > radius) continue // skip — too far
        }
      }

      emailPromises.push(
        sendEmailIfEnabled(pi.user_id, pi.email, 'job_match', {
          recipientName: pi.first_name,
          jobTitle: job.title,
          jobLocation: job.location,
          jobType: job.investigation_type,
          budgetMin: job.budget_min,
          budgetMax: job.budget_max
        })
      )
    }

    await Promise.all(emailPromises)
  } catch (err) {
    console.warn('Job match email error (non-fatal):', err.message)
  }
}

export async function sendNewMessageEmail(recipientId, recipientEmail, senderName, messagePreview) {
  await sendEmailIfEnabled(recipientId, recipientEmail, 'new_message', {
    recipientName: recipientEmail.split('@')[0],
    senderName,
    messagePreview
  })
}
