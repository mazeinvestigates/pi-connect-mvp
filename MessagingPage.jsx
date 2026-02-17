import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import ConversationsList from '../components/ConversationsList'
import MessageThread from '../components/MessageThread'

export default function MessagingPage({ user, onNavigate }) {
  const [conversations, setConversations] = useState([])
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user) {
      loadConversations()
      
      // Subscribe to real-time conversation updates
      const channel = supabase
        .channel('conversations-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
            filter: `participant_1=eq.${user.id}`
          },
          () => loadConversations()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
            filter: `participant_2=eq.${user.id}`
          },
          () => loadConversations()
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [user])

  const loadConversations = async () => {
    try {
      setLoading(true)
      
      // Get all conversations where user is a participant
      const { data: convos, error: convosError } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order('last_message_at', { ascending: false })

      if (convosError) throw convosError

      // For each conversation, get the other participant's info and unread count
      const conversationsWithDetails = await Promise.all(
        (convos || []).map(async (convo) => {
          const otherUserId = convo.participant_1 === user.id 
            ? convo.participant_2 
            : convo.participant_1

          // Get other user's profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('user_id', otherUserId)
            .single()

          // Check if they're a PI
          const { data: piProfile } = await supabase
            .from('pi_profiles')
            .select('first_name, last_name, company_name')
            .eq('user_id', otherUserId)
            .maybeSingle()

          // Get unread count
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', convo.id)
            .eq('read', false)
            .neq('sender_id', user.id)

          // Get last message
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('content, created_at, sender_id')
            .eq('conversation_id', convo.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          return {
            ...convo,
            otherUserId,
            otherUserName: piProfile 
              ? `${piProfile.first_name} ${piProfile.last_name}${piProfile.company_name ? ` (${piProfile.company_name})` : ''}`
              : profile?.full_name || profile?.email || 'Unknown User',
            unreadCount: unreadCount || 0,
            lastMessage: lastMessage || null
          }
        })
      )

      setConversations(conversationsWithDetails)
    } catch (err) {
      console.error('Error loading conversations:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation)
  }

  const handleBackToList = () => {
    setSelectedConversation(null)
    loadConversations() // Refresh to update unread counts
  }

  if (!user) {
    return (
      <div className="messaging-page">
        <div className="empty-state">
          <h2>Sign in to view messages</h2>
          <button onClick={() => onNavigate('auth')} className="btn-primary">
            Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="messaging-page">
      <div className="messaging-container">
        {selectedConversation ? (
          <MessageThread
            conversation={selectedConversation}
            currentUser={user}
            onBack={handleBackToList}
          />
        ) : (
          <ConversationsList
            conversations={conversations}
            loading={loading}
            error={error}
            onSelectConversation={handleSelectConversation}
            onRefresh={loadConversations}
          />
        )}
      </div>
    </div>
  )
}
