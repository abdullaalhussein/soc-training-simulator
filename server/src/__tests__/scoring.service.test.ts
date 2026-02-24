import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AIService to return null (test fallback paths only)
vi.mock('../services/ai.service', () => ({
  AIService: {
    gradeShortAnswer: vi.fn().mockResolvedValue(null),
    gradeIncidentReport: vi.fn().mockResolvedValue(null),
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
