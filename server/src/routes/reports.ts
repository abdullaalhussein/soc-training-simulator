import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import { stringify } from 'csv-stringify/sync';
import { PdfReportService } from '../services/pdf-report.service';
import prisma from '../lib/prisma';

const router = Router();

router.use(authenticate, requireRole('ADMIN', 'TRAINER'));

// PDF Report for individual attempt
router.get('/attempt/:id/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.id as string;
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { session: true },
    });
    if (!attempt) throw new AppError('Attempt not found', 404);
    if (req.user!.role !== 'ADMIN' && attempt.session.createdById !== req.user!.userId) {
      throw new AppError('Access denied', 403);
    }
    const pdf = await PdfReportService.generateAttemptReport(attemptId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report-${attemptId}.pdf`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

// Session summary
router.get('/session/:id/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id as string;
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        scenario: true,
        attempts: {
          where: { status: { not: 'RETAKEN' } },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { totalScore: 'desc' },
        },
        _count: { select: { members: true } },
      },
    });
    if (!session) throw new AppError('Session not found', 404);
    if (req.user!.role !== 'ADMIN' && session.createdById !== req.user!.userId) {
      throw new AppError('Access denied', 403);
    }

    const completed = session.attempts.filter((a: any) => a.status === 'COMPLETED');
    const avgScore = completed.length > 0
      ? completed.reduce((sum: number, a: any) => sum + a.totalScore, 0) / completed.length
      : 0;

    res.json({
      session,
      stats: {
        totalMembers: session._count.members,
        totalAttempts: session.attempts.length,
        completedAttempts: completed.length,
        averageScore: Math.round(avgScore * 10) / 10,
        highestScore: completed.length > 0 ? Math.max(...completed.map((a: any) => a.totalScore)) : 0,
        lowestScore: completed.length > 0 ? Math.min(...completed.map((a: any) => a.totalScore)) : 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Leaderboard
router.get('/session/:id/leaderboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id as string;
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new AppError('Session not found', 404);
    if (req.user!.role !== 'ADMIN' && session.createdById !== req.user!.userId) {
      throw new AppError('Access denied', 403);
    }
    const attempts = await prisma.attempt.findMany({
      where: { sessionId, status: { not: 'RETAKEN' } },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { totalScore: 'desc' },
    });

    const leaderboard = attempts.map((a, i) => ({
      rank: i + 1,
      attemptId: a.id,
      userId: a.user.id,
      userName: a.user.name,
      email: a.user.email,
      totalScore: a.totalScore,
      accuracyScore: a.accuracyScore,
      investigationScore: a.investigationScore,
      evidenceScore: a.evidenceScore,
      responseScore: a.responseScore,
      reportScore: a.reportScore,
      hintPenalty: a.hintPenalty,
      hintsUsed: a.hintsUsed,
      status: a.status,
      completedAt: a.completedAt,
    }));

    res.json(leaderboard);
  } catch (error) {
    next(error);
  }
});

// CSV export
router.get('/session/:id/csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id as string;
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new AppError('Session not found', 404);
    if (req.user!.role !== 'ADMIN' && session.createdById !== req.user!.userId) {
      throw new AppError('Access denied', 403);
    }
    const attempts = await prisma.attempt.findMany({
      where: { sessionId, status: { not: 'RETAKEN' } },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { totalScore: 'desc' },
    });

    const records = attempts.map((a, i) => ({
      Rank: i + 1,
      'Trainee Name': a.user.name,
      Email: a.user.email,
      Status: a.status,
      'Start Time': a.startedAt?.toISOString() || '',
      'End Time': a.completedAt?.toISOString() || '',
      'Duration (min)': a.startedAt && a.completedAt
        ? Math.round((a.completedAt.getTime() - a.startedAt.getTime()) / 60000)
        : '',
      'Accuracy Score': a.accuracyScore,
      'Investigation Score': a.investigationScore,
      'Evidence Score': a.evidenceScore,
      'Response Score': a.responseScore,
      'Report Score': a.reportScore,
      'Hints Used': a.hintsUsed,
      'Hint Penalty': a.hintPenalty,
      'Trainer Adjustment': a.trainerAdjustment,
      'Total Score': a.totalScore,
    }));

    const csv = stringify(records, { header: true });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=session-${sessionId}-results.csv`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// Scenario analytics
router.get('/scenario/:id/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scenarioId = req.params.id as string;
    const attempts = await prisma.attempt.findMany({
      where: {
        session: { scenarioId },
        status: 'COMPLETED',
      },
      include: { answers: { include: { checkpoint: true } } },
    });

    const totalAttempts = attempts.length;
    const avgScore = totalAttempts > 0
      ? attempts.reduce((sum, a) => sum + a.totalScore, 0) / totalAttempts
      : 0;

    const checkpointStats: Record<string, { question: string; total: number; correct: number }> = {};
    for (const attempt of attempts) {
      for (const answer of attempt.answers) {
        const key = answer.checkpointId;
        if (!checkpointStats[key]) {
          checkpointStats[key] = { question: answer.checkpoint.question, total: 0, correct: 0 };
        }
        checkpointStats[key].total++;
        if (answer.isCorrect) checkpointStats[key].correct++;
      }
    }

    const commonMistakes = Object.entries(checkpointStats)
      .map(([id, stats]) => ({
        checkpointId: id,
        question: stats.question,
        correctRate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        totalAnswers: stats.total,
      }))
      .sort((a, b) => a.correctRate - b.correctRate)
      .slice(0, 5);

    const distribution: Record<string, number> = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 };
    for (const a of attempts) {
      if (a.totalScore <= 20) distribution['0-20']++;
      else if (a.totalScore <= 40) distribution['21-40']++;
      else if (a.totalScore <= 60) distribution['41-60']++;
      else if (a.totalScore <= 80) distribution['61-80']++;
      else distribution['81-100']++;
    }

    res.json({
      totalAttempts,
      averageScore: Math.round(avgScore * 10) / 10,
      scoreDistribution: distribution,
      commonMistakes,
      avgSubScores: {
        accuracy: totalAttempts > 0 ? Math.round(attempts.reduce((s, a) => s + a.accuracyScore, 0) / totalAttempts * 10) / 10 : 0,
        investigation: totalAttempts > 0 ? Math.round(attempts.reduce((s, a) => s + a.investigationScore, 0) / totalAttempts * 10) / 10 : 0,
        evidence: totalAttempts > 0 ? Math.round(attempts.reduce((s, a) => s + a.evidenceScore, 0) / totalAttempts * 10) / 10 : 0,
        response: totalAttempts > 0 ? Math.round(attempts.reduce((s, a) => s + a.responseScore, 0) / totalAttempts * 10) / 10 : 0,
        report: totalAttempts > 0 ? Math.round(attempts.reduce((s, a) => s + a.reportScore, 0) / totalAttempts * 10) / 10 : 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Audit logs
router.get('/audit', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action, userId, from, to, page = '1', pageSize = '50' } = req.query;
    const where: any = {};
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from as string);
      if (to) where.createdAt.lte = new Date(to as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const take = Math.min(parseInt(pageSize as string), 200);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, pagination: { page: parseInt(page as string), pageSize: take, total, totalPages: Math.ceil(total / take) } });
  } catch (error) {
    next(error);
  }
});

// M-4: AI Conversation Review — trainers can view AI conversations per session
router.get('/ai-conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, page = '1', pageSize = '20' } = req.query;

    if (!sessionId) throw new AppError('sessionId is required', 400);

    // Verify trainer owns this session
    const session = await prisma.session.findUnique({
      where: { id: sessionId as string },
      select: { createdById: true },
    });
    if (!session) throw new AppError('Session not found', 404);
    if (req.user!.role !== 'ADMIN' && session.createdById !== req.user!.userId) {
      throw new AppError('Access denied', 403);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const take = Math.min(parseInt(pageSize as string), 50);

    // Get all attempts for this session with AI messages
    const attempts = await prisma.attempt.findMany({
      where: { sessionId: sessionId as string },
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { aiMessages: true } },
      },
      orderBy: { startedAt: 'desc' },
      skip,
      take,
    });

    const total = await prisma.attempt.count({
      where: { sessionId: sessionId as string },
    });

    // Get anomaly flags — jailbreak attempts for this session
    const jailbreakFlags = await prisma.auditLog.findMany({
      where: {
        action: { in: ['AI_JAILBREAK_BLOCKED', 'AI_OUTPUT_FILTERED'] },
        resourceId: { in: attempts.map(a => a.id) },
      },
      select: { resourceId: true, action: true, createdAt: true },
    });

    const flagsByAttempt = new Map<string, { jailbreakBlocked: number; outputFiltered: number }>();
    for (const flag of jailbreakFlags) {
      if (!flag.resourceId) continue;
      const entry = flagsByAttempt.get(flag.resourceId) || { jailbreakBlocked: 0, outputFiltered: 0 };
      if (flag.action === 'AI_JAILBREAK_BLOCKED') entry.jailbreakBlocked++;
      if (flag.action === 'AI_OUTPUT_FILTERED') entry.outputFiltered++;
      flagsByAttempt.set(flag.resourceId, entry);
    }

    const result = attempts.map(a => ({
      attemptId: a.id,
      user: a.user,
      status: a.status,
      messageCount: a._count.aiMessages,
      startedAt: a.startedAt,
      flags: flagsByAttempt.get(a.id) || { jailbreakBlocked: 0, outputFiltered: 0 },
    }));

    res.json({
      conversations: result,
      pagination: { page: parseInt(page as string), pageSize: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    next(error);
  }
});

// M-4: Get full AI conversation for a specific attempt
router.get('/ai-conversations/:attemptId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.attemptId as string;

    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        session: { select: { createdById: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!attempt) throw new AppError('Attempt not found', 404);
    if (req.user!.role !== 'ADMIN' && attempt.session.createdById !== req.user!.userId) {
      throw new AppError('Access denied', 403);
    }

    const messages = await prisma.aiAssistantMessage.findMany({
      where: { attemptId },
      orderBy: { createdAt: 'asc' },
    });

    // Get anomaly flags
    const flags = await prisma.auditLog.findMany({
      where: {
        action: { in: ['AI_JAILBREAK_BLOCKED', 'AI_OUTPUT_FILTERED'] },
        resourceId: attemptId,
      },
      select: { action: true, details: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      attempt: {
        id: attempt.id,
        status: attempt.status,
        user: attempt.user,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
      },
      messages,
      flags,
    });
  } catch (error) {
    next(error);
  }
});

export { router as reportsRouter };
