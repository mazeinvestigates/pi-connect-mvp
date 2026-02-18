import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { filterMessageContent, getWarningMessage } from '../contentFilter'

export default function MessageThread({ conversation, currentUser, onBack }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [filterWarning, setFilterWarning] = useState(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    loadMessages()
    markMessagesAsRead()

    // Subscribe to new messages in real-time
    const channel = supabase
      .channel(`messages-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new])
          scrollToBottom()
          
          // Mark as read if not from current user
          if (payload.new.sender_id !== currentUser.id) {
            markMessageAsRead(payload.new.id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversation.id, currentUser.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadMessages = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const markMessagesAsRead = async () => {
    try {
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('conversation_id', conversation.id)
        .eq('read', false)
        .neq('sender_id', currentUser.id)
    } catch (error) {
      console.error('Error marking messages as read:', error)
    }
  }

  const markMessageAsRead = async (messageId) => {
    try {
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('id', messageId)
    } catch (error) {
      console.error('Error marking message as read:', error)
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    
    if (!newMessage.trim()) return

    setSending(true)
    setFilterWarning(null)
    
    try {
      // Filter the message content
      const filterResult = filterMessageContent(newMessage.trim())
      
      // Show warning if content was filtered
      if (filterResult.wasFiltered) {
        const warning = getWarningMessage(filterResult.blockedItems)
        setFilterWarning(warning)
        
        // Auto-hide warning after 5 seconds
        setTimeout(() => setFilterWarning(null), 5000)
      }

      // Send the filtered message
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: currentUser.id,
          content: filterResult.filtered // Use filtered content
        })

      if (error) throw error

      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const formatDateDivider = (timestamp) => {
    const date = new Date(timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      })
    }
  }

  const shouldShowDateDivider = (currentMsg, prevMsg) => {
    if (!prevMsg) return true
    
    const currentDate = new Date(currentMsg.created_at).toDateString()
    const prevDate = new Date(prevMsg.created_at).toDateString()
    
    return currentDate !== prevDate
  }

  if (loading) {
    return (
      <div className="message-thread">
        <div className="thread-header">
          <button onClick={onBack} className="btn-back">
            ← Back
          </button>
          <h2>{conversation.otherUserName}</h2>
        </div>
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="message-thread">
      <div className="thread-header">
        <button onClick={onBack} className="btn-back">
          ← Back
        </button>
        <div className="thread-user-info">
          <div className="thread-avatar">
            {conversation.otherUserName.charAt(0).toUpperCase()}
          </div>
          <h2>{conversation.otherUserName}</h2>
        </div>
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-thread">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const showDateDivider = shouldShowDateDivider(
              message,
              index > 0 ? messages[index - 1] : null
            )

            return (
              <React.Fragment key={message.id}>
                {showDateDivider && (
                  <div className="date-divider">
                    <span>{formatDateDivider(message.created_at)}</span>
                  </div>
                )}
                
                <div
                  className={`message ${
                    message.sender_id === currentUser.id ? 'sent' : 'received'
                  }`}
                >
                  <div className="message-bubble">
                    <p>{message.content}</p>
                    <span className="message-time">
                      {formatTimestamp(message.created_at)}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="message-input-form">
        {filterWarning && (
          <div className="filter-warning">
            ⚠️ {filterWarning}
          </div>
        )}
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          disabled={sending}
          className="message-input"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="btn-send"
        >
          {sending ? '...' : 'Send'}
        </button>
      </form>
    </div>
  )
}
