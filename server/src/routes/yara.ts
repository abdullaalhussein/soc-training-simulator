import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { YaraService } from '../services/yara.service';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

// Test a YARA rule against checkpoint samples
router.post('/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { checkpointId, ruleText } = req.body;

    if (!checkpointId || !ruleText) {
      throw new AppError('checkpointId and ruleText are required', 400);
    }

    const checkpoint = await prisma.checkpoint.findUnique({ where: { id: checkpointId } });
    if (!checkpoint) throw new AppError('Checkpoint not found', 404);
    if (checkpoint.checkpointType !== 'YARA_RULE') {
      throw new AppError('Checkpoint is not a YARA_RULE type', 400);
    }

    const correctAnswerData = checkpoint.correctAnswer as any;
    const samples = correctAnswerData?.samples || [];

    if (samples.length === 0) {
      throw new AppError('No samples configured for this checkpoint', 400);
    }

    const sanitized = YaraService.sanitizeRule(ruleText);
    const result = await YaraService.testRule(sanitized, samples);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export { router as yaraRouter };
