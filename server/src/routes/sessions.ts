import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { auditLog } from '../middleware/audit';
import { AppError } from '../middleware/errorHandler';
import prisma from '../lib/prisma';

// Zod validation schemas
const createSessionSchema = z.object({
  name: z.string().min(1).max(200),
  scenarioId: z.string(),
  timeLimit: z.number().positive().optional(),
  memberIds: z.array(z.string()).optional(),
});

const updateSessionSchema = z.object({
  name: z.string().max(200).optional(),
  timeLimit: z.number().positive().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']),
});

const addMembersSchema = z.object({
  userIds: z.array(z.string()).min(1),
});

const router = Router();

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
    if (req.query.status && req.user!.role !== 'TRAINEE') {
      where.status = req.query.status;
    }

    const sessions = await prisma.session.findMany({
      where,
      include: {
        scenario: { select: { id: true, name: true, difficulty: true, category: true, estimatedMinutes: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { members: true, attempts: true } },
        members: req.user!.role === 'TRAINEE' ? { where: { userId: req.user!.userId } } : false,
        attempts: req.user!.role === 'TRAINEE' ? {
          where: { userId: req.user!.userId, status: { not: 'RETAKEN' } },
          select: { id: true, status: true, totalScore: true },
          orderBy: { createdAt: 'desc' },
        } : false,
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
          where: { status: { not: 'RETAKEN' } },
          include: {
            user: { select: { id: true, name: true, email: true } },
            _count: { select: { aiMessages: true } },
          },
          orderBy: { totalScore: 'desc' },
        },
      },
    });
    if (!session) throw new AppError('Session not found', 404);

    // Authorization check
    const role = req.user!.role;
    if (role === 'TRAINER' && session.createdById !== req.user!.userId) {
      throw new AppError('Access denied', 403);
    } else if (role === 'TRAINEE') {
      const isMember = session.members.some((m: any) => m.userId === req.user!.userId);
      if (!isMember) throw new AppError('Access denied', 403);
    }

    res.json(session);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('ADMIN', 'TRAINER'), auditLog('CREATE', 'SESSION'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSessionSchema.parse(req.body);
    const { name, scenarioId, timeLimit, memberIds } = parsed;

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
    const parsed = updateSessionSchema.parse(req.body);
    const { name, timeLimit } = parsed;

    const existing = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!existing) throw new AppError('Session not found', 404);
    if (req.user!.role === 'TRAINER' && existing.createdById !== req.user!.userId) {
      throw new AppError('Access denied', 403);
    }

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
    const parsed = updateStatusSchema.parse(req.body);
    const { status } = parsed;

    const existing = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!existing) throw new AppError('Session not found', 404);
    if (req.user!.role === 'TRAINER' && existing.createdById !== req.user!.userId) {
      throw new AppError('Access denied', 403);
    }

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
    const parsed = addMembersSchema.parse(req.body);
    const { userIds } = parsed;

    const existing = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!existing) throw new AppError('Session not found', 404);
    if (req.user!.role === 'TRAINER' && existing.createdById !== req.user!.userId) {
      throw new AppError('Access denied', 403);
    }

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

// Delete a session (admins can delete any session; trainers only COMPLETED/DRAFT own sessions)
router.delete('/:id', requireRole('ADMIN', 'TRAINER'), auditLog('DELETE', 'SESSION'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id as string;
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new AppError('Session not found', 404);
    if (req.user!.role === 'TRAINER') {
      if (session.createdById !== req.user!.userId) {
        throw new AppError('Access denied', 403);
      }
      if (!['COMPLETED', 'DRAFT'].includes(session.status)) {
        throw new AppError('Only completed or draft sessions can be deleted', 400);
      }
    }

    // Delete in order to satisfy foreign key constraints
    const attempts = await prisma.attempt.findMany({ where: { sessionId }, select: { id: true } });
    const attemptIds = attempts.map(a => a.id);

    if (attemptIds.length > 0) {
      await prisma.aiAssistantMessage.deleteMany({ where: { attemptId: { in: attemptIds } } });
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

    const existing = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!existing) throw new AppError('Session not found', 404);
    if (req.user!.role === 'TRAINER' && existing.createdById !== req.user!.userId) {
      throw new AppError('Access denied', 403);
    }

    await prisma.sessionMember.deleteMany({
      where: { sessionId, userId },
    });
    res.json({ message: 'Member removed' });
  } catch (error) {
    next(error);
  }
});

export { router as sessionsRouter };
