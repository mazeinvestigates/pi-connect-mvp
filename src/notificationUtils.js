import { supabase } from './supabaseClient'

/**
 * Create a notification for a user
 * @param {string} userId - User ID to notify
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} relatedId - Optional related entity ID
 */
export async function createNotification(userId, type, title, message, relatedId = null) {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        related_id: relatedId,
        read: false
      })

    if (error) throw error
  } catch (error) {
    console.error('Error creating notification:', error)
  }
}

/**
 * Notify PI of new consultation request
 */
export async function notifyNewConsultationRequest(piUserId, clientName, caseTitle) {
  await createNotification(
    piUserId,
    'consultation_request',
    'New Consultation Request',
    `${clientName} has requested a consultation for: ${caseTitle}`
  )
}

/**
 * Notify client of consultation response
 */
export async function notifyConsultationResponse(clientUserId, piName, status) {
  const statusMessages = {
    accepted: `${piName} has accepted your consultation request`,
    contacted: `${piName} has viewed your request and may contact you soon`,
    declined: `${piName} cannot take your case at this time`
  }

  await createNotification(
    clientUserId,
    'consultation_response',
    'Consultation Update',
    statusMessages[status] || `${piName} updated your consultation request`
  )
}

/**
 * Notify when a new message is received
 */
export async function notifyNewMessage(recipientUserId, senderName) {
  await createNotification(
    recipientUserId,
    'new_message',
    'New Message',
    `You have a new message from ${senderName}`
  )
}

/**
 * Notify client of new job application
 */
export async function notifyNewJobApplication(clientUserId, piName, jobTitle) {
  await createNotification(
    clientUserId,
    'job_application',
    'New Job Application',
    `${piName} applied to your job: ${jobTitle}`
  )
}

/**
 * Notify PI of application status change
 */
export async function notifyApplicationStatus(piUserId, jobTitle, status) {
  const statusMessages = {
    accepted: `Congratulations! Your application for "${jobTitle}" was accepted`,
    rejected: `Your application for "${jobTitle}" was not selected this time`
  }

  await createNotification(
    piUserId,
    'application_status',
    'Application Update',
    statusMessages[status] || `Your application status changed for: ${jobTitle}`
  )
}

/**
 * Notify PI of job referral
 */
export async function notifyJobReferral(piUserId, referrerName, jobTitle) {
  await createNotification(
    piUserId,
    'referral_received',
    'Job Referral',
    `${referrerName} referred you to a job: ${jobTitle}`
  )
}

/**
 * Notify referrer that their referral was accepted
 */
export async function notifyReferralAccepted(referrerUserId, piName, jobTitle) {
  await createNotification(
    referrerUserId,
    'referral_accepted',
    'Referral Accepted',
    `${piName} accepted your referral for: ${jobTitle}`
  )
}

/**
 * Notify PIs of new job posting (optional - can be selective based on location/specialty)
 */
export async function notifyNewJob(piUserId, jobTitle, location) {
  await createNotification(
    piUserId,
    'new_job',
    'New Job Posted',
    `New job in ${location}: ${jobTitle}`
  )
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId) {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)

    if (error) throw error
    return count || 0
  } catch (error) {
    console.error('Error getting unread count:', error)
    return 0
  }
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)

    if (error) throw error
  } catch (error) {
    console.error('Error marking notification as read:', error)
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)

    if (error) throw error
  } catch (error) {
    console.error('Error marking all as read:', error)
  }
}

/**
 * Delete old notifications (optional maintenance function)
 */
export async function deleteOldNotifications(userId, daysOld = 30) {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
      .eq('read', true)
      .lt('created_at', cutoffDate.toISOString())

    if (error) throw error
  } catch (error) {
    console.error('Error deleting old notifications:', error)
  }
}
