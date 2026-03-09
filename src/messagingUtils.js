import { supabase } from './supabaseClient'

/**
 * Get or create a conversation between two users
 * @param {string} currentUserId - Current logged-in user's ID
 * @param {string} otherUserId - The other user's ID
 * @returns {Promise<{id: string}>} - Conversation object with ID
 */
export async function getOrCreateConversation(currentUserId, otherUserId) {
  try {
    // Try to find existing conversation
    // Check both directions since order matters in UNIQUE constraint
    const { data: existing, error: findError } = await supabase
      .from('conversations')
      .select('*')
      .or(`and(participant_1.eq.${currentUserId},participant_2.eq.${otherUserId}),and(participant_1.eq.${otherUserId},participant_2.eq.${currentUserId})`)
      .maybeSingle()

    if (findError && findError.code !== 'PGRST116') {
      throw findError
    }

    if (existing) {
      return existing
    }

    // Create new conversation
    const { data: newConvo, error: createError } = await supabase
      .from('conversations')
      .insert({
        participant_1: currentUserId,
        participant_2: otherUserId
      })
      .select()
      .single()

    if (createError) throw createError

    return newConvo
  } catch (error) {
    console.error('Error in getOrCreateConversation:', error)
    throw error
  }
}

/**
 * Send a message in a conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} senderId - Sender's user ID
 * @param {string} content - Message content
 * @returns {Promise<object>} - Created message object
 */
export async function sendMessage(conversationId, senderId, content) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: content.trim()
      })
      .select()
      .single()

    if (error) throw error

    return data
  } catch (error) {
    console.error('Error sending message:', error)
    throw error
  }
}

/**
 * Get unread message count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Count of unread messages
 */
export async function getUnreadCount(userId) {
  try {
    // Get all conversations where user is a participant
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)

    if (!conversations || conversations.length === 0) {
      return 0
    }

    const conversationIds = conversations.map(c => c.id)

    // Count unread messages in those conversations (not sent by user)
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('conversation_id', conversationIds)
      .eq('read', false)
      .neq('sender_id', userId)

    if (error) throw error

    return count || 0
  } catch (error) {
    console.error('Error getting unread count:', error)
    return 0
  }
}
