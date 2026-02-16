import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auditLog = (action: string, resource: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      const resourceId = req.params.id || req.params.attemptId || req.params.sessionId;

      await prisma.auditLog.create({
        data: {
          userId,
          action,
          resource,
          resourceId,
          details: { method: req.method, path: req.path, body: req.method !== 'GET' ? req.body : undefined },
          ipAddress: req.ip || req.socket.remoteAddress,
        },
      });
    } catch {
      // Don't fail the request if audit logging fails
    }
    next();
  };
};
