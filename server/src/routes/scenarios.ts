import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { auditLog } from '../middleware/audit';
import { AppError } from '../middleware/errorHandler';
import { scanScenarioContent } from '../utils/sanitizePrompt';
import { AIService } from '../services/ai.service';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';

const router = Router();

const scenarioSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  category: z.string().max(200),
  mitreAttackIds: z.array(z.string()),
  briefing: z.string(),
  lessonContent: z.string().nullable().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
});

const stageSchema = z.object({
  stageNumber: z.number().int().positive(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000),
  unlockCondition: z.enum(['AFTER_CHECKPOINT', 'AFTER_TIME_DELAY', 'AFTER_PREVIOUS', 'MANUAL']).optional(),
  unlockDelay: z.number().int().min(0).nullable().optional(),
});

const checkpointSchema = z.object({
  stageNumber: z.number().int().positive(),
  checkpointType: z.enum(['TRUE_FALSE', 'MULTIPLE_CHOICE', 'SEVERITY_CLASSIFICATION', 'RECOMMENDED_ACTION', 'SHORT_ANSWER', 'EVIDENCE_SELECTION', 'INCIDENT_REPORT', 'YARA_RULE']),
  question: z.string().min(1),
  options: z.any().optional(),
  correctAnswer: z.any(),
  points: z.number().int().min(0).optional(),
  category: z.string().nullable().optional(),
  explanation: z.string().min(1, 'Explanation is required'),
  sortOrder: z.number().int().min(0).optional(),
});

const logSchema = z.object({
  logType: z.enum(['WINDOWS_EVENT', 'SYSMON', 'EDR_ALERT', 'NETWORK_FLOW', 'SIEM_ALERT', 'FIREWALL', 'PROXY', 'DNS', 'EMAIL_GATEWAY', 'AUTH_LOG']),
  rawLog: z.any(),
  timestamp: z.string().or(z.date()),
  summary: z.string(),
  severity: z.string().optional(),
  hostname: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  processName: z.string().nullable().optional(),
  eventId: z.string().nullable().optional(),
  sourceIp: z.string().nullable().optional(),
  destIp: z.string().nullable().optional(),
  isEvidence: z.boolean().optional(),
  evidenceTag: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

router.use(authenticate);

// All authenticated users can list/view scenarios
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { difficulty, category, search } = req.query;
    const where: any = {};
    where.isActive = true;
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

    // Strip sensitive fields for trainee users
    if (req.user!.role === 'TRAINEE') {
      const sanitized = {
        ...scenario,
        checkpoints: scenario.checkpoints.map(({ correctAnswer, explanation, ...cp }: any) => cp),
        stages: scenario.stages.map((stage: any) => ({
          ...stage,
          hints: stage.hints.map(({ content, ...hint }: any) => hint),
          logs: stage.logs.map(({ isEvidence, evidenceTag, ...log }: any) => log),
        })),
      };
      return res.json(sanitized);
    }

    res.json(scenario);
  } catch (error) {
    next(error);
  }
});

// Admin/Trainer can create/update scenarios
router.post('/', requireRole('ADMIN', 'TRAINER'), auditLog('CREATE', 'SCENARIO'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stages, checkpoints, ...rawData } = req.body;
    const scenarioData = scenarioSchema.parse(rawData);

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

    // M-10: Scan scenario content for prompt injection patterns
    const scanResult = scanScenarioContent({
      briefing: scenarioData.briefing,
      stages: stages?.map((s: any) => ({ title: s.title, description: s.description })),
    });
    if (!scanResult.safe) {
      logger.warn('Scenario content flagged for potential prompt injection', {
        scenarioId: scenario.id,
        flaggedFields: scanResult.flaggedFields,
      });
    }

    // T-03: Non-blocking AI-powered injection risk scoring
    const allContent = [
      scenarioData.briefing || '',
      ...(stages || []).map((s: any) => `${s.title} ${s.description}`),
    ].join('\n');
    AIService.scoreInjectionRisk(allContent).then(result => {
      if (result && result.riskScore > 0.5) {
        logger.warn('AI injection risk scoring flagged scenario', {
          scenarioId: scenario.id,
          riskScore: result.riskScore,
          explanation: result.explanation,
        });
        prisma.auditLog.create({
          data: {
            action: 'SCENARIO_INJECTION_RISK',
            resource: 'scenario',
            resourceId: scenario.id,
            details: { riskScore: result.riskScore, explanation: result.explanation },
          },
        }).catch(() => {});
      }
    }).catch(() => {});

    res.status(201).json({ ...scenario, contentWarnings: scanResult.safe ? undefined : scanResult.flaggedFields });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole('ADMIN', 'TRAINER'), auditLog('UPDATE', 'SCENARIO'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scenarioId = req.params.id as string;
    const { stages, checkpoints, ...rawData } = req.body;
    const scenarioData = scenarioSchema.partial().parse(rawData);

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
      // T-03: Non-blocking AI injection risk scoring on update
      const allContent = [
        ...(stages || []).map((s: any) => `${s.title} ${s.description}`),
      ].join('\n');
      if (allContent.trim()) {
        AIService.scoreInjectionRisk(allContent).then(result => {
          if (result && result.riskScore > 0.5) {
            logger.warn('AI injection risk scoring flagged scenario update', {
              scenarioId,
              riskScore: result.riskScore,
              explanation: result.explanation,
            });
            prisma.auditLog.create({
              data: {
                action: 'SCENARIO_INJECTION_RISK',
                resource: 'scenario',
                resourceId: scenarioId,
                details: { riskScore: result.riskScore, explanation: result.explanation },
              },
            }).catch(() => {});
          }
        }).catch(() => {});
      }

      res.json(scenario);
    } else {
      const scenario = await prisma.scenario.update({
        where: { id: scenarioId },
        data: { ...scenarioData },
      });

      // T-03: Non-blocking AI injection risk scoring for metadata-only updates
      if (scenarioData.briefing) {
        AIService.scoreInjectionRisk(scenarioData.briefing).then(result => {
          if (result && result.riskScore > 0.5) {
            logger.warn('AI injection risk scoring flagged scenario update', {
              scenarioId,
              riskScore: result.riskScore,
              explanation: result.explanation,
            });
            prisma.auditLog.create({
              data: {
                action: 'SCENARIO_INJECTION_RISK',
                resource: 'scenario',
                resourceId: scenarioId,
                details: { riskScore: result.riskScore, explanation: result.explanation },
              },
            }).catch(() => {});
          }
        }).catch(() => {});
      }

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
      lessonContent: scenario.lessonContent,
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
    const { stages, checkpoints, ...rawData } = req.body;
    const scenarioData = scenarioSchema.parse(rawData);

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
    const { stageNumber, title, description, unlockCondition, unlockDelay } = stageSchema.parse(req.body);
    const stage = await prisma.scenarioStage.create({
      data: { scenarioId, stageNumber, title, description, unlockCondition, unlockDelay },
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
    const rawLogs = Array.isArray(req.body) ? req.body : [req.body];
    const validatedLogs = z.array(logSchema).parse(rawLogs);
    const created = await prisma.simulatedLog.createMany({
      data: validatedLogs.map((l) => ({
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
    const { stageNumber, checkpointType, question, options, correctAnswer, points, category, explanation, sortOrder } = checkpointSchema.parse(req.body);
    const checkpoint = await prisma.checkpoint.create({
      data: { scenarioId, stageNumber, checkpointType, question, options, correctAnswer, points, category, explanation, sortOrder },
    });
    res.status(201).json(checkpoint);
  } catch (error) {
    next(error);
  }
});

export { router as scenariosRouter };
