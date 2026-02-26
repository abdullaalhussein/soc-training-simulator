/**
 * AI input filter: detect and reject jailbreak/extraction patterns in user messages
 * before forwarding to the AI assistant. Addresses threat H-5.
 */

const JAILBREAK_PATTERNS = [
  // Role override attempts
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?above/i,
  /disregard\s+(all\s+)?previous/i,
  /forget\s+(all\s+)?your\s+(rules|instructions|guidelines)/i,
  /override\s+(your\s+)?(rules|instructions|guidelines)/i,
  /you\s+are\s+now\s+(a|an|in)\s/i,
  /pretend\s+(you\s+are|to\s+be)\s/i,
  /act\s+as\s+(a|an|if)\s/i,
  /role\s*play\s+as/i,
  /switch\s+to\s+\w+\s+mode/i,
  /enter\s+(debug|admin|test|developer|system|jailbreak|DAN)\s+mode/i,

  // System prompt extraction
  /repeat\s+(your\s+)?(entire\s+)?(system\s+)?(prompt|instructions)\s*(verbatim|exactly|word\s+for\s+word)?/i,
  /show\s+(me\s+)?(your\s+)?(system\s+)?(prompt|instructions)/i,
  /output\s+(your\s+)?(system\s+)?(prompt|instructions)/i,
  /print\s+(your\s+)?(system\s+)?(prompt|instructions)/i,
  /what\s+(are|is)\s+your\s+(system\s+)?(prompt|instructions)/i,
  /reveal\s+(your\s+)?(system\s+)?(prompt|instructions)/i,
  /display\s+(your\s+)?(system\s+)?(prompt|instructions)/i,

  // Answer extraction
  /list\s+(all\s+)?(the\s+)?correct\s+answers/i,
  /give\s+me\s+(all\s+)?(the\s+)?answers/i,
  /tell\s+me\s+(all\s+)?(the\s+)?answers/i,
  /what\s+(are|is)\s+the\s+correct\s+(answer|option|response)/i,
  /what\s+should\s+I\s+(select|choose|pick)/i,
  /which\s+(option|answer|choice)\s+is\s+(correct|right)/i,

  // Common jailbreak prefixes
  /\bDAN\b/,
  /do\s+anything\s+now/i,
  /\bjailbreak/i,
  /bypass\s+(your\s+)?(safety|rules|restrictions|filters|guidelines)/i,
  /developer\s+mode\s+(enabled|activated|on)/i,
];

/**
 * Filter user input before sending to AI assistant.
 * Returns null if the message is safe, or a rejection message if it contains jailbreak patterns.
 */
export function filterAiInput(message: string): string | null {
  for (const pattern of JAILBREAK_PATTERNS) {
    if (pattern.test(message)) {
      return 'I noticed your message contains patterns I cannot process. Please rephrase your question about the investigation, and I will be happy to help guide your analysis.';
    }
  }

  return null; // Message is safe
}
