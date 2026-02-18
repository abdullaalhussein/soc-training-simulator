import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma';

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

    // Audit log successful login
    try {
      await prisma.auditLog.create({
        data: {
          userId: result.user.id,
          action: 'LOGIN',
          resource: 'auth',
          details: { email, method: req.method, path: req.path },
          ipAddress: req.ip || req.socket.remoteAddress,
        },
      });
    } catch {
      // Don't fail the login if audit logging fails
    }

    res.json(result);
  } catch (error) {
    // Audit log failed login attempt
    try {
      const email = req.body?.email;
      await prisma.auditLog.create({
        data: {
          action: 'LOGIN_FAILED',
          resource: 'auth',
          details: { email: email || 'unknown', method: req.method, path: req.path },
          ipAddress: req.ip || req.socket.remoteAddress,
        },
      });
    } catch {
      // Don't fail the request if audit logging fails
    }

    if (error instanceof z.ZodError) {
      return next(new AppError('Invalid email or password format', 400));
    }
    next(error);
  }
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token required'),
});

router.post('/refresh', authRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await AuthService.refresh(refreshToken);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError('Refresh token required', 400));
    }
    next(error);
  }
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token required'),
});

router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = logoutSchema.parse(req.body);
    await AuthService.logout(refreshToken);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError('Refresh token required', 400));
    }
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
