import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import { AIService } from '../services/ai.service';
import { z } from 'zod';
const router = Router();

const DAILY_SCENARIO_GEN_LIMIT = parseInt(process.env.AI_DAILY_SCENARIO_LIMIT || '5', 10);
const dailyScenarioGenCount = new Map<string, number>();

// Clean up old entries daily
setInterval(() => {
  const today = new Date().toISOString().slice(0, 10);
  for (const key of dailyScenarioGenCount.keys()) {
    if (!key.endsWith(today)) dailyScenarioGenCount.delete(key);
  }
}, 60 * 60 * 1000); // every hour

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

      // Daily rate limit per user for scenario generation (in-memory tracker)
      const todayKey = `${req.user!.userId}:${new Date().toISOString().slice(0, 10)}`;
      const currentCount = dailyScenarioGenCount.get(todayKey) || 0;
      if (currentCount >= DAILY_SCENARIO_GEN_LIMIT) {
        throw new AppError(`Daily scenario generation limit reached (${DAILY_SCENARIO_GEN_LIMIT}/day). Try again tomorrow.`, 429);
      }
      dailyScenarioGenCount.set(todayKey, currentCount + 1);

      const params = generateScenarioSchema.parse(req.body);
      const scenario = await AIService.generateScenario(params);

      if (!scenario) {
        throw new AppError('Failed to generate scenario. Please try again.', 500);
      }

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
