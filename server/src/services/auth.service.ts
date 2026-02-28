import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import prisma from '../lib/prisma';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  tokenVersion?: number;
}

// E-06: Role-based refresh token expiry — shorter for privileged roles
function getRefreshExpiresIn(role: string): string {
  if (role === 'ADMIN' || role === 'TRAINER') return '24h';
  return '7d';
}

function getRefreshMaxAgeMs(role: string): number {
  if (role === 'ADMIN' || role === 'TRAINER') return 24 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      algorithm: 'HS256' as const,
      expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  static generateRefreshToken(payload: TokenPayload, expiresIn?: string): string {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      algorithm: 'HS256' as const,
      expiresIn: expiresIn || env.JWT_REFRESH_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  static verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
    } catch {
      throw new AppError('Invalid or expired token', 401);
    }
  }

  static verifyRefreshToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
    } catch {
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  // E-06: Expose role-based refresh helpers for use in auth routes
  static getRefreshExpiresIn = getRefreshExpiresIn;
  static getRefreshMaxAgeMs = getRefreshMaxAgeMs;

  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.isActive) {
      throw new AppError('Account is deactivated', 403);
    }

    const isValid = await this.comparePassword(password, user.password);
    if (!isValid) {
      throw new AppError('Invalid email or password', 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    const token = this.generateToken(payload);
    const refreshExpiresIn = getRefreshExpiresIn(user.role);
    const refreshToken = this.generateRefreshToken(payload, refreshExpiresIn);

    // Store refresh token in DB for revocation support
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + getRefreshMaxAgeMs(user.role)),
      },
    });

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  static async refresh(refreshToken: string) {
    // Atomic delete: prevents race condition where two concurrent requests
    // both pass a findUnique check and generate duplicate tokens
    const deleted = await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
    if (deleted.count === 0) {
      throw new AppError('Invalid refresh token', 401);
    }

    // Verify JWT signature and expiry
    const payload = this.verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) {
      throw new AppError('User not found or deactivated', 401);
    }

    // E-06: Validate tokenVersion — if role/password changed, invalidate old tokens
    if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
      throw new AppError('Session invalidated due to security change. Please log in again.', 401);
    }

    const newPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    const newToken = this.generateToken(newPayload);
    const refreshExpiresIn = getRefreshExpiresIn(user.role);
    const newRefreshToken = this.generateRefreshToken(newPayload, refreshExpiresIn);

    // Store new rotated token
    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + getRefreshMaxAgeMs(user.role)),
      },
    });

    return {
      token: newToken,
      refreshToken: newRefreshToken,
      role: user.role,
    };
  }

  static async logout(refreshToken: string) {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  static async logoutAll(userId: string) {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, isActive: true, lastLogin: true, createdAt: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }
}
