/**
 * Sanitize user-controlled content before injection into AI system prompts.
 * Addresses threats: T-03 (indirect prompt injection), M-10 (scenario content review).
 */

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?above\s+instructions/i,
  /ignore\s+(all\s+)?prior\s+instructions/i,
  /disregard\s+(all\s+)?previous/i,
  /override\s+(all\s+)?previous/i,
  /forget\s+(all\s+)?previous/i,
  /you\s+are\s+now\s+(a|an|in)\s/i,
  /pretend\s+you\s+are/i,
  /act\s+as\s+(a|an|if)\s/i,
  /switch\s+to\s+\w+\s+mode/i,
  /enter\s+(debug|admin|test|developer|system)\s+mode/i,
  /you\s+are\s+in\s+(debug|admin|test|developer|system)\s+mode/i,
  /new\s+system\s+prompt/i,
  /system\s*:\s*/i,
  /assistant\s*:\s*/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<<SYS>>/i,
  /<\|system\|>/i,
  /reveal\s+(all\s+)?(your\s+)?(system\s+)?instructions/i,
  /reveal\s+(all\s+)?(your\s+)?(system\s+)?prompt/i,
  /show\s+(me\s+)?(your\s+)?(system\s+)?prompt/i,
  /output\s+(your\s+)?(system\s+)?prompt/i,
  /repeat\s+(your\s+)?(system\s+)?instructions/i,
  /what\s+are\s+your\s+(system\s+)?instructions/i,
  /print\s+(your\s+)?(system\s+)?prompt/i,
  /list\s+(all\s+)?correct\s+answers/i,
  /give\s+me\s+(all\s+)?(the\s+)?answers/i,
  /tell\s+me\s+(all\s+)?(the\s+)?answers/i,
  /what\s+(are|is)\s+the\s+correct\s+answer/i,
];

/**
 * Sanitize text content that will be injected into an AI system prompt.
 * Strips known prompt injection patterns by replacing them with harmless text.
 */
export function sanitizePromptContent(text: string): string {
  let sanitized = text;
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[content removed]');
  }
  return sanitized;
}

/**
 * Check if text contains prompt injection patterns.
 * Returns a list of matched pattern descriptions for audit/review purposes.
 */
export function detectPromptInjection(text: string): string[] {
  const matches: string[] = [];
  for (const pattern of INJECTION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }
  return matches;
}

/**
 * Scan scenario fields for prompt injection risk.
 * Returns { safe: boolean, flaggedFields: string[] }
 */
export function scanScenarioContent(scenario: {
  briefing?: string;
  stages?: { title?: string; description?: string }[];
}): { safe: boolean; flaggedFields: string[] } {
  const flaggedFields: string[] = [];

  if (scenario.briefing && detectPromptInjection(scenario.briefing).length > 0) {
    flaggedFields.push('briefing');
  }

  if (scenario.stages) {
    for (let i = 0; i < scenario.stages.length; i++) {
      const stage = scenario.stages[i];
      if (stage.title && detectPromptInjection(stage.title).length > 0) {
        flaggedFields.push(`stages[${i}].title`);
      }
      if (stage.description && detectPromptInjection(stage.description).length > 0) {
        flaggedFields.push(`stages[${i}].description`);
      }
    }
  }

  return { safe: flaggedFields.length === 0, flaggedFields };
}
