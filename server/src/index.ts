import dotenv from 'dotenv';
// Load .env file in development; in production (Railway), env vars are injected
dotenv.config({ path: '../.env' });
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env';
import { corsOptions } from './config/cors';
import { errorHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';
import { initializeSocket } from './socket';
import { logger } from './utils/logger';
import prisma from './lib/prisma';
import { DEFAULT_DEMO_EMAILS, DEFAULT_DEMO_PASSWORD } from './config/constants';

const app = express();
const httpServer = createServer(app);

// Socket.io
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowedOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim());
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

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
      // M-9: Removed 'unsafe-inline' from styleSrc; using 'unsafe-hashes' as a safer alternative
      // Note: Fully removing unsafe-inline requires CSS nonces which need Next.js SSR integration.
      // For now, keep 'unsafe-inline' for Tailwind/Radix compatibility but add CSP reporting.
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      // M-5: Prevent clickjacking via frame-ancestors
      frameAncestors: ["'none'"],
      // M-8: CSP violation reporting
      ...(process.env.CSP_REPORT_URI ? { reportUri: [process.env.CSP_REPORT_URI] } : {}),
    },
  },
}));
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(globalRateLimit);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// H-1: CSRF protection — validate X-CSRF-Token header matches csrf cookie on state-changing requests
app.use((req, res, next) => {
  // Only enforce CSRF on state-changing methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // Skip CSRF for login/refresh (no csrf cookie yet)
  if (req.path === '/api/auth/login' || req.path === '/api/auth/refresh') return next();
  // Skip if no access token cookie (not using cookie-based auth)
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

// Initialize Socket.io
initializeSocket(io);

// Check for default demo credentials on startup
async function checkDefaultCredentials() {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const bcrypt = (await import('bcryptjs')).default;

    const users = await prisma.user.findMany({
      where: { email: { in: DEFAULT_DEMO_EMAILS } },
      select: { email: true, password: true },
    });

    for (const user of users) {
      const isDefault = await bcrypt.compare(DEFAULT_DEMO_PASSWORD, user.password);
      if (isDefault) {
        logger.warn('='.repeat(70));
        logger.warn('  SECURITY WARNING: Default demo credentials detected!');
        logger.warn(`  Account "${user.email}" is using the default password.`);
        logger.warn('  Change all default passwords before exposing to production.');
        logger.warn('='.repeat(70));
      }
    }

    await prisma.$disconnect();
  } catch {
    // Non-blocking: don't prevent startup if check fails
  }
}

// Start server — bind 0.0.0.0 for Railway/Docker compatibility
httpServer.listen(env.SERVER_PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${env.SERVER_PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
  checkDefaultCredentials();
});

export { io };
