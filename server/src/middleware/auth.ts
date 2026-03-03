import { Request, Response, NextFunction } from 'express';
import { AuthService, TokenPayload } from '../services/auth.service';
import { AppError } from './errorHandler';
import prisma from '../lib/prisma';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    // C-1: Read access token from httpOnly cookie only — no localStorage fallback
    const token = req.cookies?.accessToken;

    if (!token) {
      throw new AppError('Authentication required', 401);
    }

    const payload = AuthService.verifyToken(token);

    // E-06: Verify user still exists, is active, and tokenVersion matches
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isActive: true, tokenVersion: true, role: true },
    });

    if (!user) {
      throw new AppError('User no longer exists', 401);
    }

    if (!user.isActive) {
      throw new AppError('Account has been deactivated', 403);
    }

    if (payload.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion) {
      throw new AppError('Session expired — please log in again', 401);
    }

    // Use the DB role (authoritative) rather than the JWT role (may be stale)
    req.user = { ...payload, role: user.role };
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Authentication failed', 401));
    }
  }
};
