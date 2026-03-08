# Content Filter - Auto-Redaction System

## What It Does

Automatically removes contact information from messages to keep conversations on-platform, similar to Airbnb, Upwork, and Fiverr.

## What Gets Blocked

### ✅ Email Addresses
- `john@email.com` → `[EMAIL REDACTED]`
- `contact.me@company.co.uk` → `[EMAIL REDACTED]`
- Workarounds like `john [at] email [dot] com` → `[EMAIL REDACTED]`

### ✅ Phone Numbers
- `555-1234` → `[PHONE REDACTED]`
- `(555) 123-4567` → `[PHONE REDACTED]`
- `+1 555 123 4567` → `[PHONE REDACTED]`
- `Call me at 555-1234` → `[CONTACT INFO REDACTED]`

### ✅ URLs & Links
- `www.mywebsite.com` → `[LINK REDACTED]`
- `https://external-site.com` → `[LINK REDACTED]`
- `zoom.us/meeting/123` → `[ZOOM LINK REDACTED]`
- **Exception:** Your own domain (inquireconnect.com) is allowed

### ✅ Social Media
- `@username` → `[HANDLE REDACTED]`
- `facebook.com/myprofile` → `[LINK REDACTED]`
- `instagram.com/user` → `[LINK REDACTED]`

### ✅ Other Contact Methods
- `skype:username` → `[SKYPE REDACTED]`
- `whatsapp: 555-1234` → `[WHATSAPP REDACTED]`

### ✅ Context-Aware Blocking
- "My email is john@email.com" → `[CONTACT INFO REDACTED]`
- "Call me at 555-1234" → `[CONTACT INFO REDACTED]`
- "Text me on 555-1234" → `[CONTACT INFO REDACTED]`

## How It Works

1. **User types message** with contact info
2. **Clicks Send**
3. **Filter scans** the message automatically
4. **Contact info replaced** with [REDACTED] tags
5. **Message saved** to database (filtered version)
6. **Warning shown** to sender: "For your safety, contact information has been removed"
7. **Recipient sees** the filtered message
8. **Warning auto-hides** after 5 seconds

## User Experience

### What Sender Sees:
```
Types: "Hi! Email me at john@email.com"
Sends message
Sees warning: "⚠️ For your safety, email addresses have been removed from this message."
Message appears as: "Hi! [EMAIL REDACTED]"
```

### What Recipient Sees:
```
Message appears: "Hi! [EMAIL REDACTED]"
(No indication that anything was filtered - just sees the redacted version)
```

## Benefits

### 🛡️ Platform Protection
- Keeps conversations on your platform
- Prevents users from bypassing your system
- Maintains control over user interactions

### 💰 Revenue Protection
- Users can't take business offline
- Enables future transaction fees
- Supports subscription monetization
- Tracks lead conversion accurately

### 📊 Data & Analytics
- Complete conversation history
- Measure response times
- Track conversion rates
- Build reputation scores

### ⚖️ Trust & Safety
- Dispute resolution (you have records)
- Report abusive behavior
- Verify quality of service
- Protect against scams

## Configuration

The filter is already configured with sensible defaults. You can customize in `src/contentFilter.js`:

### Allow Your Own Domain

```javascript
const safeDomains = ['inquireconnect.com', 'yoursite.com']
```

### Adjust Patterns

All regex patterns are in the `PATTERNS` object. You can:
- Add new patterns
- Make existing patterns stricter/looser
- Add specific phrases to block

### Change Redaction Text

Default: `[EMAIL REDACTED]`, `[PHONE REDACTED]`, etc.

Can be changed to:
- `***` (asterisks)
- `[BLOCKED]`
- `[Contact info removed for safety]`

## Testing

Try sending these messages to test the filter:

```
"Call me at 555-1234"
"Email john@test.com"
"Check out mywebsite.com"
"@instagram follow me"
"Let's talk on Zoom: zoom.us/meeting/123"
"My number is (555) 123-4567"
```

All should be redacted automatically!

## Limitations

### What It DOESN'T Catch (Yet)

1. **Creative Obfuscation**
   - "five five five one two three four" (spelled out)
   - "john (the symbol) email (dot) com"
   - Images containing contact info

2. **Context Clues**
   - "I'm on all the usual platforms" (vague)
   - "Search my name on Google" (indirect)

3. **Voice/Video**
   - If you add voice messages later
   - Video calls (if implemented)

### Future Improvements

You could add:
- **Machine learning** to detect creative bypasses
- **Severity levels** (warning vs hard block)
- **Strike system** (3 violations = account warning)
- **Manual review** queue for flagged messages
- **OCR** to scan images for contact info

## Privacy & Legal

**User Notification:**
- Users see a warning when content is filtered
- Terms of Service should disclose auto-moderation
- Privacy policy should explain data processing

**Recommended TOS Language:**
```
"To maintain platform safety and quality, messages may be automatically 
screened for contact information. Any detected email addresses, phone 
numbers, or external links will be removed from your messages."
```

## Monitoring

Track these metrics in your database:
```sql
-- Add a filtered_content column to messages table (future enhancement)
ALTER TABLE messages ADD COLUMN was_filtered boolean DEFAULT false;
ALTER TABLE messages ADD COLUMN blocked_items jsonb;
```

Then you can see:
- How many messages are filtered daily
- Which users try to bypass most often
- Common patterns people use

## FAQ

**Q: Can users still share contact info somehow?**
A: Yes, determined users can find ways (spelling out numbers, images). The filter stops casual attempts and most common patterns.

**Q: Will users be angry about this?**
A: Most platforms do this (Airbnb, Upwork, Fiverr). Users expect it. The key is clear communication in your TOS.

**Q: Can I turn it off for verified PIs?**
A: Yes! Add a check in MessageThread.jsx:
```javascript
if (profile.subscription_status === 'elite') {
  // Skip filtering
  return { filtered: message, wasFiltered: false }
}
```

**Q: Does this slow down message sending?**
A: No - filtering happens instantly (milliseconds). Users won't notice any delay.

## Next Steps

**Monitor & Improve:**
1. Track which patterns are caught most
2. Watch for new bypass attempts
3. Update regex patterns as needed
4. Consider ML-based filtering for sophisticated cases

**Monetize It:**
1. Basic tier: Filtered messaging
2. Pro tier: Unfiltered (but monitored)
3. Enterprise: Direct contact exchange allowed

**Expand It:**
1. Filter job postings too
2. Filter consultation requests
3. Filter PI profile descriptions
4. OCR for image uploads
