import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma';

const router = Router();

const logRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: { message: 'Too many log requests, please try again later' } },
  keyGenerator: (req) => req.user?.userId || req.ip || 'unknown',
});

router.use(authenticate, logRateLimit);

router.get('/attempt/:attemptId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.attemptId as string;
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        session: {
          include: {
            scenario: {
              include: { stages: { orderBy: { stageNumber: 'asc' } } },
            },
          },
        },
      },
    });

    if (!attempt) throw new AppError('Attempt not found', 404);
    if (attempt.userId !== req.user!.userId && !['ADMIN', 'TRAINER'].includes(req.user!.role)) {
      throw new AppError('Access denied', 403);
    }

    // Only return logs from unlocked stages
    const unlockedStageIds = attempt.session.scenario.stages
      .filter((s: { stageNumber: number }) => s.stageNumber <= attempt.currentStage)
      .map((s: { id: string }) => s.id);

    const {
      logType, hostname, username, processName, eventId,
      sourceIp, destIp, timeFrom, timeTo, search,
      page = '1', pageSize = '50',
    } = req.query;

    const where: any = { stageId: { in: unlockedStageIds } };

    if (logType) where.logType = logType;
    if (hostname) where.hostname = { contains: hostname as string, mode: 'insensitive' };
    if (username) where.username = { contains: username as string, mode: 'insensitive' };
    if (processName) where.processName = { contains: processName as string, mode: 'insensitive' };
    if (eventId) where.eventId = eventId;
    if (sourceIp) where.sourceIp = { contains: sourceIp as string };
    if (destIp) where.destIp = { contains: destIp as string };
    if (timeFrom || timeTo) {
      where.timestamp = {};
      if (timeFrom) {
        const d = new Date(timeFrom as string);
        if (!isNaN(d.getTime())) where.timestamp.gte = d;
      }
      if (timeTo) {
        const d = new Date(timeTo as string);
        if (!isNaN(d.getTime())) where.timestamp.lte = d;
      }
    }
    if (search) {
      where.summary = { contains: search as string, mode: 'insensitive' };
    }

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const size = Math.max(1, Math.min(parseInt(pageSize as string) || 50, 200));
    const skip = (pageNum - 1) * size;
    const take = size;

    const [logs, total] = await Promise.all([
      prisma.simulatedLog.findMany({
        where,
        orderBy: { timestamp: 'asc' },
        skip,
        take,
      }),
      prisma.simulatedLog.count({ where }),
    ]);

    // Strip sensitive fields for trainee users
    const sanitizedLogs = req.user!.role === 'TRAINEE'
      ? logs.map(({ isEvidence, evidenceTag, ...log }: any) => log)
      : logs;

    res.json({
      logs: sanitizedLogs,
      pagination: {
        page: parseInt(page as string),
        pageSize: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get distinct filter values for an attempt
router.get('/attempt/:attemptId/filters', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.attemptId as string;
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        session: {
          include: {
            scenario: { include: { stages: { orderBy: { stageNumber: 'asc' } } } },
          },
        },
      },
    });

    if (!attempt) throw new AppError('Attempt not found', 404);
    if (attempt.userId !== req.user!.userId && !['ADMIN', 'TRAINER'].includes(req.user!.role)) {
      throw new AppError('Access denied', 403);
    }

    const unlockedStageIds = attempt.session.scenario.stages
      .filter((s: { stageNumber: number }) => s.stageNumber <= attempt.currentStage)
      .map((s: { id: string }) => s.id);

    const logs = await prisma.simulatedLog.findMany({
      where: { stageId: { in: unlockedStageIds } },
      select: { logType: true, hostname: true, username: true, processName: true, eventId: true, sourceIp: true, destIp: true },
    });

    const unique = (arr: (string | null)[]) => [...new Set(arr.filter(Boolean))].sort();

    res.json({
      logTypes: unique(logs.map(l => l.logType)),
      hostnames: unique(logs.map(l => l.hostname)),
      usernames: unique(logs.map(l => l.username)),
      processNames: unique(logs.map(l => l.processName)),
      eventIds: unique(logs.map(l => l.eventId)),
      sourceIps: unique(logs.map(l => l.sourceIp)),
      destIps: unique(logs.map(l => l.destIp)),
    });
  } catch (error) {
    next(error);
  }
});

export { router as logsRouter };
