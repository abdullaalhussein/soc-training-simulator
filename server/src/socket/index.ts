import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../services/auth.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export function initializeSocket(io: SocketIOServer) {
  const trainerNsp = io.of('/trainer');
  const traineeNsp = io.of('/trainee');

  // Authenticate sockets
  const authenticateSocket = async (socket: any, next: any) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const payload = AuthService.verifyToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  };

  trainerNsp.use(authenticateSocket);
  traineeNsp.use(authenticateSocket);

  // Shared handler for send-session-message on both namespaces
  function handleSessionMessage(socket: any) {
    socket.on('send-session-message', async (data: { sessionId: string; content: string }) => {
      const { sessionId, content } = data;
      if (!content || !content.trim()) return;

      try {
        const message = await prisma.sessionMessage.create({
          data: {
            sessionId,
            userId: socket.data.user.userId,
            content: content.trim(),
          },
          include: { user: { select: { id: true, name: true, role: true } } },
        });

        const room = `session:${sessionId}`;
        const payload = {
          id: message.id,
          sessionId: message.sessionId,
          content: message.content,
          createdAt: message.createdAt,
          user: message.user,
        };

        trainerNsp.to(room).emit('session-message', payload);
        traineeNsp.to(room).emit('session-message', payload);
      } catch (err) {
        logger.error('Failed to save session message', { error: err });
      }
    });
  }

  // Trainer namespace
  trainerNsp.on('connection', (socket) => {
    logger.info(`Trainer connected: ${socket.id} (${socket.data.user.email})`);

    socket.on('join-session', (sessionId: string) => {
      socket.join(`session:${sessionId}`);
      logger.info(`Trainer ${socket.data.user.email} joined session:${sessionId}`);
    });

    socket.on('send-hint', (data: { attemptId: string; content: string }) => {
      // Forward hint to the specific trainee
      traineeNsp.to(`attempt:${data.attemptId}`).emit('hint-sent', {
        content: data.content,
        fromTrainer: socket.data.user.email,
      });
      logger.info(`Trainer sent hint to attempt:${data.attemptId}`);
    });

    socket.on('send-session-alert', (data: { sessionId: string; message: string }) => {
      if (!data.message?.trim()) return;
      const room = `session:${data.sessionId}`;
      traineeNsp.to(room).emit('session-alert', {
        message: data.message.trim(),
        fromTrainer: socket.data.user.email,
        timestamp: new Date().toISOString(),
      });
      logger.info(`Trainer broadcast alert to session:${data.sessionId}`);
    });

    socket.on('pause-session', (sessionId: string) => {
      traineeNsp.emit('session-paused', { sessionId });
      logger.info(`Session ${sessionId} paused by trainer`);
    });

    socket.on('resume-session', (sessionId: string) => {
      traineeNsp.emit('session-resumed', { sessionId });
      logger.info(`Session ${sessionId} resumed by trainer`);
    });

    handleSessionMessage(socket);

    socket.on('disconnect', () => {
      logger.info(`Trainer disconnected: ${socket.id}`);
    });
  });

  // Trainee namespace
  traineeNsp.on('connection', (socket) => {
    logger.info(`Trainee connected: ${socket.id} (${socket.data.user.email})`);

    socket.on('join-attempt', (attemptId: string) => {
      socket.join(`attempt:${attemptId}`);
      logger.info(`Trainee ${socket.data.user.email} joined attempt:${attemptId}`);
    });

    socket.on('join-session', (sessionId: string) => {
      socket.join(`session:${sessionId}`);
      logger.info(`Trainee ${socket.data.user.email} joined session:${sessionId}`);
    });

    socket.on('progress-update', (data: any) => {
      // Forward progress to all trainers watching this session
      if (data.sessionId) {
        trainerNsp.to(`session:${data.sessionId}`).emit('progress-update', {
          ...data,
          userName: socket.data.user.email,
        });
      }
    });

    handleSessionMessage(socket);

    socket.on('disconnect', () => {
      logger.info(`Trainee disconnected: ${socket.id}`);
    });
  });

  logger.info('Socket.io initialized with /trainer and /trainee namespaces (authenticated)');
}
