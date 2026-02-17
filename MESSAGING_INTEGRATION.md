# Messaging Feature - Integration Guide

## What's Included

✅ **MessagingPage** - Main page with conversation list and message thread
✅ **ConversationsList** - Shows all conversations with unread counts
✅ **MessageThread** - Real-time chat interface
✅ **Messaging utilities** - Helper functions for conversations
✅ **Complete CSS** - All styling for messaging UI
✅ **Real-time updates** - Supabase Realtime subscriptions

## Files to Add/Update

### 1. New Files (copy to your project)

```
src/pages/MessagingPage.jsx
src/components/ConversationsList.jsx
src/components/MessageThread.jsx
src/messagingUtils.js
```

### 2. Update App.css

Add the contents of `messaging-styles.css` to the END of your `src/App.css` file.

### 3. Update App.jsx

Add messaging route to your main App component:

```jsx
// In App.jsx, add to imports:
import MessagingPage from './pages/MessagingPage'

// In the header navigation (inside renderHeader function):
<button 
  className="nav-link" 
  onClick={() => setCurrentPage('messages')}
>
  Messages
</button>

// In the main render, add this route:
{currentPage === 'messages' && (
  <MessagingPage 
    user={user}
    onNavigate={setCurrentPage}
  />
)}
```

### 4. Add "Message" Buttons to Dashboards

**In ClientDashboard.jsx** - when consultation is accepted:

```jsx
import { getOrCreateConversation } from '../messagingUtils'

// Inside the request card actions:
{request.status === 'accepted' && request.pi_profiles && (
  <button 
    className="btn-primary-small"
    onClick={async () => {
      try {
        const convo = await getOrCreateConversation(
          user.id, 
          request.pi_profiles.user_id
        )
        // Navigate to messages
        onNavigate('messages')
      } catch (error) {
        alert('Failed to start conversation')
      }
    }}
  >
    Message {request.pi_profiles.first_name}
  </button>
)}
```

**In PIDashboard.jsx** - for active requests:

```jsx
import { getOrCreateConversation } from '../messagingUtils'

// Inside active request cards:
<button 
  className="btn-primary-small"
  onClick={async () => {
    try {
      const convo = await getOrCreateConversation(
        user.id,
        request.requester_user_id
      )
      onNavigate('messages')
    } catch (error) {
      alert('Failed to start conversation')
    }
  }}
>
  Message Client
</button>
```

### 5. Add "Message PI" from Search Results

**In SearchPage.jsx** - in the PI profile modal:

```jsx
import { getOrCreateConversation } from '../messagingUtils'

// Add this button in the modal actions:
<button 
  className="btn-secondary btn-large"
  onClick={async () => {
    if (!user) {
      alert('Please sign in to message this PI')
      onNavigate('auth')
      return
    }
    try {
      const convo = await getOrCreateConversation(
        user.id,
        selectedPI.user_id
      )
      setShowProfileModal(false)
      onNavigate('messages')
    } catch (error) {
      alert('Failed to start conversation')
    }
  }}
>
  Message This PI
</button>
```

## How It Works

### Starting a Conversation

1. User clicks "Message" button anywhere in the app
2. `getOrCreateConversation()` checks if conversation exists
3. If not, creates new conversation in database
4. Navigates to MessagingPage
5. Conversation appears in list

### Sending Messages

1. User types message and clicks Send
2. Message saved to `messages` table
3. Supabase Realtime broadcasts to other user
4. Other user sees message instantly
5. `last_message_at` updates on conversation

### Real-time Updates

- **New messages** appear instantly via Realtime subscription
- **Conversation list** auto-updates when new conversations created
- **Unread counts** update when messages marked as read
- **Auto-scroll** to bottom when new messages arrive

### Read Receipts

- Messages marked as read when conversation opened
- Unread count shows on conversation list
- Blue badge indicates unread messages

## Testing the Messaging Feature

### Test Flow 1: Client → PI

1. Sign in as client
2. Search for a PI
3. View profile → click "Message This PI"
4. Send a message
5. Sign in as that PI (different browser/incognito)
6. Click "Messages" in header
7. See conversation with unread badge
8. Click conversation
9. See client's message
10. Reply
11. Switch back to client
12. See PI's reply instantly

### Test Flow 2: From Dashboard

1. Client sends consultation request
2. PI accepts it
3. Client clicks "Message [PI Name]" from dashboard
4. Conversation starts
5. Messages work as above

## Features

✅ Real-time messaging (instant delivery)
✅ Conversation threading
✅ Unread message counts
✅ Read receipts
✅ Date dividers (Today, Yesterday, etc.)
✅ Auto-scroll to new messages
✅ Mobile responsive
✅ Clean, modern UI
✅ Works with existing auth system
✅ Integrates with dashboards

## Database Already Ready

The `conversations` and `messages` tables were created when you ran `schema-updates.sql`, so no additional database setup needed!

## Troubleshooting

**"Can't start conversation"**
- Make sure user is logged in
- Check `user_id` exists for the PI
- Verify RLS policies allow inserts

**"Messages not appearing"**
- Check browser console for errors
- Verify Supabase Realtime is enabled in dashboard
- Check database has messages table

**"Not real-time"**
- Refresh the page
- Check Supabase Realtime subscription limit
- Verify channel is subscribed in console

**"Can't see conversations"**
- Make sure conversation exists in database
- Check RLS policies
- Verify user IDs match

## Next Steps After Integration

Once messaging works, you can add:
- Typing indicators
- Message attachments/images
- Delete messages
- Block users
- Search conversations
- Push notifications

