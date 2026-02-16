import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import rateLimit from 'express-rate-limit';

const router = Router();
const prisma = new PrismaClient();

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
      if (timeFrom) where.timestamp.gte = new Date(timeFrom as string);
      if (timeTo) where.timestamp.lte = new Date(timeTo as string);
    }
    if (search) {
      where.summary = { contains: search as string, mode: 'insensitive' };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const take = Math.min(parseInt(pageSize as string), 200);

    const [logs, total] = await Promise.all([
      prisma.simulatedLog.findMany({
        where,
        orderBy: { timestamp: 'asc' },
        skip,
        take,
      }),
      prisma.simulatedLog.count({ where }),
    ]);

    res.json({
      logs,
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
