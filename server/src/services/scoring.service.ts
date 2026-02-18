import { CheckpointType } from '@prisma/client';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';

export class ScoringService {
  static async gradeAnswer(checkpoint: any, answer: any): Promise<{ isCorrect: boolean; pointsAwarded: number }> {
    const { checkpointType, correctAnswer, points } = checkpoint;

    switch (checkpointType) {
      case 'TRUE_FALSE':
      case 'SEVERITY_CLASSIFICATION': {
        const isCorrect = String(answer).toLowerCase() === String(correctAnswer).toLowerCase();
        return { isCorrect, pointsAwarded: isCorrect ? points : 0 };
      }

      case 'MULTIPLE_CHOICE':
      case 'RECOMMENDED_ACTION': {
        const isCorrect = String(answer) === String(correctAnswer);
        return { isCorrect, pointsAwarded: isCorrect ? points : 0 };
      }

      case 'EVIDENCE_SELECTION': {
        const selected = Array.isArray(answer) ? answer : [answer];
        const correct = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];

        const truePositives = selected.filter((s: string) => correct.includes(s)).length;
        const precision = selected.length > 0 ? truePositives / selected.length : 0;
        const recall = correct.length > 0 ? truePositives / correct.length : 0;
        const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

        return { isCorrect: f1 >= 0.8, pointsAwarded: Math.round(f1 * points * 10) / 10 };
      }

      case 'SHORT_ANSWER': {
        // Basic keyword matching
        const answerStr = String(answer).toLowerCase();
        const keywords = Array.isArray(correctAnswer) ? correctAnswer : (correctAnswer.keywords || []);
        const matchCount = keywords.filter((k: string) => answerStr.includes(k.toLowerCase())).length;
        const score = keywords.length > 0 ? matchCount / keywords.length : 0;

        return { isCorrect: score >= 0.6, pointsAwarded: Math.round(score * points * 10) / 10 };
      }

      case 'INCIDENT_REPORT': {
        const report = typeof answer === 'object' ? answer : { summary: String(answer), recommendations: [] };
        const expected = typeof correctAnswer === 'object' ? correctAnswer : { keywords: [], minRecommendations: 3 };

        let score = 0;
        // Check keywords in summary
        const summaryText = (report.summary || '').toLowerCase();
        const keywords = expected.keywords || [];
        const keywordScore = keywords.length > 0
          ? keywords.filter((k: string) => summaryText.includes(k.toLowerCase())).length / keywords.length
          : 0;
        score += keywordScore * 0.5;

        // Check recommendations count
        const recs = report.recommendations || [];
        const minRecs = expected.minRecommendations || 3;
        const recScore = Math.min(recs.length / minRecs, 1);
        score += recScore * 0.5;

        return { isCorrect: score >= 0.6, pointsAwarded: Math.round(score * points * 10) / 10 };
      }

      case 'YARA_RULE': {
        const { YaraService } = await import('./yara.service');

        // correctAnswer might be a JSON string (Prisma Json field edge case)
        let correctData = correctAnswer;
        if (typeof correctData === 'string') {
          try { correctData = JSON.parse(correctData); } catch { correctData = {}; }
        }
        if (typeof correctData !== 'object' || correctData === null) correctData = {};
        const samples = (correctData as any).samples || [];

        logger.debug(`[YARA Scoring] Checkpoint ${checkpoint.id}: ${samples.length} samples, answer length: ${String(answer).length}`);

        const sanitizedRule = YaraService.sanitizeRule(String(answer));
        const result = await YaraService.testRule(sanitizedRule, samples);

        logger.debug(`[YARA Scoring] Result: compiled=${result.compiled}, accuracy=${result.accuracy}, error=${result.compileError || 'none'}`);

        if (!result.compiled) {
          logger.debug(`[YARA Scoring] Compile failed: ${result.compileError}`);
          return { isCorrect: false, pointsAwarded: 0 };
        }

        const pointsAwarded = Math.round(result.accuracy * points * 10) / 10;
        return { isCorrect: result.accuracy >= 0.8, pointsAwarded };
      }

      default:
        return { isCorrect: false, pointsAwarded: 0 };
    }
  }

  static async recalculateScores(attemptId: string): Promise<void> {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: { include: { checkpoint: true } },
        actions: true,
        session: {
          include: {
            scenario: {
              include: {
                checkpoints: true,
                stages: { include: { logs: { where: { isEvidence: true } } } },
              },
            },
          },
        },
      },
    });

    if (!attempt) return;

    const scenario = attempt.session.scenario;
    const allCheckpoints = scenario.checkpoints;

    // 1. Accuracy Score (35 points)
    const accuracyCps = allCheckpoints.filter(c =>
      c.category === 'accuracy' || ['TRUE_FALSE', 'MULTIPLE_CHOICE', 'SEVERITY_CLASSIFICATION'].includes(c.checkpointType)
    );
    const accuracyMax = accuracyCps.reduce((s, c) => s + c.points, 0);
    const accuracyEarned = attempt.answers
      .filter(a => accuracyCps.some(c => c.id === a.checkpointId))
      .reduce((s, a) => s + a.pointsAwarded, 0);
    const accuracyScore = accuracyMax > 0 ? (accuracyEarned / accuracyMax) * 35 : 0;

    // 2. Investigation Score (20 points)
    const searches = attempt.actions.filter(a => a.actionType === 'SEARCH_QUERY');
    const filters = attempt.actions.filter(a => a.actionType === 'FILTER_APPLIED');
    const logsOpened = attempt.actions.filter(a => a.actionType === 'LOG_OPENED');
    const timelineEntries = attempt.actions.filter(a => a.actionType === 'TIMELINE_ENTRY_ADDED');
    const processNodes = attempt.actions.filter(a => a.actionType === 'PROCESS_NODE_ADDED');

    const searchDiversity = Math.min(new Set(searches.map(s => JSON.stringify(s.details))).size / 5, 1) * 5;
    const filterUsage = Math.min(filters.length / 5, 1) * 5;
    const logDepth = Math.min(logsOpened.length / 10, 1) * 5;
    const buildingScore = Math.min((timelineEntries.length + processNodes.length) / 5, 1) * 5;
    const investigationScore = searchDiversity + filterUsage + logDepth + buildingScore;

    // 3. Evidence Score (20 points)
    const evidenceActions = attempt.actions.filter(a => a.actionType === 'EVIDENCE_ADDED');
    const selectedEvidence = evidenceActions.map(a => (a.details as any)?.logId).filter(Boolean);
    const correctEvidence = scenario.stages.flatMap(s => s.logs.map(l => l.id));

    const tp = selectedEvidence.filter(id => correctEvidence.includes(id)).length;
    const precision = selectedEvidence.length > 0 ? tp / selectedEvidence.length : 0;
    const recall = correctEvidence.length > 0 ? tp / correctEvidence.length : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const evidenceScore = f1 * 20;

    // 4. Response Score (15 points)
    const responseCps = allCheckpoints.filter(c => c.category === 'response' || c.checkpointType === 'RECOMMENDED_ACTION');
    const responseMax = responseCps.reduce((s, c) => s + c.points, 0);
    const responseEarned = attempt.answers
      .filter(a => responseCps.some(c => c.id === a.checkpointId))
      .reduce((s, a) => s + a.pointsAwarded, 0);
    const responseScore = responseMax > 0 ? (responseEarned / responseMax) * 15 : 0;

    // 5. Report Score (10 points)
    const reportCps = allCheckpoints.filter(c => c.category === 'report' || c.checkpointType === 'INCIDENT_REPORT');
    const reportMax = reportCps.reduce((s, c) => s + c.points, 0);
    const reportEarned = attempt.answers
      .filter(a => reportCps.some(c => c.id === a.checkpointId))
      .reduce((s, a) => s + a.pointsAwarded, 0);
    const reportScore = reportMax > 0 ? (reportEarned / reportMax) * 10 : 0;

    // Total
    const totalScore = Math.max(0, Math.round(
      (accuracyScore + investigationScore + evidenceScore + responseScore + reportScore - attempt.hintPenalty + attempt.trainerAdjustment) * 10
    ) / 10);

    await prisma.attempt.update({
      where: { id: attemptId },
      data: {
        accuracyScore: Math.round(accuracyScore * 10) / 10,
        investigationScore: Math.round(investigationScore * 10) / 10,
        evidenceScore: Math.round(evidenceScore * 10) / 10,
        responseScore: Math.round(responseScore * 10) / 10,
        reportScore: Math.round(reportScore * 10) / 10,
        totalScore,
      },
    });
  }
}
