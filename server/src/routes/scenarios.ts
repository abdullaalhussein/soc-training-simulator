import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { auditLog } from '../middleware/audit';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

// All authenticated users can list/view scenarios
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { difficulty, category, search } = req.query;
    const where: any = {};
    if (req.user!.role === 'TRAINEE') where.isActive = true;
    if (difficulty) where.difficulty = difficulty;
    if (category) where.category = category;
    if (search) where.name = { contains: search as string, mode: 'insensitive' };

    const scenarios = await prisma.scenario.findMany({
      where,
      include: {
        stages: { select: { id: true, stageNumber: true, title: true }, orderBy: { stageNumber: 'asc' } },
        _count: { select: { checkpoints: true, sessions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(scenarios);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scenarioId = req.params.id as string;
    const scenario = await prisma.scenario.findUnique({
      where: { id: scenarioId },
      include: {
        stages: {
          include: {
            hints: { select: { id: true, content: true, pointsPenalty: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } },
            logs: {
              select: {
                id: true, logType: true, summary: true, severity: true,
                hostname: true, username: true, processName: true, eventId: true,
                sourceIp: true, destIp: true, timestamp: true,
                isEvidence: true, evidenceTag: true, sortOrder: true,
              },
              orderBy: { sortOrder: 'asc' },
            },
            _count: { select: { logs: true } },
          },
          orderBy: { stageNumber: 'asc' },
        },
        checkpoints: { orderBy: [{ stageNumber: 'asc' }, { sortOrder: 'asc' }] },
      },
    });
    if (!scenario) throw new AppError('Scenario not found', 404);
    res.json(scenario);
  } catch (error) {
    next(error);
  }
});

// Admin/Trainer can create/update scenarios
router.post('/', requireRole('ADMIN', 'TRAINER'), auditLog('CREATE', 'SCENARIO'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stages, checkpoints, ...scenarioData } = req.body;

    const scenario = await prisma.scenario.create({
      data: {
        ...scenarioData,
        stages: stages ? {
          create: stages.map((s: any) => ({
            stageNumber: s.stageNumber,
            title: s.title,
            description: s.description,
            unlockCondition: s.unlockCondition || 'AFTER_PREVIOUS',
            unlockDelay: s.unlockDelay,
            logs: s.logs ? {
              create: s.logs.map((l: any) => ({
                logType: l.logType,
                rawLog: l.rawLog,
                summary: l.summary,
                severity: l.severity || 'INFO',
                hostname: l.hostname,
                username: l.username,
                processName: l.processName,
                eventId: l.eventId,
                sourceIp: l.sourceIp,
                destIp: l.destIp,
                timestamp: new Date(l.timestamp),
                isEvidence: l.isEvidence || false,
                evidenceTag: l.evidenceTag,
                sortOrder: l.sortOrder || 0,
              })),
            } : undefined,
            hints: s.hints ? {
              create: s.hints.map((h: any) => ({
                content: h.content,
                pointsPenalty: h.pointsPenalty || 5,
                sortOrder: h.sortOrder || 0,
              })),
            } : undefined,
          })),
        } : undefined,
        checkpoints: checkpoints ? {
          create: checkpoints.map((c: any) => ({
            stageNumber: c.stageNumber,
            checkpointType: c.checkpointType,
            question: c.question,
            options: c.options,
            correctAnswer: c.correctAnswer,
            points: c.points || 10,
            category: c.category,
            explanation: c.explanation,
            sortOrder: c.sortOrder || 0,
          })),
        } : undefined,
      },
      include: {
        stages: { include: { _count: { select: { logs: true } } } },
        checkpoints: true,
      },
    });

    res.status(201).json(scenario);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole('ADMIN', 'TRAINER'), auditLog('UPDATE', 'SCENARIO'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scenarioId = req.params.id as string;
    const { stages, checkpoints, ...scenarioData } = req.body;

    if (stages || checkpoints) {
      // Full edit: delete old nested data and recreate in a transaction
      const scenario = await prisma.$transaction(async (tx) => {
        if (stages) {
          await tx.scenarioStage.deleteMany({ where: { scenarioId } });
        }
        if (checkpoints) {
          await tx.checkpoint.deleteMany({ where: { scenarioId } });
        }
        return tx.scenario.update({
          where: { id: scenarioId },
          data: {
            ...scenarioData,
            stages: stages ? {
              create: stages.map((s: any) => ({
                stageNumber: s.stageNumber,
                title: s.title,
                description: s.description,
                unlockCondition: s.unlockCondition || 'AFTER_PREVIOUS',
                unlockDelay: s.unlockDelay,
                logs: s.logs ? {
                  create: s.logs.map((l: any) => ({
                    logType: l.logType,
                    rawLog: l.rawLog,
                    summary: l.summary,
                    severity: l.severity || 'INFO',
                    hostname: l.hostname,
                    username: l.username,
                    processName: l.processName,
                    eventId: l.eventId,
                    sourceIp: l.sourceIp,
                    destIp: l.destIp,
                    timestamp: new Date(l.timestamp),
                    isEvidence: l.isEvidence || false,
                    evidenceTag: l.evidenceTag,
                    sortOrder: l.sortOrder || 0,
                  })),
                } : undefined,
                hints: s.hints ? {
                  create: s.hints.map((h: any) => ({
                    content: h.content,
                    pointsPenalty: h.pointsPenalty || 5,
                    sortOrder: h.sortOrder || 0,
                  })),
                } : undefined,
              })),
            } : undefined,
            checkpoints: checkpoints ? {
              create: checkpoints.map((c: any) => ({
                stageNumber: c.stageNumber,
                checkpointType: c.checkpointType,
                question: c.question,
                options: c.options,
                correctAnswer: c.correctAnswer,
                points: c.points || 10,
                category: c.category,
                explanation: c.explanation,
                sortOrder: c.sortOrder || 0,
              })),
            } : undefined,
          },
          include: {
            stages: { include: { _count: { select: { logs: true } } } },
            checkpoints: true,
          },
        });
      });
      res.json(scenario);
    } else {
      const scenario = await prisma.scenario.update({
        where: { id: scenarioId },
        data: scenarioData,
      });
      res.json(scenario);
    }
  } catch (error) {
    next(error);
  }
});

// Export a scenario as clean JSON
router.get('/:id/export', requireRole('ADMIN', 'TRAINER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scenarioId = req.params.id as string;
    const scenario = await prisma.scenario.findUnique({
      where: { id: scenarioId },
      include: {
        stages: {
          include: {
            logs: { orderBy: { sortOrder: 'asc' } },
            hints: { orderBy: { sortOrder: 'asc' } },
          },
          orderBy: { stageNumber: 'asc' },
        },
        checkpoints: { orderBy: [{ stageNumber: 'asc' }, { sortOrder: 'asc' }] },
      },
    });
    if (!scenario) throw new AppError('Scenario not found', 404);

    const exported = {
      name: scenario.name,
      description: scenario.description,
      difficulty: scenario.difficulty,
      category: scenario.category,
      mitreAttackIds: scenario.mitreAttackIds,
      briefing: scenario.briefing,
      estimatedMinutes: scenario.estimatedMinutes,
      stages: scenario.stages.map((s) => ({
        stageNumber: s.stageNumber,
        title: s.title,
        description: s.description,
        unlockCondition: s.unlockCondition,
        unlockDelay: s.unlockDelay,
        logs: s.logs.map((l) => ({
          logType: l.logType,
          rawLog: l.rawLog,
          summary: l.summary,
          severity: l.severity,
          hostname: l.hostname,
          username: l.username,
          processName: l.processName,
          eventId: l.eventId,
          sourceIp: l.sourceIp,
          destIp: l.destIp,
          timestamp: l.timestamp,
          isEvidence: l.isEvidence,
          evidenceTag: l.evidenceTag,
          sortOrder: l.sortOrder,
        })),
        hints: s.hints.map((h) => ({
          content: h.content,
          pointsPenalty: h.pointsPenalty,
          sortOrder: h.sortOrder,
        })),
      })),
      checkpoints: scenario.checkpoints.map((c) => ({
        stageNumber: c.stageNumber,
        checkpointType: c.checkpointType,
        question: c.question,
        options: c.options,
        correctAnswer: c.correctAnswer,
        points: c.points,
        category: c.category,
        explanation: c.explanation,
        sortOrder: c.sortOrder,
      })),
    };

    const filename = `${scenario.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(exported);
  } catch (error) {
    next(error);
  }
});

// Import a scenario from JSON
router.post('/import', requireRole('ADMIN', 'TRAINER'), auditLog('CREATE', 'SCENARIO'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stages, checkpoints, ...scenarioData } = req.body;

    if (!scenarioData.name) throw new AppError('Scenario name is required', 400);

    const scenario = await prisma.scenario.create({
      data: {
        ...scenarioData,
        stages: stages ? {
          create: stages.map((s: any) => ({
            stageNumber: s.stageNumber,
            title: s.title,
            description: s.description,
            unlockCondition: s.unlockCondition || 'AFTER_PREVIOUS',
            unlockDelay: s.unlockDelay,
            logs: s.logs ? {
              create: s.logs.map((l: any) => ({
                logType: l.logType,
                rawLog: l.rawLog,
                summary: l.summary,
                severity: l.severity || 'INFO',
                hostname: l.hostname,
                username: l.username,
                processName: l.processName,
                eventId: l.eventId,
                sourceIp: l.sourceIp,
                destIp: l.destIp,
                timestamp: new Date(l.timestamp),
                isEvidence: l.isEvidence || false,
                evidenceTag: l.evidenceTag,
                sortOrder: l.sortOrder || 0,
              })),
            } : undefined,
            hints: s.hints ? {
              create: s.hints.map((h: any) => ({
                content: h.content,
                pointsPenalty: h.pointsPenalty || 5,
                sortOrder: h.sortOrder || 0,
              })),
            } : undefined,
          })),
        } : undefined,
        checkpoints: checkpoints ? {
          create: checkpoints.map((c: any) => ({
            stageNumber: c.stageNumber,
            checkpointType: c.checkpointType,
            question: c.question,
            options: c.options,
            correctAnswer: c.correctAnswer,
            points: c.points || 10,
            category: c.category,
            explanation: c.explanation,
            sortOrder: c.sortOrder || 0,
          })),
        } : undefined,
      },
      include: {
        stages: { include: { _count: { select: { logs: true } } } },
        checkpoints: true,
      },
    });

    res.status(201).json(scenario);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRole('ADMIN'), auditLog('DELETE', 'SCENARIO'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scenarioId = req.params.id as string;
    await prisma.scenario.update({ where: { id: scenarioId }, data: { isActive: false } });
    res.json({ message: 'Scenario deactivated' });
  } catch (error) {
    next(error);
  }
});

// Stage management
router.post('/:id/stages', requireRole('ADMIN', 'TRAINER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scenarioId = req.params.id as string;
    const stage = await prisma.scenarioStage.create({
      data: { scenarioId, ...req.body },
    });
    res.status(201).json(stage);
  } catch (error) {
    next(error);
  }
});

// Add logs to a stage
router.post('/:id/stages/:stageId/logs', requireRole('ADMIN', 'TRAINER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stageId = req.params.stageId as string;
    const logs = Array.isArray(req.body) ? req.body : [req.body];
    const created = await prisma.simulatedLog.createMany({
      data: logs.map((l: any) => ({
        stageId,
        logType: l.logType,
        rawLog: l.rawLog,
        summary: l.summary,
        severity: l.severity || 'INFO',
        hostname: l.hostname,
        username: l.username,
        processName: l.processName,
        eventId: l.eventId,
        sourceIp: l.sourceIp,
        destIp: l.destIp,
        timestamp: new Date(l.timestamp),
        isEvidence: l.isEvidence || false,
        evidenceTag: l.evidenceTag,
        sortOrder: l.sortOrder || 0,
      })),
    });
    res.status(201).json({ count: created.count });
  } catch (error) {
    next(error);
  }
});

// Add checkpoints
router.post('/:id/checkpoints', requireRole('ADMIN', 'TRAINER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scenarioId = req.params.id as string;
    const checkpoint = await prisma.checkpoint.create({
      data: { scenarioId, ...req.body },
    });
    res.status(201).json(checkpoint);
  } catch (error) {
    next(error);
  }
});

export { router as scenariosRouter };
