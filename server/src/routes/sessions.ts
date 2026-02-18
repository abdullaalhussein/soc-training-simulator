import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { auditLog } from '../middleware/audit';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = {};
    if (req.user!.role === 'TRAINER') {
      where.createdById = req.user!.userId;
    } else if (req.user!.role === 'TRAINEE') {
      where.members = { some: { userId: req.user!.userId } };
      where.status = 'ACTIVE';
    }
    if (req.query.status) where.status = req.query.status;

    const sessions = await prisma.session.findMany({
      where,
      include: {
        scenario: { select: { id: true, name: true, difficulty: true, category: true, estimatedMinutes: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { members: true, attempts: true } },
        members: req.user!.role === 'TRAINEE' ? { where: { userId: req.user!.userId } } : false,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(sessions);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id as string;
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        scenario: {
          include: {
            stages: {
              include: { hints: { orderBy: { sortOrder: 'asc' } } },
              orderBy: { stageNumber: 'asc' },
            },
          },
        },
        createdBy: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        attempts: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { totalScore: 'desc' },
        },
      },
    });
    if (!session) throw new AppError('Session not found', 404);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('ADMIN', 'TRAINER'), auditLog('CREATE', 'SESSION'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, scenarioId, timeLimit, memberIds } = req.body;

    const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } });
    if (!scenario) throw new AppError('Scenario not found', 404);

    const session = await prisma.session.create({
      data: {
        name,
        scenarioId,
        createdById: req.user!.userId,
        timeLimit,
        members: memberIds ? {
          create: memberIds.map((userId: string) => ({ userId })),
        } : undefined,
      },
      include: {
        scenario: { select: { id: true, name: true, difficulty: true } },
        members: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole('ADMIN', 'TRAINER'), auditLog('UPDATE', 'SESSION'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id as string;
    const { name, timeLimit } = req.body;
    const session = await prisma.session.update({
      where: { id: sessionId },
      data: { name, timeLimit },
    });
    res.json(session);
  } catch (error) {
    next(error);
  }
});

router.put('/:id/status', requireRole('ADMIN', 'TRAINER'), auditLog('STATUS_CHANGE', 'SESSION'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id as string;
    const { status } = req.body;
    const data: any = { status };

    if (status === 'ACTIVE') data.startedAt = new Date();
    if (status === 'COMPLETED') data.endedAt = new Date();

    const session = await prisma.session.update({
      where: { id: sessionId },
      data,
    });
    res.json(session);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/members', requireRole('ADMIN', 'TRAINER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id as string;
    const { userIds } = req.body;
    const created = await prisma.sessionMember.createMany({
      data: userIds.map((userId: string) => ({
        sessionId,
        userId,
      })),
      skipDuplicates: true,
    });
    res.status(201).json({ count: created.count });
  } catch (error) {
    next(error);
  }
});

// Delete a session (only COMPLETED or DRAFT sessions)
router.delete('/:id', requireRole('ADMIN', 'TRAINER'), auditLog('DELETE', 'SESSION'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id as string;
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new AppError('Session not found', 404);
    if (!['COMPLETED', 'DRAFT'].includes(session.status)) {
      throw new AppError('Only completed or draft sessions can be deleted', 400);
    }

    // Delete in order to satisfy foreign key constraints
    const attempts = await prisma.attempt.findMany({ where: { sessionId }, select: { id: true } });
    const attemptIds = attempts.map(a => a.id);

    if (attemptIds.length > 0) {
      await prisma.investigationAction.deleteMany({ where: { attemptId: { in: attemptIds } } });
      await prisma.answer.deleteMany({ where: { attemptId: { in: attemptIds } } });
      await prisma.trainerNote.deleteMany({ where: { attemptId: { in: attemptIds } } });
      await prisma.attempt.deleteMany({ where: { sessionId } });
    }

    await prisma.sessionMessage.deleteMany({ where: { sessionId } });
    await prisma.sessionMember.deleteMany({ where: { sessionId } });
    await prisma.session.delete({ where: { id: sessionId } });

    res.json({ message: 'Session deleted' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/members/:userId', requireRole('ADMIN', 'TRAINER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id as string;
    const userId = req.params.userId as string;
    await prisma.sessionMember.deleteMany({
      where: { sessionId, userId },
    });
    res.json({ message: 'Member removed' });
  } catch (error) {
    next(error);
  }
});

export { router as sessionsRouter };
