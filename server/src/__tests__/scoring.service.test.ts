import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AIService to return null (test fallback paths only)
vi.mock('../services/ai.service', () => ({
  AIService: {
    gradeShortAnswer: vi.fn().mockResolvedValue(null),
    gradeIncidentReport: vi.fn().mockResolvedValue(null),
    gradeYaraRule: vi.fn().mockResolvedValue(null),
    getCheckpointFeedback: vi.fn().mockResolvedValue(null),
  },
}));

// Mock prisma
vi.mock('../lib/prisma', () => ({ default: {} }));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { ScoringService } from '../services/scoring.service';

describe('ScoringService.gradeAnswer', () => {
  // --- TRUE_FALSE ---
  describe('TRUE_FALSE', () => {
    const checkpoint = { checkpointType: 'TRUE_FALSE', correctAnswer: true, points: 10 };

    it('awards full points for correct answer (case-insensitive)', async () => {
      const result = await ScoringService.gradeAnswer(checkpoint, 'TRUE');
      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBe(10);
    });

    it('awards 0 points for wrong answer', async () => {
      const result = await ScoringService.gradeAnswer(checkpoint, 'false');
      expect(result.isCorrect).toBe(false);
      expect(result.pointsAwarded).toBe(0);
    });
  });

  // --- SEVERITY_CLASSIFICATION ---
  describe('SEVERITY_CLASSIFICATION', () => {
    const checkpoint = { checkpointType: 'SEVERITY_CLASSIFICATION', correctAnswer: 'HIGH', points: 10 };

    it('awards full points for correct answer (case-insensitive)', async () => {
      const result = await ScoringService.gradeAnswer(checkpoint, 'high');
      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBe(10);
    });

    it('awards 0 points for wrong classification', async () => {
      const result = await ScoringService.gradeAnswer(checkpoint, 'CRITICAL');
      expect(result.isCorrect).toBe(false);
      expect(result.pointsAwarded).toBe(0);
    });
  });

  // --- MULTIPLE_CHOICE ---
  describe('MULTIPLE_CHOICE', () => {
    const checkpoint = { checkpointType: 'MULTIPLE_CHOICE', correctAnswer: 'EXCEL.EXE', points: 10 };

    it('awards full points for exact case-sensitive match', async () => {
      const result = await ScoringService.gradeAnswer(checkpoint, 'EXCEL.EXE');
      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBe(10);
    });

    it('awards 0 points for case mismatch', async () => {
      const result = await ScoringService.gradeAnswer(checkpoint, 'excel.exe');
      expect(result.isCorrect).toBe(false);
      expect(result.pointsAwarded).toBe(0);
    });
  });

  // --- RECOMMENDED_ACTION ---
  describe('RECOMMENDED_ACTION', () => {
    const checkpoint = { checkpointType: 'RECOMMENDED_ACTION', correctAnswer: 'Isolate the host', points: 15 };

    it('awards full points for exact match', async () => {
      const result = await ScoringService.gradeAnswer(checkpoint, 'Isolate the host');
      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBe(15);
    });

    it('awards 0 points for wrong action', async () => {
      const result = await ScoringService.gradeAnswer(checkpoint, 'Continue monitoring');
      expect(result.isCorrect).toBe(false);
      expect(result.pointsAwarded).toBe(0);
    });
  });

  // --- EVIDENCE_SELECTION ---
  describe('EVIDENCE_SELECTION', () => {
    const checkpoint = {
      checkpointType: 'EVIDENCE_SELECTION',
      correctAnswer: ['A', 'B', 'C', 'D'],
      points: 15,
    };

    it('awards full points for perfect selection (F1 = 1.0)', async () => {
      const result = await ScoringService.gradeAnswer(checkpoint, ['A', 'B', 'C', 'D']);
      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBe(15);
    });

    it('marks correct when F1 >= 0.8', async () => {
      // Select 3 of 4 correct (no false positives): precision=1, recall=0.75, F1=0.857
      const result = await ScoringService.gradeAnswer(checkpoint, ['A', 'B', 'C']);
      expect(result.isCorrect).toBe(true);
    });

    it('marks incorrect when F1 < 0.8', async () => {
      // Select 2 of 4 correct (no false positives): precision=1, recall=0.5, F1=0.667
      const result = await ScoringService.gradeAnswer(checkpoint, ['A', 'B']);
      expect(result.isCorrect).toBe(false);
    });

    it('partial points scale with F1 score', async () => {
      // Select all 4 correct + 1 false positive: precision=4/5=0.8, recall=1, F1=0.889
      const result = await ScoringService.gradeAnswer(checkpoint, ['A', 'B', 'C', 'D', 'E']);
      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBeGreaterThan(0);
      expect(result.pointsAwarded).toBeLessThanOrEqual(15);
    });

    it('awards 0 for completely wrong selection', async () => {
      const result = await ScoringService.gradeAnswer(checkpoint, ['X', 'Y']);
      expect(result.isCorrect).toBe(false);
      expect(result.pointsAwarded).toBe(0);
    });
  });

  // --- SHORT_ANSWER (fallback: keyword matching) ---
  describe('SHORT_ANSWER fallback', () => {
    const checkpoint = {
      checkpointType: 'SHORT_ANSWER',
      question: 'What was the attack vector?',
      correctAnswer: ['phishing', 'macro', 'powershell'],
      points: 10,
    };

    it('marks correct when keyword match >= 0.6 threshold', async () => {
      const result = await ScoringService.gradeAnswer(checkpoint, 'It was a phishing email with a macro');
      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBeGreaterThan(0);
    });

    it('marks incorrect when keyword match < 0.6 threshold', async () => {
      const result = await ScoringService.gradeAnswer(checkpoint, 'some random unrelated answer');
      expect(result.isCorrect).toBe(false);
      expect(result.pointsAwarded).toBe(0);
    });
  });

  // --- INCIDENT_REPORT (fallback: keyword + recommendation count) ---
  describe('INCIDENT_REPORT fallback', () => {
    const checkpoint = {
      checkpointType: 'INCIDENT_REPORT',
      question: 'Write an incident report',
      correctAnswer: { keywords: ['phishing', 'powershell', 'c2', 'macro', 'isolate'], minRecommendations: 3 },
      points: 10,
    };

    it('scores based on 50% keyword + 50% recommendation count', async () => {
      const answer = {
        summary: 'A phishing email delivered a macro that launched powershell to establish c2',
        recommendations: ['Isolate the host', 'Block the IP', 'Reset credentials'],
      };
      const result = await ScoringService.gradeAnswer(checkpoint, answer);
      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBeGreaterThan(0);
    });

    it('awards partial points for partial match', async () => {
      const answer = {
        summary: 'A phishing email was received',
        recommendations: ['Block IP'],
      };
      const result = await ScoringService.gradeAnswer(checkpoint, answer);
      // 1/5 keywords = 0.2 * 0.5 = 0.1; 1/3 recs = 0.333 * 0.5 = 0.167; total = 0.267
      expect(result.isCorrect).toBe(false);
      expect(result.pointsAwarded).toBeGreaterThan(0);
    });
  });

  // --- SEVERITY_CLASSIFICATION with descriptive correctAnswer (BUG 3 fix) ---
  describe('SEVERITY_CLASSIFICATION — prefix extraction', () => {
    it('matches when correctAnswer has description suffix', async () => {
      const checkpoint = { checkpointType: 'SEVERITY_CLASSIFICATION', correctAnswer: 'CRITICAL — This involves data exfiltration', points: 10 };
      const result = await ScoringService.gradeAnswer(checkpoint, 'CRITICAL');
      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBe(10);
    });

    it('matches when both have description suffixes', async () => {
      const checkpoint = { checkpointType: 'SEVERITY_CLASSIFICATION', correctAnswer: 'HIGH — Elevated risk', points: 15 };
      const result = await ScoringService.gradeAnswer(checkpoint, 'HIGH — Something else');
      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBe(15);
    });

    it('rejects when severity prefixes differ despite descriptions', async () => {
      const checkpoint = { checkpointType: 'SEVERITY_CLASSIFICATION', correctAnswer: 'CRITICAL — Severe', points: 10 };
      const result = await ScoringService.gradeAnswer(checkpoint, 'HIGH');
      expect(result.isCorrect).toBe(false);
      expect(result.pointsAwarded).toBe(0);
    });

    it('is case-insensitive with prefix extraction', async () => {
      const checkpoint = { checkpointType: 'SEVERITY_CLASSIFICATION', correctAnswer: 'Critical — needs attention', points: 10 };
      const result = await ScoringService.gradeAnswer(checkpoint, 'critical');
      expect(result.isCorrect).toBe(true);
    });
  });

  // --- SHORT_ANSWER with string correctAnswer (BUG 1 fix) ---
  describe('SHORT_ANSWER — string correctAnswer', () => {
    it('extracts keywords from string correctAnswer and matches', async () => {
      const checkpoint = {
        checkpointType: 'SHORT_ANSWER',
        question: 'What technique was used?',
        correctAnswer: 'lateral movement pass-the-hash mimikatz',
        points: 10,
      };
      // All 4 extracted keywords present: lateral, movement, pass-the-hash, mimikatz
      const result = await ScoringService.gradeAnswer(checkpoint, 'lateral movement using pass-the-hash and mimikatz tool');
      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBeGreaterThan(0);
    });

    it('gives low score when answer misses all keywords', async () => {
      const checkpoint = {
        checkpointType: 'SHORT_ANSWER',
        question: 'What technique was used?',
        correctAnswer: 'The attacker used lateral movement via pass-the-hash with mimikatz',
        points: 10,
      };
      const result = await ScoringService.gradeAnswer(checkpoint, 'I have no idea what happened');
      expect(result.isCorrect).toBe(false);
    });

    it('handles object correctAnswer with keywords field', async () => {
      const checkpoint = {
        checkpointType: 'SHORT_ANSWER',
        question: 'What was the IOC?',
        correctAnswer: { keywords: ['malware', 'beacon', 'cobalt'] },
        points: 10,
      };
      const result = await ScoringService.gradeAnswer(checkpoint, 'The malware used a cobalt strike beacon');
      expect(result.isCorrect).toBe(true);
    });
  });

  // --- RECOMMENDED_ACTION with array correctAnswer (BUG 2 fix) ---
  describe('RECOMMENDED_ACTION — array correctAnswer', () => {
    const checkpoint = {
      checkpointType: 'RECOMMENDED_ACTION',
      correctAnswer: ['Isolate the host', 'Block the IP', 'Reset credentials'],
      points: 20,
    };

    it('awards full points when all correct actions selected', async () => {
      const result = await ScoringService.gradeAnswer(checkpoint, ['Isolate the host', 'Block the IP', 'Reset credentials']);
      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBe(20);
    });

    it('uses F1 scoring for partial matches', async () => {
      // 2 of 3 correct, no FP: precision=1, recall=2/3=0.667, F1=0.8
      const result = await ScoringService.gradeAnswer(checkpoint, ['Isolate the host', 'Block the IP']);
      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBeGreaterThan(0);
      expect(result.pointsAwarded).toBeLessThan(20);
    });

    it('awards 0 for completely wrong actions', async () => {
      const result = await ScoringService.gradeAnswer(checkpoint, ['Do nothing', 'Ignore it']);
      expect(result.isCorrect).toBe(false);
      expect(result.pointsAwarded).toBe(0);
    });

    it('handles single string answer against array correctAnswer', async () => {
      // Single answer matches 1 of 3: precision=1, recall=1/3=0.333, F1=0.5
      const result = await ScoringService.gradeAnswer(checkpoint, 'Isolate the host');
      expect(result.isCorrect).toBe(false);
      expect(result.pointsAwarded).toBeGreaterThan(0);
    });
  });

  // --- INCIDENT_REPORT with string correctAnswer ---
  describe('INCIDENT_REPORT — string correctAnswer', () => {
    it('extracts keywords from string and scores on keyword overlap', async () => {
      const checkpoint = {
        checkpointType: 'INCIDENT_REPORT',
        question: 'Write a summary',
        correctAnswer: 'An insider copied sensitive database records to a USB drive and exfiltrated them.',
        points: 20,
      };
      const answer = {
        summary: 'An insider threat used USB drive to exfiltrate sensitive database records from the system.',
        recommendations: [],
      };
      const result = await ScoringService.gradeAnswer(checkpoint, answer);
      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBeGreaterThan(0);
    });
  });

  // --- Unknown type ---
  describe('Unknown checkpoint type', () => {
    it('returns isCorrect=false and pointsAwarded=0', async () => {
      const checkpoint = { checkpointType: 'NONEXISTENT_TYPE', correctAnswer: 'foo', points: 10 };
      const result = await ScoringService.gradeAnswer(checkpoint, 'foo');
      expect(result.isCorrect).toBe(false);
      expect(result.pointsAwarded).toBe(0);
    });
  });
});
