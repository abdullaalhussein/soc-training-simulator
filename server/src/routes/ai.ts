import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import { AIService } from '../services/ai.service';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();

const DAILY_SCENARIO_GEN_LIMIT = parseInt(process.env.AI_DAILY_SCENARIO_LIMIT || '5', 10);

const generateScenarioSchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  mitreAttackIds: z.array(z.string()).optional(),
  numStages: z.number().int().min(1).max(5).optional(),
  category: z.string().max(100).optional(),
});

router.use(authenticate);

// Generate scenario with AI (ADMIN/TRAINER only)
router.post(
  '/generate-scenario',
  requireRole('ADMIN', 'TRAINER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!AIService.isAvailable()) {
        throw new AppError('AI features are not configured. Set ANTHROPIC_API_KEY to enable.', 503);
      }

      // Database-backed daily rate limit per user for scenario generation
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const todayCount = await prisma.auditLog.count({
        where: {
          userId: req.user!.userId,
          action: 'AI_SCENARIO_GENERATE',
          createdAt: { gte: startOfDay },
        },
      });

      if (todayCount >= DAILY_SCENARIO_GEN_LIMIT) {
        throw new AppError(`Daily scenario generation limit reached (${DAILY_SCENARIO_GEN_LIMIT}/day). Try again tomorrow.`, 429);
      }

      const params = generateScenarioSchema.parse(req.body);

      // SSE streaming path — keeps Railway/proxy connections alive
      if (req.headers.accept === 'text/event-stream') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        const stream = AIService.generateScenarioStream(params);
        let aborted = false;

        req.on('close', () => {
          aborted = true;
          stream.abort();
        });

        stream.on('text', (text: string) => {
          if (!aborted) {
            res.write(`event: text\ndata: ${JSON.stringify(text)}\n\n`);
          }
        });

        stream.on('error', (err: any) => {
          if (!aborted) {
            logger.error('AI scenario stream error', {
              message: err?.message,
              status: err?.status,
              type: err?.type || err?.name,
            });
            res.write(`event: error\ndata: ${JSON.stringify({ message: 'Generation failed' })}\n\n`);
            res.end();
          }
        });

        stream.on('end', async () => {
          if (!aborted) {
            res.write(`event: done\ndata: {}\n\n`);
            res.end();
          }
          // Log regardless of abort — the API call was made
          try {
            await prisma.auditLog.create({
              data: {
                userId: req.user!.userId,
                action: 'AI_SCENARIO_GENERATE',
                resource: 'SCENARIO',
                details: { description: params.description.slice(0, 100), streamed: true },
              },
            });
          } catch (logErr) {
            logger.error('Failed to write audit log for streamed generation', logErr);
          }
        });

        return;
      }

      // Non-streaming path (backward compatible)
      const scenario = await AIService.generateScenario(params);

      if (!scenario) {
        throw new AppError('Failed to generate scenario. Please try again.', 500);
      }

      // Log the generation for rate limiting (persists across restarts)
      await prisma.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: 'AI_SCENARIO_GENERATE',
          resource: 'SCENARIO',
          details: { description: params.description.slice(0, 100) },
        },
      });

      res.json(scenario);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError(error.errors.map(e => e.message).join(', '), 400));
      }
      next(error);
    }
  },
);

export { router as aiRouter };
