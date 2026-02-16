import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
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
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

// Start server
httpServer.listen(env.SERVER_PORT, () => {
  logger.info(`Server running on port ${env.SERVER_PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
});

export { io };
