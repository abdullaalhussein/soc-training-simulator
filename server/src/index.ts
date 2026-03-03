import dotenv from 'dotenv';
// Load .env file in development; in production (Railway), env vars are injected
dotenv.config({ path: '../.env' });
dotenv.config();

import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env';
import { initializeSocket } from './socket';
import { logger } from './utils/logger';
import { DEFAULT_DEMO_EMAILS, DEFAULT_DEMO_PASSWORD } from './config/constants';
import { app } from './app';

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
