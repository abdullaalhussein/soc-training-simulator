import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';
import { AIService } from '../services/ai.service';
import { z } from 'zod';

const router = Router();

const generateScenarioSchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  mitreAttackIds: z.array(z.string()).min(1, 'At least one MITRE ATT&CK ID is required'),
  numStages: z.number().int().min(1).max(5).default(3),
  category: z.string().min(1, 'Category is required').max(100),
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
