/**
 * Sanitize user-controlled content before injection into AI system prompts.
 * Addresses threats: T-03 (indirect prompt injection), M-10 (scenario content review).
 */

// SEC-06: All patterns use /gi (global + case-insensitive) to replace ALL occurrences
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /ignore\s+(all\s+)?above\s+instructions/gi,
  /ignore\s+(all\s+)?prior\s+instructions/gi,
  /disregard\s+(all\s+)?previous/gi,
  /override\s+(all\s+)?previous/gi,
  /forget\s+(all\s+)?previous/gi,
  /you\s+are\s+now\s+(a|an|in)\s/gi,
  /pretend\s+you\s+are/gi,
  /act\s+as\s+(a|an|if)\s/gi,
  /switch\s+to\s+\w+\s+mode/gi,
  /enter\s+(debug|admin|test|developer|system)\s+mode/gi,
  /you\s+are\s+in\s+(debug|admin|test|developer|system)\s+mode/gi,
  /new\s+system\s+prompt/gi,
  /system\s*:\s*/gi,
  /assistant\s*:\s*/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<<SYS>>/gi,
  /<\|system\|>/gi,
  /reveal\s+(all\s+)?(your\s+)?(system\s+)?instructions/gi,
  /reveal\s+(all\s+)?(your\s+)?(system\s+)?prompt/gi,
  /show\s+(me\s+)?(your\s+)?(system\s+)?prompt/gi,
  /output\s+(your\s+)?(system\s+)?prompt/gi,
  /repeat\s+(your\s+)?(system\s+)?instructions/gi,
  /what\s+are\s+your\s+(system\s+)?instructions/gi,
  /print\s+(your\s+)?(system\s+)?prompt/gi,
  /list\s+(all\s+)?correct\s+answers/gi,
  /give\s+me\s+(all\s+)?(the\s+)?answers/gi,
  /tell\s+me\s+(all\s+)?(the\s+)?answers/gi,
  /what\s+(are|is)\s+the\s+correct\s+answer/gi,
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
