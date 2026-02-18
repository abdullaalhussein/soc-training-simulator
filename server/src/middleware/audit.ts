import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

const SENSITIVE_FIELDS = ['password', 'token', 'refreshToken', 'secret', 'authorization'];

function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  if (Array.isArray(body)) return body.map(item => sanitizeBody(item));
  const sanitized = { ...body };
  for (const key of Object.keys(sanitized)) {
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeBody(sanitized[key]);
    }
  }
  return sanitized;
}

export const auditLog = (action: string, resource: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      const resourceId = (req.params.id || req.params.attemptId || req.params.sessionId) as string | undefined;

      await prisma.auditLog.create({
        data: {
          userId,
          action,
          resource,
          resourceId,
          details: { method: req.method, path: req.path, body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined },
          ipAddress: req.ip || req.socket.remoteAddress,
        },
      });
    } catch (error) {
      // Don't fail the request if audit logging fails
      logger.warn('Audit log write failed', { error });
    }
    next();
  };
};
