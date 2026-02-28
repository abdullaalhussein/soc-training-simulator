import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { env } from '../config/env';

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

// E-06: Dynamic refresh cookie options based on role (shorter for privileged roles)
function getRefreshCookieOptions(role?: string) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: role ? AuthService.getRefreshMaxAgeMs(role) : 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  };
}

// C-1: Access token cookie — path '/' so it's sent on all requests including Socket.io handshake
const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 4 * 60 * 60 * 1000, // 4 hours (matches JWT_EXPIRES_IN default)
  path: '/',
};

// H-6: Account lockout tracking (in-memory, keyed by email)
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function checkAccountLockout(email: string): { locked: boolean; remainingMs: number } {
  const record = loginAttempts.get(email);
  if (!record) return { locked: false, remainingMs: 0 };
  if (record.lockedUntil > Date.now()) {
    return { locked: true, remainingMs: record.lockedUntil - Date.now() };
  }
  // Lockout expired, reset
  if (record.lockedUntil > 0) {
    loginAttempts.delete(email);
  }
  return { locked: false, remainingMs: 0 };
}

function recordFailedLogin(email: string): void {
  const record = loginAttempts.get(email) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= LOCKOUT_THRESHOLD) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    logger.warn(`Account locked due to ${record.count} failed attempts: ${email}`);
  }
  loginAttempts.set(email, record);
}

function clearFailedLogins(email: string): void {
  loginAttempts.delete(email);
}

// C-3: Default demo credentials
const DEFAULT_DEMO_EMAILS = ['admin@soc.local', 'trainer@soc.local', 'trainee@soc.local'];
const DEFAULT_DEMO_PASSWORD = 'Password123!';

router.post('/login', authRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // H-6: Check account lockout
    const lockout = checkAccountLockout(email);
    if (lockout.locked) {
      const minutes = Math.ceil(lockout.remainingMs / 60000);
      return next(new AppError(`Account temporarily locked. Try again in ${minutes} minute(s).`, 429));
    }

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || undefined;

    let result;
    try {
      result = await AuthService.login(email, password);
    } catch (error) {
      // Record failed login for lockout tracking
      recordFailedLogin(email);

      // S-05: Record failed login in history (non-blocking)
      try {
        const failedUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (failedUser) {
          await prisma.userLoginHistory.create({
            data: { userId: failedUser.id, ipAddress: clientIp, userAgent, success: false },
          });
        }
      } catch { /* non-fatal */ }

      // Audit log failed login attempt
      try {
        await prisma.auditLog.create({
          data: {
            action: 'LOGIN_FAILED',
            resource: 'auth',
            details: { email, method: req.method, path: req.path },
            ipAddress: clientIp,
          },
        });
      } catch {
        // Don't fail the request if audit logging fails
      }

      throw error;
    }

    // Clear lockout on successful login
    clearFailedLogins(email);

    // S-06: Block demo credentials in production unless explicitly allowed
    if (DEFAULT_DEMO_EMAILS.includes(email) && env.NODE_ENV === 'production') {
      const isDefault = await bcrypt.compare(DEFAULT_DEMO_PASSWORD, (await prisma.user.findUnique({ where: { email }, select: { password: true } }))?.password || '');
      if (isDefault && !env.ALLOW_DEMO_CREDENTIALS) {
        return res.status(403).json({
          error: { message: 'Demo credentials are disabled in production. Set ALLOW_DEMO_CREDENTIALS=true or change the password.' },
        });
      }
    }

    // S-05: Record successful login in history + anomaly detection (non-blocking)
    try {
      await prisma.userLoginHistory.create({
        data: { userId: result.user.id, ipAddress: clientIp, userAgent, success: true },
      });

      // Check if this is a new IP for this user
      const previousFromIp = await prisma.userLoginHistory.count({
        where: { userId: result.user.id, ipAddress: clientIp, success: true, createdAt: { lt: new Date() } },
      });
      if (previousFromIp <= 1) {
        // This is effectively a new IP — check if user has logged in from other IPs
        const otherIpLogins = await prisma.userLoginHistory.count({
          where: { userId: result.user.id, success: true, ipAddress: { not: clientIp } },
        });
        if (otherIpLogins > 0) {
          logger.warn('Login from new IP detected', {
            userId: result.user.id,
            email,
            newIp: clientIp,
            previousIpCount: otherIpLogins,
          });
        }
      }
    } catch {
      // Don't fail the login if tracking fails
    }

    // Audit log successful login
    try {
      await prisma.auditLog.create({
        data: {
          userId: result.user.id,
          action: 'LOGIN',
          resource: 'auth',
          details: { email, method: req.method, path: req.path },
          ipAddress: clientIp,
        },
      });
    } catch {
      // Don't fail the login if audit logging fails
    }

    // Set refresh token as httpOnly cookie (E-06: role-based expiry)
    res.cookie('refreshToken', result.refreshToken, getRefreshCookieOptions(result.user.role));

    // C-1: Set access token as httpOnly cookie
    res.cookie('accessToken', result.token, ACCESS_COOKIE_OPTIONS);

    // H-1: Set CSRF token as readable cookie (double-submit pattern)
    const crypto = await import('crypto');
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('csrf', csrfToken, {
      httpOnly: false, // Must be readable by client JS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 4 * 60 * 60 * 1000,
      path: '/',
    });

    // Token is in httpOnly cookie — only return user info in response body
    res.json({ user: result.user });
  } catch (error) {
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

    // Set new refresh token cookie (rotation, E-06: role-based expiry)
    res.cookie('refreshToken', result.refreshToken, getRefreshCookieOptions(result.role));

    // C-1: Set new access token as httpOnly cookie
    res.cookie('accessToken', result.token, ACCESS_COOKIE_OPTIONS);

    // Token is in httpOnly cookie — no token in response body
    res.json({ success: true });
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

    // Clear all auth cookies
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/api/auth',
    });

    // C-1: Clear access token cookie
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    });

    res.clearCookie('csrf', {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
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
    // E-06: Increment tokenVersion to invalidate all existing tokens
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, tokenVersion: { increment: 1 } },
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

    // Clear all auth cookies
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/api/auth',
    });
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    });
    res.clearCookie('csrf', {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
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
