import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import { ScoringService } from '../services/scoring.service';
import prisma from '../lib/prisma';
import { ActionType } from '@prisma/client';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

const router = Router();

// M-6: Rate limit investigation action tracking to prevent score inflation
const actionRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 actions per minute per user
  message: { error: { message: 'Too many actions, please slow down' } },
  keyGenerator: (req) => req.user?.userId || req.ip || 'unknown',
});

const startAttemptSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  userId: z.string().optional(),
});

const submitAnswerSchema = z.object({
  checkpointId: z.string().min(1, 'checkpointId is required'),
  answer: z.any().refine((val) => val !== undefined && val !== null, { message: 'answer is required' }),
});

const trackActionSchema = z.object({
  actionType: z.nativeEnum(ActionType, { errorMap: () => ({ message: 'Invalid actionType' }) }),
  details: z.any().optional().refine(
    (val) => val === undefined || val === null || JSON.stringify(val).length <= 100000,
    { message: 'details too large (max 100KB)' }
  ),
});

router.use(authenticate);

// Start an attempt (trainers can pass userId to start on behalf of a trainee)
router.post('/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = startAttemptSchema.parse(req.body);
    const sessionId = parsed.sessionId;
    const targetUserId = parsed.userId;

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

    // M-2: Audit log attempt start
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'ATTEMPT_START',
          resource: 'attempt',
          resourceId: attempt.id,
          details: { sessionId, attemptNumber: attempt.attemptNumber },
          ipAddress: req.ip || req.socket.remoteAddress,
        },
      });
    } catch { /* non-fatal */ }

    // Strip sensitive fields for trainee users
    if (req.user!.role === 'TRAINEE') {
      const sanitized = {
        ...attempt,
        session: {
          ...attempt.session,
          scenario: {
            ...attempt.session.scenario,
            checkpoints: attempt.session.scenario.checkpoints.map(({ correctAnswer, explanation, ...cp }: any) => cp),
            stages: attempt.session.scenario.stages.map((stage: any) => ({
              ...stage,
              hints: stage.hints?.map(({ content, ...hint }: any) => hint) ?? [],
              logs: stage.logs?.map(({ isEvidence, evidenceTag, ...log }: any) => log) ?? [],
            })),
          },
        },
      };
      return res.status(201).json(sanitized);
    }

    res.status(201).json(attempt);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors.map(e => e.message).join(', '), 400));
    }
    next(error);
  }
});

// Batch re-grade attempts (ADMIN only) — must be before /:id routes
router.post('/regrade-batch', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, scenarioId } = z.object({
      sessionId: z.string().optional(),
      scenarioId: z.string().optional(),
    }).parse(req.body);

    if (!sessionId && !scenarioId) throw new AppError('Either sessionId or scenarioId is required', 400);

    const where: any = { status: 'COMPLETED' };
    if (sessionId) where.sessionId = sessionId;
    if (scenarioId) where.session = { scenarioId };

    const attempts = await prisma.attempt.findMany({
      where,
      select: { id: true },
      take: 100,
      orderBy: { completedAt: 'desc' },
    });

    const batchResults: { attemptId: string; oldTotal: number; newTotal: number }[] = [];

    for (const { id: attemptId } of attempts) {
      const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
          answers: { include: { checkpoint: true } },
          session: { include: { scenario: { select: { briefing: true } } } },
        },
      });
      if (!attempt) continue;

      const scenarioContext = attempt.session?.scenario?.briefing;
      const oldTotal = attempt.totalScore;

      for (const ans of attempt.answers) {
        const { isCorrect, pointsAwarded, feedback } = await ScoringService.gradeAnswer(ans.checkpoint, ans.answer, scenarioContext);
        await prisma.answer.update({
          where: { id: ans.id },
          data: { isCorrect, pointsAwarded, feedback: feedback || null },
        });
      }

      await ScoringService.recalculateScores(attemptId);
      const updated = await prisma.attempt.findUnique({ where: { id: attemptId } });
      batchResults.push({ attemptId, oldTotal, newTotal: updated?.totalScore ?? 0 });
    }

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: 'ATTEMPT_REGRADE_BATCH',
          resource: 'attempt',
          resourceId: sessionId || scenarioId || 'batch',
          details: { count: batchResults.length, sessionId, scenarioId },
          ipAddress: req.ip || req.socket.remoteAddress,
        },
      });
    } catch { /* non-fatal */ }

    res.json({ count: batchResults.length, results: batchResults });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors.map(e => e.message).join(', '), 400));
    }
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

    // Strip sensitive fields for trainee users
    if (req.user!.role === 'TRAINEE') {
      const sanitized = {
        ...attempt,
        session: {
          ...attempt.session,
          scenario: {
            ...attempt.session.scenario,
            checkpoints: attempt.session.scenario.checkpoints.map(({ correctAnswer, explanation, ...cp }: any) => cp),
            stages: attempt.session.scenario.stages.map((stage: any) => ({
              ...stage,
              hints: stage.hints?.map(({ content, ...hint }: any) => hint) ?? [],
              logs: stage.logs?.map(({ isEvidence, evidenceTag, ...log }: any) => log) ?? [],
            })),
          },
        },
        savedEvidence: savedEvidence.map(({ isEvidence, evidenceTag, ...log }: any) => log),
        savedTimeline,
      };
      return res.json(sanitized);
    }

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

    const { checkpointId, answer } = submitAnswerSchema.parse(req.body);

    const checkpoint = await prisma.checkpoint.findUnique({ where: { id: checkpointId } });
    if (!checkpoint) throw new AppError('Checkpoint not found', 404);

    // Fetch scenario briefing for AI context
    let scenarioContext: string | undefined;
    try {
      const attemptWithScenarioBriefing = await prisma.attempt.findUnique({
        where: { id: attemptId },
        include: { session: { include: { scenario: { select: { briefing: true } } } } },
      });
      scenarioContext = attemptWithScenarioBriefing?.session?.scenario?.briefing;
    } catch { /* non-critical */ }

    const { isCorrect, pointsAwarded, feedback } = await ScoringService.gradeAnswer(checkpoint, answer, scenarioContext);

    const savedAnswer = await prisma.answer.upsert({
      where: { attemptId_checkpointId: { attemptId, checkpointId } },
      update: { answer, isCorrect, pointsAwarded, feedback: feedback || null },
      create: { attemptId, checkpointId, answer, isCorrect, pointsAwarded, feedback: feedback || null },
    });

    // Recalculate scores
    await ScoringService.recalculateScores(attemptId);

    // Record CHECKPOINT_ANSWERED action for trainer activity feed
    await prisma.investigationAction.create({
      data: {
        attemptId,
        actionType: 'CHECKPOINT_ANSWERED',
        details: {
          question: checkpoint.question,
          isCorrect,
          pointsAwarded,
          checkpointType: checkpoint.checkpointType,
        },
      },
    });

    const response: any = { ...savedAnswer, feedback: savedAnswer.feedback || feedback || undefined };

    // Include correct answer + explanation on wrong answers for all difficulty levels
    if (!isCorrect) {
      response.correctAnswer = checkpoint.correctAnswer;
      response.explanation = checkpoint.explanation;
      response.checkpointType = checkpoint.checkpointType;
      response.options = checkpoint.options;
    }

    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors.map(e => e.message).join(', '), 400));
    }
    next(error);
  }
});

// Track investigation actions — M-6: rate limited
router.post('/:id/actions', actionRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.id as string;
    const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new AppError('Attempt not found', 404);
    if (attempt.userId !== req.user!.userId && !['ADMIN', 'TRAINER'].includes(req.user!.role)) {
      throw new AppError('Access denied', 403);
    }

    const { actionType, details } = trackActionSchema.parse(req.body);
    const action = await prisma.investigationAction.create({
      data: { attemptId, actionType, details },
    });
    res.status(201).json(action);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors.map(e => e.message).join(', '), 400));
    }
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

    const { hintId } = z.object({ hintId: z.string().min(1, 'hintId is required') }).parse(req.body);
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

    // M-2: Audit log attempt completion
    try {
      await prisma.auditLog.create({
        data: {
          userId: attempt.userId,
          action: 'ATTEMPT_COMPLETE',
          resource: 'attempt',
          resourceId: attemptId,
          details: { sessionId: attempt.sessionId, totalScore: completed.totalScore },
          ipAddress: req.ip || req.socket.remoteAddress,
        },
      });
    } catch { /* non-fatal */ }

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

    // Strip sensitive checkpoint data for trainee users when attempt is not completed
    if (req.user!.role === 'TRAINEE' && attempt.status !== 'COMPLETED') {
      const sanitized = {
        ...attempt,
        answers: attempt.answers.map((answer: any) => ({
          ...answer,
          checkpoint: answer.checkpoint
            ? (({ correctAnswer, explanation, ...cp }: any) => cp)(answer.checkpoint)
            : answer.checkpoint,
        })),
      };
      return res.json(sanitized);
    }

    res.json(attempt);
  } catch (error) {
    next(error);
  }
});

// Get AI assistant messages for an attempt
router.get('/:id/ai-messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.id as string;
    const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new AppError('Attempt not found', 404);
    if (attempt.userId !== req.user!.userId && !['ADMIN', 'TRAINER'].includes(req.user!.role)) {
      throw new AppError('Access denied', 403);
    }

    const messages = await prisma.aiAssistantMessage.findMany({
      where: { attemptId },
      orderBy: { createdAt: 'asc' },
    });

    res.json(messages);
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

// Re-grade a single attempt (ADMIN/TRAINER only)
router.post('/:id/regrade', requireRole('ADMIN', 'TRAINER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = req.params.id as string;
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: { include: { checkpoint: true } },
        session: { include: { scenario: { select: { briefing: true } } } },
      },
    });
    if (!attempt) throw new AppError('Attempt not found', 404);
    if (attempt.status !== 'COMPLETED') throw new AppError('Only completed attempts can be re-graded', 400);

    const scenarioContext = attempt.session?.scenario?.briefing;
    const results: { checkpointId: string; question: string; oldScore: number; newScore: number; oldCorrect: boolean; newCorrect: boolean }[] = [];

    for (const ans of attempt.answers) {
      const oldScore = ans.pointsAwarded;
      const oldCorrect = ans.isCorrect;
      const { isCorrect, pointsAwarded, feedback } = await ScoringService.gradeAnswer(ans.checkpoint, ans.answer, scenarioContext);

      await prisma.answer.update({
        where: { id: ans.id },
        data: { isCorrect, pointsAwarded, feedback: feedback || null },
      });

      results.push({
        checkpointId: ans.checkpointId,
        question: ans.checkpoint.question,
        oldScore,
        newScore: pointsAwarded,
        oldCorrect,
        newCorrect: isCorrect,
      });
    }

    // Recalculate dimension scores
    const oldTotal = attempt.totalScore;
    await ScoringService.recalculateScores(attemptId);
    const updated = await prisma.attempt.findUnique({ where: { id: attemptId } });

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: 'ATTEMPT_REGRADE',
          resource: 'attempt',
          resourceId: attemptId,
          details: { oldTotal, newTotal: updated?.totalScore, changedAnswers: results.filter(r => r.oldScore !== r.newScore).length },
          ipAddress: req.ip || req.socket.remoteAddress,
        },
      });
    } catch { /* non-fatal */ }

    res.json({
      attemptId,
      oldTotal,
      newTotal: updated?.totalScore,
      answers: results,
    });
  } catch (error) {
    next(error);
  }
});

export { router as attemptsRouter };
