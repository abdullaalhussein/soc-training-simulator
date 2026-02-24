import { describe, it, expect } from 'vitest';
import { filterAiResponse } from '../utils/filterAiResponse';

describe('filterAiResponse', () => {
  const emptyCheckpoints: { correctAnswer: any; explanation: any; options: any }[] = [];

  // --- Layer 1: Regex patterns ---
  describe('Layer 1: answer-giving phrase detection', () => {
    const patterns = [
      'The correct answer is B',
      'The answer is True',
      'You should select option A',
      'You should choose the first one',
      'The right option is C',
      'Select option B for this question',
      'Choose option A from the list',
      'The evidence is located in log 3',
      'The evidence you need is the DNS record',
      'The key evidence is the Sysmon alert',
      "Here's the solution to this checkpoint",
      'The correct option is the second one',
    ];

    for (const phrase of patterns) {
      it(`blocks: "${phrase}"`, () => {
        const result = filterAiResponse(phrase, emptyCheckpoints);
        expect(result).not.toBeNull();
      });
    }

    it('passes a safe response', () => {
      const result = filterAiResponse(
        'What patterns have you noticed in the DNS logs? Consider the query frequency.',
        emptyCheckpoints,
      );
      expect(result).toBeNull();
    });
  });

  // --- Layer 2: Exact correctAnswer match ---
  describe('Layer 2: exact correctAnswer string match', () => {
    it('blocks when response contains a long correctAnswer (>3 chars)', () => {
      const checkpoints = [{ correctAnswer: 'Typosquatting', explanation: null, options: null }];
      const result = filterAiResponse(
        'This attack uses typosquatting to deceive users.',
        checkpoints,
      );
      expect(result).not.toBeNull();
    });

    it('passes when correctAnswer is short (<=3 chars)', () => {
      const checkpoints = [{ correctAnswer: 'Yes', explanation: null, options: null }];
      const result = filterAiResponse(
        'Yes, you should investigate further.',
        checkpoints,
      );
      expect(result).toBeNull();
    });

    it('handles non-string correctAnswer (JSON)', () => {
      const checkpoints = [{ correctAnswer: ['A', 'B', 'C'], explanation: null, options: null }];
      const result = filterAiResponse(
        'Consider all the evidence carefully.',
        checkpoints,
      );
      // The JSON stringified version ["A","B","C"] won't appear in the response
      expect(result).toBeNull();
    });
  });

  // --- Layer 3: Explanation word overlap ---
  describe('Layer 3: explanation word overlap', () => {
    it('blocks when >60% of explanation words appear in response', () => {
      const explanation = 'The domain supp0rt-center.com uses typosquatting by replacing letters with similar numbers to mimic legitimate domains';
      const checkpoints = [{ correctAnswer: null, explanation, options: null }];
      // Response that contains most of the explanation words
      const response = 'The domain supp0rt-center.com is using typosquatting where letters are replaced with similar numbers to mimic legitimate looking domains';
      const result = filterAiResponse(response, checkpoints);
      expect(result).not.toBeNull();
    });

    it('passes when <60% of explanation words appear in response', () => {
      const explanation = 'The domain supp0rt-center.com uses typosquatting by replacing letters with similar numbers to mimic legitimate domains';
      const checkpoints = [{ correctAnswer: null, explanation, options: null }];
      const response = 'Look at the DNS records and consider what might be unusual about the query patterns.';
      const result = filterAiResponse(response, checkpoints);
      expect(result).toBeNull();
    });

    it('skips short explanations (<=20 chars)', () => {
      const checkpoints = [{ correctAnswer: null, explanation: 'Short explanation', options: null }];
      const result = filterAiResponse('Short explanation here', checkpoints);
      expect(result).toBeNull();
    });
  });

  // --- Layer 4: JSON structured data leaks ---
  describe('Layer 4: JSON structured data leaks', () => {
    it('blocks response containing correctAnswer field in JSON', () => {
      const result = filterAiResponse(
        'Here is the data: {"correctAnswer": "Typosquatting", "points": 10}',
        emptyCheckpoints,
      );
      expect(result).not.toBeNull();
    });

    it('blocks response containing isEvidence field in JSON', () => {
      const result = filterAiResponse(
        'The log entry has {"isEvidence": true, "tag": "phishing"}',
        emptyCheckpoints,
      );
      expect(result).not.toBeNull();
    });

    it('passes response without JSON leak patterns', () => {
      const result = filterAiResponse(
        'Think about which logs stand out as unusual compared to the baseline activity.',
        emptyCheckpoints,
      );
      expect(result).toBeNull();
    });
  });
});
