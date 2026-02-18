import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import { ScoringService } from '../services/scoring.service';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

// Start an attempt (trainers can pass userId to start on behalf of a trainee)
router.post('/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, userId: targetUserId } = req.body;

    // Trainers/admins can start for a specific trainee; trainees start for themselves
    const isTrainerOrAdmin = ['ADMIN', 'TRAINER'].includes(req.user!.role);
    const userId = (isTrainerOrAdmin && targetUserId) ? targetUserId : req.user!.userId;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { members: true },
    });
    if (!session) throw new AppError('Session not found', 404);
    if (session.status !== 'ACTIVE') throw new AppError('Session is not active', 400);

    const isMember = session.members.some(m => m.userId === userId);
    if (!isMember && !isTrainerOrAdmin) throw new AppError('Not assigned to this session', 403);

    // Auto-add trainee as member if trainer is starting for them and they aren't a member yet
    if (!isMember && isTrainerOrAdmin && targetUserId) {
      await prisma.sessionMember.create({
        data: { sessionId, userId: targetUserId },
      }).catch(() => { /* already exists */ });
    }

    // Check for existing active attempt (not RETAKEN)
    const existing = await prisma.attempt.findFirst({
      where: { sessionId, userId, status: { notIn: ['RETAKEN'] } },
    });
    if (existing) {
      return res.json(existing);
    }

    // Compute next attemptNumber
    const lastAttempt = await prisma.attempt.findFirst({
      where: { sessionId, userId },
      orderBy: { attemptNumber: 'desc' },
    });
    const attemptNumber = lastAttempt ? lastAttempt.attemptNumber + 1 : 1;

    const attempt = await prisma.attempt.create({
      data: {
        sessionId,
        userId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        currentStage: 1,
        attemptNumber,
      },
      include: {
        session: {
          include: {
            scenario: {
              include: {
                stages: { orderBy: { stageNumber: 'asc' } },
                checkpoints: { orderBy: [{ stageNumber: 'asc' }, { sortOrder: 'asc' }] },
              },
            },
          },
        },
      },
    });

    await prisma.sessionMember.updateMany({
      where: { sessionId, userId },
      data: { status: 'STARTED' },
    });

    res.status(201).json(attempt);
  } catch (error) {
    next(error);
  }
});

// Get attempt details
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.id as string;
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        session: {
          include: {
            scenario: {
              include: {
                stages: {
                  include: { hints: { orderBy: { sortOrder: 'asc' } } },
                  orderBy: { stageNumber: 'asc' },
                },
                checkpoints: { orderBy: [{ stageNumber: 'asc' }, { sortOrder: 'asc' }] },
              },
            },
          },
        },
        answers: true,
        actions: { orderBy: { createdAt: 'desc' }, take: 50 },
        notes: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!attempt) throw new AppError('Attempt not found', 404);
    if (attempt.userId !== req.user!.userId && !['ADMIN', 'TRAINER'].includes(req.user!.role)) {
      throw new AppError('Access denied', 403);
    }

    // Reconstruct saved evidence and timeline from investigation actions
    const allActions = await prisma.investigationAction.findMany({
      where: {
        attemptId,
        actionType: { in: ['EVIDENCE_ADDED', 'EVIDENCE_REMOVED', 'TIMELINE_ENTRY_ADDED', 'TIMELINE_ENTRY_REMOVED'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Reconstruct evidence: track net set of logIds
    const evidenceLogIds = new Set<string>();
    for (const action of allActions) {
      const details = action.details as any;
      if (action.actionType === 'EVIDENCE_ADDED' && details?.logId) {
        evidenceLogIds.add(details.logId);
      } else if (action.actionType === 'EVIDENCE_REMOVED' && details?.logId) {
        evidenceLogIds.delete(details.logId);
      }
    }

    // Fetch full log objects for saved evidence
    let savedEvidence: any[] = [];
    if (evidenceLogIds.size > 0) {
      savedEvidence = await prisma.simulatedLog.findMany({
        where: { id: { in: [...evidenceLogIds] } },
      });
    }

    // Reconstruct timeline: replay add/remove actions
    const timelineMap = new Map<string, any>();
    for (const action of allActions) {
      const details = action.details as any;
      if (action.actionType === 'TIMELINE_ENTRY_ADDED') {
        const entryId = details?.id || action.createdAt.getTime().toString();
        timelineMap.set(entryId, {
          id: entryId,
          logId: details?.logId,
          summary: details?.summary,
          timestamp: details?.timestamp,
        });
      } else if (action.actionType === 'TIMELINE_ENTRY_REMOVED' && details?.entryId) {
        timelineMap.delete(details.entryId);
      }
    }
    const savedTimeline = [...timelineMap.values()];

    res.json({ ...attempt, savedEvidence, savedTimeline });
  } catch (error) {
    next(error);
  }
});

// Submit checkpoint answer
router.post('/:id/answers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.id as string;
    const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new AppError('Attempt not found', 404);
    if (attempt.userId !== req.user!.userId) throw new AppError('Access denied', 403);
    if (attempt.status !== 'IN_PROGRESS') throw new AppError('Attempt is not in progress', 400);

    const { checkpointId, answer } = req.body;

    const checkpoint = await prisma.checkpoint.findUnique({ where: { id: checkpointId } });
    if (!checkpoint) throw new AppError('Checkpoint not found', 404);

    const { isCorrect, pointsAwarded } = await ScoringService.gradeAnswer(checkpoint, answer);

    const savedAnswer = await prisma.answer.upsert({
      where: { attemptId_checkpointId: { attemptId, checkpointId } },
      update: { answer, isCorrect, pointsAwarded },
      create: { attemptId, checkpointId, answer, isCorrect, pointsAwarded },
    });

    // Recalculate scores
    await ScoringService.recalculateScores(attemptId);

    const response: any = { ...savedAnswer };

    // For BEGINNER scenarios, include correct answer + explanation on wrong answers
    if (!isCorrect) {
      const attemptWithScenario = await prisma.attempt.findUnique({
        where: { id: attemptId },
        include: { session: { include: { scenario: { select: { difficulty: true } } } } },
      });
      if (attemptWithScenario?.session?.scenario?.difficulty === 'BEGINNER') {
        response.correctAnswer = checkpoint.correctAnswer;
        response.explanation = checkpoint.explanation;
        response.checkpointType = checkpoint.checkpointType;
        response.options = checkpoint.options;
      }
    }

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Track investigation actions
router.post('/:id/actions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.id as string;
    const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new AppError('Attempt not found', 404);
    if (attempt.userId !== req.user!.userId && !['ADMIN', 'TRAINER'].includes(req.user!.role)) {
      throw new AppError('Access denied', 403);
    }

    const { actionType, details } = req.body;
    const action = await prisma.investigationAction.create({
      data: { attemptId, actionType, details },
    });
    res.status(201).json(action);
  } catch (error) {
    next(error);
  }
});

// Request hint
router.post('/:id/hints', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.id as string;
    const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new AppError('Attempt not found', 404);
    if (attempt.userId !== req.user!.userId) throw new AppError('Access denied', 403);

    const { hintId } = req.body;
    const hint = await prisma.hint.findUnique({ where: { id: hintId } });
    if (!hint) throw new AppError('Hint not found', 404);

    await prisma.attempt.update({
      where: { id: attemptId },
      data: {
        hintsUsed: { increment: 1 },
        hintPenalty: { increment: hint.pointsPenalty },
      },
    });

    await prisma.investigationAction.create({
      data: { attemptId, actionType: 'HINT_REQUESTED', details: { hintId, penalty: hint.pointsPenalty } },
    });

    await ScoringService.recalculateScores(attemptId);

    res.json({ content: hint.content, penalty: hint.pointsPenalty });
  } catch (error) {
    next(error);
  }
});

// Advance stage
router.post('/:id/advance-stage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.id as string;
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { session: { include: { scenario: { include: { stages: true } } } } },
    });
    if (!attempt) throw new AppError('Attempt not found', 404);
    if (attempt.userId !== req.user!.userId && !['ADMIN', 'TRAINER'].includes(req.user!.role)) {
      throw new AppError('Access denied', 403);
    }

    const totalStages = attempt.session.scenario.stages.length;
    if (attempt.currentStage >= totalStages) {
      throw new AppError('Already at final stage', 400);
    }

    const updated = await prisma.attempt.update({
      where: { id: attemptId },
      data: { currentStage: attempt.currentStage + 1 },
    });

    await prisma.investigationAction.create({
      data: { attemptId, actionType: 'STAGE_UNLOCKED', details: { newStage: updated.currentStage } },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Complete attempt
router.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.id as string;
    const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new AppError('Attempt not found', 404);
    if (attempt.userId !== req.user!.userId && req.user!.role === 'TRAINEE') throw new AppError('Access denied', 403);

    await ScoringService.recalculateScores(attemptId);

    const completed = await prisma.attempt.update({
      where: { id: attemptId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    await prisma.sessionMember.updateMany({
      where: { sessionId: attempt.sessionId, userId: attempt.userId },
      data: { status: 'COMPLETED' },
    });

    res.json(completed);
  } catch (error) {
    next(error);
  }
});

// Get attempt results
router.get('/:id/results', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.id as string;
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: { include: { checkpoint: true } },
        actions: { orderBy: { createdAt: 'asc' } },
        notes: { include: { trainer: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
        session: { include: { scenario: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!attempt) throw new AppError('Attempt not found', 404);
    if (attempt.userId !== req.user!.userId && !['ADMIN', 'TRAINER'].includes(req.user!.role)) {
      throw new AppError('Access denied', 403);
    }

    res.json(attempt);
  } catch (error) {
    next(error);
  }
});

// Retake attempt (trainer/admin only)
router.post('/:id/retake', requireRole('ADMIN', 'TRAINER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.id as string;

    const oldAttempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { session: true },
    });
    if (!oldAttempt) throw new AppError('Attempt not found', 404);
    if (!['COMPLETED', 'TIMED_OUT'].includes(oldAttempt.status)) {
      throw new AppError('Only completed or timed-out attempts can be retaken', 400);
    }
    if (oldAttempt.session.status === 'DRAFT') {
      throw new AppError('Session has not been started yet', 400);
    }

    // Ensure no active attempt already exists for this user in this session
    const activeAttempt = await prisma.attempt.findFirst({
      where: {
        sessionId: oldAttempt.sessionId,
        userId: oldAttempt.userId,
        status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
      },
    });
    if (activeAttempt) {
      throw new AppError('Trainee already has an active attempt', 400);
    }

    const newAttempt = await prisma.$transaction(async (tx) => {
      // Mark old attempt as RETAKEN
      await tx.attempt.update({
        where: { id: attemptId },
        data: { status: 'RETAKEN' },
      });

      // Create new attempt
      const created = await tx.attempt.create({
        data: {
          sessionId: oldAttempt.sessionId,
          userId: oldAttempt.userId,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          currentStage: 1,
          attemptNumber: oldAttempt.attemptNumber + 1,
          retakeOfId: oldAttempt.id,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      // Reset session member status to STARTED
      await tx.sessionMember.updateMany({
        where: { sessionId: oldAttempt.sessionId, userId: oldAttempt.userId },
        data: { status: 'STARTED' },
      });

      return created;
    });

    res.status(201).json(newAttempt);
  } catch (error) {
    next(error);
  }
});

export { router as attemptsRouter };
