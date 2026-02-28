import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// M-3: Sanitize Prisma errors — never leak model/field names to clients
function isPrismaError(err: any): boolean {
  return err?.constructor?.name?.startsWith('Prisma') || err?.code?.startsWith?.('P');
}

function sanitizePrismaError(err: any): { statusCode: number; message: string } {
  const code = err?.code;
  switch (code) {
    case 'P2002': return { statusCode: 409, message: 'A record with this value already exists' };
    case 'P2025': return { statusCode: 404, message: 'Record not found' };
    case 'P2003': return { statusCode: 400, message: 'Invalid reference — related record not found' };
    case 'P2014': return { statusCode: 400, message: 'Invalid data — constraint violation' };
    default: return { statusCode: 500, message: 'Database operation failed' };
  }
}

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // M-3: Handle Prisma errors with sanitized messages
  if (isPrismaError(err)) {
    const { statusCode, message } = sanitizePrismaError(err);
    logger.error(`${statusCode} - Prisma error [${(err as any).code}]: ${err.message}`, {
      stack: err.stack,
      path: _req.path,
      method: _req.method,
    });
    return res.status(statusCode).json({ error: { message } });
  }

  // Handle JSON parse errors from body-parser (malformed request body)
  if (err instanceof SyntaxError && 'body' in err) {
    logger.warn(`400 - Malformed JSON in request body`, { path: _req.path, method: _req.method });
    return res.status(400).json({ error: { message: 'Invalid JSON in request body' } });
  }

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof AppError ? err.message : 'Internal Server Error';

  logger.error(`${statusCode} - ${err.message}`, {
    stack: err.stack,
    path: _req.path,
    method: _req.method,
  });

  res.status(statusCode).json({
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};
