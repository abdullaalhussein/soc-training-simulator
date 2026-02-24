/**
 * Server-side output filter: scan AI response for leaked answer content.
 * Returns null if the response is safe, or a fallback message if it contains answer-like content.
 */
export function filterAiResponse(response: string, checkpoints: { correctAnswer: any; explanation: any; options: any }[]): string | null {
  const lower = response.toLowerCase();

  // Layer 1: Check for phrases that indicate the AI is giving away answers
  const answerPatterns = [
    /the correct answer is/i,
    /the answer is/i,
    /you should select/i,
    /you should choose/i,
    /the right option is/i,
    /select option/i,
    /choose option/i,
    /the evidence is located/i,
    /the evidence you need is/i,
    /the key evidence is/i,
    /here(?:'s| is) the solution/i,
    /the correct option/i,
  ];

  for (const pattern of answerPatterns) {
    if (pattern.test(response)) {
      return 'Let me guide you differently. What observations have you made so far, and what do they suggest to you?';
    }
  }

  // Layer 2: Check if response contains exact correctAnswer strings from checkpoints
  for (const cp of checkpoints) {
    if (cp.correctAnswer) {
      const answer = typeof cp.correctAnswer === 'string' ? cp.correctAnswer : JSON.stringify(cp.correctAnswer);
      // Only flag if the answer is substantial (more than 3 chars) and appears in the response
      if (answer.length > 3 && lower.includes(answer.toLowerCase())) {
        return 'That is a great question. What patterns in the logs have caught your attention so far?';
      }
    }
    // Layer 3: Check if explanation text is being leaked
    if (cp.explanation && typeof cp.explanation === 'string' && cp.explanation.length > 20) {
      // Check if a significant portion of the explanation appears in the response
      const explanationWords = cp.explanation.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
      if (explanationWords.length > 5) {
        const matchCount = explanationWords.filter((w: string) => lower.includes(w)).length;
        if (matchCount / explanationWords.length > 0.6) {
          return 'Think about what you have observed in the investigation so far. What stands out to you?';
        }
      }
    }
  }

  // Layer 4: Check for JSON or structured data leaks
  if (/\{[\s\S]*"(correctAnswer|isEvidence|evidenceTag|explanation)"[\s\S]*\}/i.test(response)) {
    return 'I can help you think through this. What is your current hypothesis about what happened?';
  }

  return null; // Response is safe
}
