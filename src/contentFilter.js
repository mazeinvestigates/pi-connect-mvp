/**
 * Content Filter for Messages
 * Automatically redacts email addresses, phone numbers, and other contact info
 * Similar to Airbnb, Upwork, Fiverr messaging systems
 */

// Regex patterns for different types of contact information
const PATTERNS = {
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
  
  // Phone numbers (various formats)
  phone: /(\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  
  // Social media handles
  socialHandle: /@[A-Za-z0-9_]{3,}/g,
  
  // URLs (http, https, www)
  url: /(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
  
  // Skype usernames
  skype: /skype:[\w.-]+/gi,
  
  // WhatsApp mentions
  whatsapp: /whatsapp\s*:?\s*[\d\s\-\+\(\)]+/gi,
  
  // Zoom links
  zoom: /zoom\.us\/[^\s]+/gi,
  
  // Alternative spellings to bypass filters
  emailWorkarounds: /\b[A-Za-z0-9._%+-]+\s*\[\s*at\s*\]\s*[A-Za-z0-9.-]+\s*\[\s*dot\s*\]\s*[A-Z|a-z]{2,}\b/gi,
  
  // "Call me at" patterns
  callMePattern: /(call|text|reach|contact)\s+(me|us)\s+(at|on)\s*:?\s*[\d\s\-\+\(\)]+/gi,
  
  // "Email me at" patterns  
  emailMePattern: /(email|e-mail|mail)\s+(me|us)\s+(at|to)\s*:?\s*[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/gi
}

// Suspicious phrases that indicate trying to share contact info
const SUSPICIOUS_PHRASES = [
  /my\s+(phone|number|cell|mobile)\s+is/gi,
  /my\s+email\s+is/gi,
  /contact\s+me\s+(at|on)/gi,
  /reach\s+me\s+(at|on)/gi,
  /call\s+me\s+(at|on)/gi,
  /text\s+me\s+(at|on)/gi,
  /whatsapp\s+me/gi,
  /let'?s\s+talk\s+off/gi,
  /take\s+this\s+offline/gi,
  /continue\s+this\s+outside/gi
]

/**
 * Filter message content and redact contact information
 * @param {string} message - Original message text
 * @returns {object} - {filtered: string, wasFiltered: boolean, blockedItems: array}
 */
export function filterMessageContent(message) {
  if (!message || typeof message !== 'string') {
    return { filtered: message, wasFiltered: false, blockedItems: [] }
  }

  let filtered = message
  let wasFiltered = false
  const blockedItems = []

  // Check and redact emails
  if (PATTERNS.email.test(filtered)) {
    const emails = filtered.match(PATTERNS.email) || []
    emails.forEach(email => blockedItems.push({ type: 'email', value: email }))
    filtered = filtered.replace(PATTERNS.email, '[EMAIL REDACTED]')
    wasFiltered = true
  }

  // Check and redact phone numbers
  if (PATTERNS.phone.test(filtered)) {
    const phones = filtered.match(PATTERNS.phone) || []
    phones.forEach(phone => blockedItems.push({ type: 'phone', value: phone }))
    filtered = filtered.replace(PATTERNS.phone, '[PHONE REDACTED]')
    wasFiltered = true
  }

  // Check and redact URLs
  if (PATTERNS.url.test(filtered)) {
    // Allow common safe domains (optional - you can remove this)
    const safeDomains = ['inquireconnect.com', 'piconnect.com'] // Your own domain
    const urls = filtered.match(PATTERNS.url) || []
    
    urls.forEach(url => {
      const isSafe = safeDomains.some(domain => url.toLowerCase().includes(domain))
      if (!isSafe) {
        blockedItems.push({ type: 'url', value: url })
        filtered = filtered.replace(url, '[LINK REDACTED]')
        wasFiltered = true
      }
    })
  }

  // Check and redact social media handles
  if (PATTERNS.socialHandle.test(filtered)) {
    const handles = filtered.match(PATTERNS.socialHandle) || []
    handles.forEach(handle => blockedItems.push({ type: 'social', value: handle }))
    filtered = filtered.replace(PATTERNS.socialHandle, '[HANDLE REDACTED]')
    wasFiltered = true
  }

  // Check and redact Skype
  if (PATTERNS.skype.test(filtered)) {
    filtered = filtered.replace(PATTERNS.skype, '[SKYPE REDACTED]')
    wasFiltered = true
  }

  // Check and redact WhatsApp
  if (PATTERNS.whatsapp.test(filtered)) {
    filtered = filtered.replace(PATTERNS.whatsapp, '[WHATSAPP REDACTED]')
    wasFiltered = true
  }

  // Check and redact Zoom links
  if (PATTERNS.zoom.test(filtered)) {
    filtered = filtered.replace(PATTERNS.zoom, '[ZOOM LINK REDACTED]')
    wasFiltered = true
  }

  // Check for workarounds (email [at] domain [dot] com)
  if (PATTERNS.emailWorkarounds.test(filtered)) {
    filtered = filtered.replace(PATTERNS.emailWorkarounds, '[EMAIL REDACTED]')
    wasFiltered = true
  }

  // Check for "call me at" patterns
  if (PATTERNS.callMePattern.test(filtered)) {
    filtered = filtered.replace(PATTERNS.callMePattern, '[CONTACT INFO REDACTED]')
    wasFiltered = true
  }

  // Check for "email me at" patterns
  if (PATTERNS.emailMePattern.test(filtered)) {
    filtered = filtered.replace(PATTERNS.emailMePattern, '[CONTACT INFO REDACTED]')
    wasFiltered = true
  }

  // Check for suspicious phrases (but don't redact - just flag)
  const hasSuspiciousPhrase = SUSPICIOUS_PHRASES.some(pattern => pattern.test(message))
  
  return {
    filtered,
    wasFiltered,
    blockedItems,
    hasSuspiciousPhrase
  }
}

/**
 * Validate if message should be allowed
 * @param {string} message - Message text
 * @returns {object} - {allowed: boolean, reason: string, filtered: string}
 */
export function validateMessage(message) {
  const result = filterMessageContent(message)
  
  // Always allow the message through, but return filtered version
  return {
    allowed: true,
    filtered: result.filtered,
    wasFiltered: result.wasFiltered,
    blockedItems: result.blockedItems,
    warning: result.wasFiltered 
      ? 'For your safety, contact information has been automatically removed from this message.'
      : null
  }
}

/**
 * Get user-friendly warning message
 * @param {array} blockedItems - Array of blocked items
 * @returns {string} - Warning message
 */
export function getWarningMessage(blockedItems) {
  if (!blockedItems || blockedItems.length === 0) {
    return null
  }

  const types = [...new Set(blockedItems.map(item => item.type))]
  
  if (types.length === 1) {
    const typeMessages = {
      email: 'email addresses',
      phone: 'phone numbers',
      url: 'external links',
      social: 'social media handles'
    }
    return `For your safety, ${typeMessages[types[0]] || 'contact information'} have been removed from this message.`
  }
  
  return 'For your safety, contact information has been removed from this message.'
}

// Export for testing
export { PATTERNS }
