import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { corsOptions } from './config/cors';
import { errorHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';
import { logger } from './utils/logger';
import prisma from './lib/prisma';

const app = express();

// Trust first proxy (Railway/Docker/nginx)
app.set('trust proxy', 1);

// C-4: Global rate limiter — 200 requests/min per IP across all routes
const globalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: { message: 'Too many requests, please try again later' } },
  keyGenerator: (req) => req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      ...(process.env.CSP_REPORT_URI ? { reportUri: [process.env.CSP_REPORT_URI] } : {}),
    },
  },
}));
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(globalRateLimit);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// H-1: CSRF protection
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path === '/api/auth/login' || req.path === '/api/auth/refresh') return next();
  if (!req.cookies?.accessToken) return next();

  const csrfCookie = req.cookies?.csrf;
  const csrfHeader = req.headers['x-csrf-token'];

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ error: { message: 'Invalid CSRF token' } });
  }
  next();
});

// M-8: CSP violation reporting endpoint
app.post('/api/csp-report', express.json({ type: 'application/csp-report' }), (req, _res) => {
  logger.warn('CSP violation', { report: req.body });
  _res.status(204).send();
});

// Health check
app.get('/api/health', async (_req, res) => {
  const mem = process.memoryUsage();
  let dbStatus = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'unreachable';
  }
  res.json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: dbStatus,
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heap: Math.round(mem.heapUsed / 1024 / 1024),
    },
  });
});

// API routes
app.use('/api', apiRouter);

// Error handler
app.use(errorHandler);

export { app };
