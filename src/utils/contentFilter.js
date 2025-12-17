// Content filter utilities for name validation

// Blocked words list (slurs, profanity, etc.)
// This list filters racial slurs, hate speech, and inappropriate content
const BLOCKED_WORDS = [
  // Racial slurs and hate speech
  'nigger', 'nigga', 'niger', 'niga',
  'kike', 'kyke',
  'chink', 'gook', 'nip',
  'spic', 'wetback',
  'towelhead', 'raghead', 'sandnigger',
  'cracker', 'honkey', 'honkie',
  'slant', 'gook',
  'beaner',
  'taco',
  
  // Other slurs and hate speech
  'faggot', 'fag', 'faggy',
  'dyke', 'lesbo',
  'tranny', 'trap',
  'retard', 'retarded', 'tard',
  'mongoloid',
  
  // Extreme profanity
  'cocksucker', 'cockhead',
  'motherfucker', 'motherfucking',
  'cunt', 'cunty',
];

/**
 * Check if a message/name should be filtered
 */
export function shouldFilterMessage(message, settings = { blockedWordsFilter: true }) {
  const lowerMessage = message.toLowerCase();

  // Blocked words filter
  if (settings.blockedWordsFilter) {
    for (const word of BLOCKED_WORDS) {
      // Check for word boundaries to avoid false positives
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lowerMessage)) {
        return { filtered: true, reason: 'Contains blocked word' };
      }
    }
  }

  return { filtered: false };
}

export const DEFAULT_FILTER_SETTINGS = {
  blockedWordsFilter: true,
  maturityFilter: false,
  maturityLevel: 'moderate'
};

