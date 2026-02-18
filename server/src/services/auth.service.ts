import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import prisma from '../lib/prisma';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
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

  static generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      algorithm: 'HS256' as const,
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
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
    };

    const token = this.generateToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    // Store refresh token in DB for revocation support
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
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
    // Verify the token exists in DB (not revoked)
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });
    if (!storedToken) {
      throw new AppError('Invalid refresh token', 401);
    }

    // Verify JWT signature and expiry
    const payload = this.verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) {
      throw new AppError('User not found or deactivated', 401);
    }

    const newPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const newToken = this.generateToken(newPayload);
    const newRefreshToken = this.generateRefreshToken(newPayload);

    // Token rotation: delete old token and store new one
    await prisma.refreshToken.delete({ where: { token: refreshToken } });
    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      token: newToken,
      refreshToken: newRefreshToken,
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
