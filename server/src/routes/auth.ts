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

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth',
};

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

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    // Return token and user only (no refreshToken in body)
    res.json({ token: result.token, user: result.user });
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

router.post('/refresh', authRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return next(new AppError('Refresh token required', 400));
    }

    const result = await AuthService.refresh(refreshToken);

    // Set new refresh token cookie (rotation)
    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    // Return only the new access token
    res.json({ token: result.token });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      await AuthService.logout(refreshToken);
    }

    // Clear the refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/api/auth',
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

router.post('/change-password', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const isValid = await AuthService.comparePassword(currentPassword, user.password);
    if (!isValid) {
      return next(new AppError('Current password is incorrect', 400));
    }

    const hashedPassword = await AuthService.hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Invalidate all refresh tokens so the user must re-login
    await AuthService.logoutAll(userId);

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'CHANGE_PASSWORD',
          resource: 'auth',
          details: { method: req.method, path: req.path },
          ipAddress: req.ip || req.socket.remoteAddress,
        },
      });
    } catch {
      // Don't fail if audit logging fails
    }

    // Clear the refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/api/auth',
    });

    res.json({ message: 'Password changed successfully. Please log in again.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
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
