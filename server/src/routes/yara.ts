import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { YaraService } from '../services/yara.service';
import prisma from '../lib/prisma';
import rateLimit from 'express-rate-limit';

const router = Router();

router.use(authenticate);

const yaraRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: { message: 'Too many YARA requests, please try again later' } },
  keyGenerator: (req) => req.user?.userId || req.ip || 'unknown',
});

// Test a YARA rule against checkpoint samples
router.post('/test', yaraRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { checkpointId, ruleText } = req.body;

    if (!checkpointId || !ruleText) {
      throw new AppError('checkpointId and ruleText are required', 400);
    }

    // Validate rule text size
    if (typeof ruleText !== 'string' || ruleText.length > 50000) {
      throw new AppError('Rule text must be a string of at most 50000 characters', 400);
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

    // Validate sample limits
    if (samples.length > 10) {
      throw new AppError('Too many samples (max 10)', 400);
    }
    const MAX_SAMPLE_SIZE = 1 * 1024 * 1024; // 1MB
    for (const sample of samples) {
      if (sample.content) {
        const decoded = Buffer.from(sample.content, 'base64');
        if (decoded.length > MAX_SAMPLE_SIZE) {
          throw new AppError(`Sample "${sample.name}" exceeds 1MB size limit`, 400);
        }
      }
    }

    const sanitized = YaraService.sanitizeRule(ruleText);
    const result = await YaraService.testRule(sanitized, samples);

    // M-2: Audit log YARA execution
    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: 'YARA_TEST',
          resource: 'yara',
          resourceId: checkpointId,
          details: { ruleLength: ruleText.length, sampleCount: samples.length, compiled: result.compiled, accuracy: result.accuracy },
          ipAddress: req.ip || req.socket.remoteAddress,
        },
      });
    } catch { /* non-fatal */ }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export { router as yaraRouter };
