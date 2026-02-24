import dotenv from 'dotenv';
// Load .env file in development; in production (Railway), env vars are injected
dotenv.config({ path: '../.env' });
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env';
import { corsOptions } from './config/cors';
import { errorHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';
import { initializeSocket } from './socket';
import { logger } from './utils/logger';

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

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

    const defaultEmails = ['admin@soc.local', 'trainer@soc.local', 'trainee@soc.local'];
    const users = await prisma.user.findMany({
      where: { email: { in: defaultEmails } },
      select: { email: true, password: true },
    });

    for (const user of users) {
      const isDefault = await bcrypt.compare('Password123!', user.password);
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
