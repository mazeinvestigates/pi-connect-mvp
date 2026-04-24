import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ConversationsList({ 
  conversations, 
  loading, 
  error, 
  onSelectConversation,
  onRefresh,
  currentUserId
}) {
  const [confirmDelete, setConfirmDelete] = useState(null)

  const handleDelete = async (e, conversationId) => {
    e.stopPropagation()
    if (confirmDelete === conversationId) {
      await supabase.from('messages').delete().eq('conversation_id', conversationId)
      await supabase.from('conversations').delete().eq('id', conversationId)
      setConfirmDelete(null)
      onRefresh()
    } else {
      setConfirmDelete(conversationId)
      setTimeout(() => setConfirmDelete(null), 3000)
    }
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="conversations-list">
        <div className="conversations-header">
          <h2>Messages</h2>
        </div>
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading conversations...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="conversations-list">
        <div className="conversations-header">
          <h2>Messages</h2>
        </div>
        <div className="error-container">
          <p>Error loading conversations: {error}</p>
          <button onClick={onRefresh} className="btn-secondary">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="conversations-list">
      <div className="conversations-header">
        <h2>Messages</h2>
        <button onClick={onRefresh} className="btn-icon" title="Refresh">
          ↻
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="empty-state">
          <p>No conversations yet</p>
          <p className="empty-hint">
            Start a conversation by requesting a consultation with a PI
          </p>
        </div>
      ) : (
        <div className="conversations-items">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`conversation-item ${conversation.unreadCount > 0 ? 'unread' : ''}`}
              onClick={() => onSelectConversation(conversation)}
              style={{ position: 'relative' }}
            >
              <button
                onClick={(e) => handleDelete(e, conversation.id)}
                title="Delete conversation"
                style={{
                  position: 'absolute', top: '8px', right: '8px',
                  background: confirmDelete === conversation.id ? '#dc2626' : 'none',
                  color: confirmDelete === conversation.id ? 'white' : '#9ca3af',
                  border: confirmDelete === conversation.id ? 'none' : 'none',
                  borderRadius: '4px', padding: '2px 6px',
                  cursor: 'pointer', fontSize: '12px', zIndex: 1,
                  fontWeight: confirmDelete === conversation.id ? '600' : 'normal'
                }}>
                {confirmDelete === conversation.id ? 'Delete?' : '✕'}
              </button>
              <div className="conversation-avatar">
                {conversation.otherUserName.charAt(0).toUpperCase()}
              </div>
              
              <div className="conversation-details">
                <div className="conversation-header-row">
                  <h3 className="conversation-name">
                    {conversation.otherUserName}
                  </h3>
                  {conversation.lastMessage && (
                    <span className="conversation-time">
                      {formatTimestamp(conversation.lastMessage.created_at)}
                    </span>
                  )}
                </div>
                
                <div className="conversation-preview-row">
                  {conversation.lastMessage ? (
                    <p className="conversation-preview">
                      {conversation.lastMessage.content.length > 60
                        ? `${conversation.lastMessage.content.substring(0, 60)}...`
                        : conversation.lastMessage.content}
                    </p>
                  ) : (
                    <p className="conversation-preview empty">No messages yet</p>
                  )}
                  
                  {conversation.unreadCount > 0 && (
                    <span className="unread-badge">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
