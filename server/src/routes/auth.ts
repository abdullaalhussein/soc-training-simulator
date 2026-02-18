import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import rateLimit from 'express-rate-limit';

const router = Router();

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 attempts per window
  message: { error: { message: 'Too many login attempts, please try again later' } },
  keyGenerator: (req) => req.ip || 'unknown',
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', authRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await AuthService.login(email, password);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError('Invalid email or password format', 400));
    }
    next(error);
  }
});

router.post('/refresh', authRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new AppError('Refresh token required', 400);
    }
    const result = await AuthService.refresh(refreshToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await AuthService.getMe(req.user!.userId);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
