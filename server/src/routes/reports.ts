import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import { stringify } from 'csv-stringify/sync';
import { PdfReportService } from '../services/pdf-report.service';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireRole('ADMIN', 'TRAINER'));

// PDF Report for individual attempt
router.get('/attempt/:id/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pdf = await PdfReportService.generateAttemptReport(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report-${req.params.id}.pdf`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

// Session summary
router.get('/session/:id/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: {
        scenario: true,
        attempts: {
          include: { user: { select: { name: true, email: true } } },
          orderBy: { totalScore: 'desc' },
        },
        _count: { select: { members: true } },
      },
    });
    if (!session) throw new AppError('Session not found', 404);

    const completed = session.attempts.filter(a => a.status === 'COMPLETED');
    const avgScore = completed.length > 0
      ? completed.reduce((sum, a) => sum + a.totalScore, 0) / completed.length
      : 0;

    res.json({
      session,
      stats: {
        totalMembers: session._count.members,
        totalAttempts: session.attempts.length,
        completedAttempts: completed.length,
        averageScore: Math.round(avgScore * 10) / 10,
        highestScore: completed.length > 0 ? Math.max(...completed.map(a => a.totalScore)) : 0,
        lowestScore: completed.length > 0 ? Math.min(...completed.map(a => a.totalScore)) : 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Leaderboard
router.get('/session/:id/leaderboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attempts = await prisma.attempt.findMany({
      where: { sessionId: req.params.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { totalScore: 'desc' },
    });

    const leaderboard = attempts.map((a, i) => ({
      rank: i + 1,
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
    const attempts = await prisma.attempt.findMany({
      where: { sessionId: req.params.id },
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
    res.setHeader('Content-Disposition', `attachment; filename=session-${req.params.id}-results.csv`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// Scenario analytics
router.get('/scenario/:id/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attempts = await prisma.attempt.findMany({
      where: {
        session: { scenarioId: req.params.id },
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

    const distribution = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 };
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

export { router as reportsRouter };
