import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const MODEL = 'claude-sonnet-4-6';

export class AIService {
  private static client: Anthropic | null = null;

  static getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    }
    return this.client;
  }

  static isAvailable(): boolean {
    return env.ANTHROPIC_API_KEY.length > 0;
  }

  /**
   * Grade a short-answer response using AI.
   * Returns { score: 0-1, feedback: string } or null on failure.
   */
  static async gradeShortAnswer(
    question: string,
    answer: string,
    keywords: string[],
    scenarioContext?: string,
  ): Promise<{ score: number; feedback: string } | null> {
    if (!this.isAvailable()) return null;

    try {
      const response = await this.getClient().messages.create({
        model: MODEL,
        max_tokens: 512,
        system: `You are a SOC (Security Operations Center) training evaluator. Grade the trainee's short answer based on technical accuracy, completeness, and relevance. Be fair but rigorous.

Return ONLY a JSON object with this exact format:
{"score": <number between 0 and 1>, "feedback": "<1-2 sentence constructive feedback>"}`,
        messages: [
          {
            role: 'user',
            content: `${scenarioContext ? `Scenario context: ${scenarioContext}\n\n` : ''}Question: ${question}

Expected keywords/concepts: ${keywords.join(', ')}

Trainee's answer: ${answer}

Grade this answer. A score of 1.0 means perfect, 0.0 means completely wrong. Consider whether the trainee demonstrates understanding of the core concepts even if they don't use exact keywords.`,
          },
        ],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: Math.max(0, Math.min(1, Number(parsed.score) || 0)),
        feedback: String(parsed.feedback || ''),
      };
    } catch (err) {
      logger.error('AI grading failed for short answer', { error: err });
      return null;
    }
  }

  /**
   * Grade an incident report using AI.
   * Returns { score: 0-1, feedback: string } or null on failure.
   */
  static async gradeIncidentReport(
    question: string,
    report: { summary: string; recommendations: string[] },
    expected: { keywords: string[]; minRecommendations: number },
    scenarioContext?: string,
  ): Promise<{ score: number; feedback: string } | null> {
    if (!this.isAvailable()) return null;

    try {
      const response = await this.getClient().messages.create({
        model: MODEL,
        max_tokens: 512,
        system: `You are a SOC (Security Operations Center) training evaluator. Grade the trainee's incident report based on:
1. Summary quality — covers key findings, root cause, and impact (50%)
2. Recommendations — actionable, relevant, and sufficient count (50%)

Return ONLY a JSON object with this exact format:
{"score": <number between 0 and 1>, "feedback": "<2-3 sentence constructive feedback covering both summary and recommendations>"}`,
        messages: [
          {
            role: 'user',
            content: `${scenarioContext ? `Scenario context: ${scenarioContext}\n\n` : ''}Question: ${question}

Expected key points: ${expected.keywords.join(', ')}
Minimum recommendations expected: ${expected.minRecommendations}

Trainee's incident summary:
${report.summary}

Trainee's recommendations:
${report.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Grade this incident report.`,
          },
        ],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: Math.max(0, Math.min(1, Number(parsed.score) || 0)),
        feedback: String(parsed.feedback || ''),
      };
    } catch (err) {
      logger.error('AI grading failed for incident report', { error: err });
      return null;
    }
  }

  /**
   * AI trainee assistant — Socratic method, no direct answers.
   */
  static async getAssistantResponse(
    userMessage: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[],
    scenarioBriefing: string,
    currentStageInfo: string,
    progressStats: { currentStage: number; totalStages: number; score: number; hintsUsed: number },
  ): Promise<string | null> {
    if (!this.isAvailable()) return null;

    try {
      const messages: { role: 'user' | 'assistant'; content: string }[] = [
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ];

      const response = await this.getClient().messages.create({
        model: MODEL,
        max_tokens: 500,
        system: `You are an AI assistant helping a SOC analyst trainee during a simulated security investigation. Follow these rules strictly:

1. SOCRATIC METHOD: Never give direct answers. Ask guiding questions that lead the trainee to discover answers themselves.
2. CONCISE: Keep responses under 3 sentences.
3. CONTEXTUAL: Reference specific details from the scenario and current stage.
4. ENCOURAGING: Be supportive but don't over-praise. Acknowledge good reasoning.
5. NO SPOILERS: Never reveal evidence locations, correct answers, or solution steps directly.
6. ROLE: You are a senior SOC analyst mentoring a junior. Use professional SOC terminology.

Scenario briefing:
${scenarioBriefing}

Current stage: ${currentStageInfo}

Trainee progress: Stage ${progressStats.currentStage}/${progressStats.totalStages}, Score: ${progressStats.score}, Hints used: ${progressStats.hintsUsed}`,
        messages,
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      return text || null;
    } catch (err) {
      logger.error('AI assistant response failed', { error: err });
      return null;
    }
  }

  /**
   * Generate a complete scenario JSON from a description.
   */
  static async generateScenario(params: {
    description: string;
    difficulty: string;
    mitreAttackIds: string[];
    numStages: number;
    category: string;
  }): Promise<any | null> {
    if (!this.isAvailable()) return null;

    try {
      const response = await this.getClient().messages.create({
        model: MODEL,
        max_tokens: 8192,
        system: `You are an expert SOC scenario designer. Generate a complete, realistic SOC training scenario as a JSON object.

The JSON must follow this exact schema:
{
  "name": "string — scenario title",
  "description": "string — brief description",
  "difficulty": "BEGINNER | INTERMEDIATE | ADVANCED",
  "category": "string — e.g., Email Threats, Malware, Network Intrusion, Insider Threat, Ransomware, Cloud Security",
  "mitreAttackIds": ["T1566.001", ...],
  "briefing": "string — markdown briefing for trainee with context and objectives",
  "lessonContent": "string — optional markdown pre-investigation lesson",
  "estimatedMinutes": number,
  "stages": [
    {
      "stageNumber": number (starting from 1),
      "title": "string",
      "description": "string — what to investigate",
      "unlockCondition": "AFTER_PREVIOUS | AFTER_CHECKPOINT | AFTER_TIME_DELAY | MANUAL",
      "unlockDelay": null | number (seconds, for AFTER_TIME_DELAY),
      "logs": [
        {
          "logType": "WINDOWS_EVENT | SYSMON | EDR_ALERT | NETWORK_FLOW | SIEM_ALERT | FIREWALL | PROXY | DNS | EMAIL_GATEWAY | AUTH_LOG",
          "summary": "string — human-readable summary",
          "severity": "INFO | LOW | MEDIUM | HIGH | CRITICAL",
          "hostname": "string | null",
          "username": "string | null",
          "processName": "string | null",
          "eventId": "string | null",
          "sourceIp": "string | null",
          "destIp": "string | null",
          "timestamp": "ISO 8601 datetime string",
          "isEvidence": boolean,
          "evidenceTag": "string | null (if isEvidence)",
          "rawLog": { ... realistic raw log JSON ... },
          "sortOrder": number
        }
      ],
      "hints": [
        { "content": "string", "pointsPenalty": number, "sortOrder": number }
      ]
    }
  ],
  "checkpoints": [
    {
      "stageNumber": number,
      "checkpointType": "TRUE_FALSE | MULTIPLE_CHOICE | SEVERITY_CLASSIFICATION | RECOMMENDED_ACTION | SHORT_ANSWER | EVIDENCE_SELECTION | INCIDENT_REPORT",
      "question": "string",
      "options": ["string", ...] | null (required for MULTIPLE_CHOICE, RECOMMENDED_ACTION, EVIDENCE_SELECTION),
      "correctAnswer": any (type-specific),
      "points": number (5-15),
      "category": "accuracy | response | report | null",
      "explanation": "string — shown after answering",
      "sortOrder": number
    }
  ]
}

Rules:
- Generate realistic log data with proper timestamps, IPs, hostnames, and process names
- Logs should tell a coherent attack story across stages
- Include a mix of evidence logs and noise/benign logs
- Each stage should have 4-8 logs and 1-3 checkpoints
- Include at least one SHORT_ANSWER and one INCIDENT_REPORT checkpoint in the final stage
- rawLog fields should be realistic JSON representations of actual log sources
- Return ONLY the JSON object, no markdown fences or explanation`,
        messages: [
          {
            role: 'user',
            content: `Generate a SOC training scenario with these parameters:

Description: ${params.description}
Difficulty: ${params.difficulty}
MITRE ATT&CK techniques: ${params.mitreAttackIds.join(', ')}
Number of stages: ${params.numStages}
Category: ${params.category}

Generate the complete scenario JSON now.`,
          },
        ],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      logger.error('AI scenario generation failed', { error: err });
      return null;
    }
  }
}
