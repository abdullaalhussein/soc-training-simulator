import { Server as SocketIOServer } from 'socket.io';
import { AuthService } from '../services/auth.service';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';

const MAX_MESSAGE_LENGTH = 5000;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

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

  // Role enforcement middleware for /trainer namespace
  trainerNsp.use((socket: any, next: any) => {
    const role = socket.data.user?.role;
    if (role !== 'TRAINER' && role !== 'ADMIN') {
      return next(new Error('Access denied: TRAINER or ADMIN role required'));
    }
    next();
  });

  // Role enforcement middleware for /trainee namespace — allow any authenticated user
  traineeNsp.use((socket: any, next: any) => {
    // Any authenticated user (TRAINEE, TRAINER, ADMIN) can connect
    next();
  });

  // Shared handler for send-session-message on both namespaces
  function handleSessionMessage(socket: any) {
    socket.on('send-session-message', async (data: { sessionId: string; content: string }) => {
      const { sessionId, content } = data;

      // Input validation
      if (!isNonEmptyString(sessionId)) return;
      if (!isNonEmptyString(content)) return;
      if (content.length > MAX_MESSAGE_LENGTH) {
        socket.emit('error-message', { message: `Message content exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` });
        return;
      }

      try {
        // Authorization: verify user is session creator or session member
        const userId = socket.data.user.userId;
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          select: { createdById: true },
        });

        if (!session) {
          socket.emit('error-message', { message: 'Session not found' });
          return;
        }

        if (session.createdById !== userId) {
          const membership = await prisma.sessionMember.findUnique({
            where: { sessionId_userId: { sessionId, userId } },
          });
          if (!membership) {
            socket.emit('error-message', { message: 'Access denied: not a member of this session' });
            return;
          }
        }

        const message = await prisma.sessionMessage.create({
          data: {
            sessionId,
            userId,
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

    socket.on('join-session', async (sessionId: string) => {
      // Input validation
      if (!isNonEmptyString(sessionId)) return;

      try {
        // Authorization: verify user is the session creator or an ADMIN
        const userId = socket.data.user.userId;
        const role = socket.data.user.role;
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          select: { createdById: true },
        });

        if (!session) {
          socket.emit('error-message', { message: 'Session not found' });
          return;
        }

        if (session.createdById !== userId && role !== 'ADMIN') {
          socket.emit('error-message', { message: 'Access denied: not the session creator' });
          return;
        }

        socket.join(`session:${sessionId}`);
        logger.info(`Trainer ${socket.data.user.email} joined session:${sessionId}`);
      } catch (err) {
        logger.error('Failed to join session (trainer)', { error: err });
      }
    });

    socket.on('send-hint', (data: { attemptId: string; content: string }) => {
      // Input validation
      if (!isNonEmptyString(data?.attemptId) || !isNonEmptyString(data?.content)) return;

      // Forward hint to the specific trainee
      traineeNsp.to(`attempt:${data.attemptId}`).emit('hint-sent', {
        content: data.content,
        fromTrainer: socket.data.user.email,
      });
      logger.info(`Trainer sent hint to attempt:${data.attemptId}`);
    });

    socket.on('send-session-alert', (data: { sessionId: string; message: string }) => {
      // Input validation
      if (!isNonEmptyString(data?.sessionId) || !isNonEmptyString(data?.message)) return;

      const room = `session:${data.sessionId}`;
      traineeNsp.to(room).emit('session-alert', {
        message: data.message.trim(),
        fromTrainer: socket.data.user.email,
        timestamp: new Date().toISOString(),
      });
      logger.info(`Trainer broadcast alert to session:${data.sessionId}`);
    });

    socket.on('pause-session', (sessionId: string) => {
      // Input validation
      if (!isNonEmptyString(sessionId)) return;

      traineeNsp.to(`session:${sessionId}`).emit('session-paused', { sessionId });
      logger.info(`Session ${sessionId} paused by trainer`);
    });

    socket.on('resume-session', (sessionId: string) => {
      // Input validation
      if (!isNonEmptyString(sessionId)) return;

      traineeNsp.to(`session:${sessionId}`).emit('session-resumed', { sessionId });
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

    socket.on('join-attempt', async (attemptId: string) => {
      // Input validation
      if (!isNonEmptyString(attemptId)) return;

      try {
        // Authorization: verify the user owns this attempt
        const userId = socket.data.user.userId;
        const attempt = await prisma.attempt.findUnique({
          where: { id: attemptId },
          select: { userId: true },
        });

        if (!attempt) {
          socket.emit('error-message', { message: 'Attempt not found' });
          return;
        }

        if (attempt.userId !== userId) {
          socket.emit('error-message', { message: 'Access denied: not the owner of this attempt' });
          return;
        }

        socket.join(`attempt:${attemptId}`);
        logger.info(`Trainee ${socket.data.user.email} joined attempt:${attemptId}`);
      } catch (err) {
        logger.error('Failed to join attempt (trainee)', { error: err });
      }
    });

    socket.on('join-session', async (sessionId: string) => {
      // Input validation
      if (!isNonEmptyString(sessionId)) return;

      try {
        // Authorization: verify the user is a session member
        const userId = socket.data.user.userId;
        const membership = await prisma.sessionMember.findUnique({
          where: { sessionId_userId: { sessionId, userId } },
        });

        if (!membership) {
          socket.emit('error-message', { message: 'Access denied: not a member of this session' });
          return;
        }

        socket.join(`session:${sessionId}`);
        logger.info(`Trainee ${socket.data.user.email} joined session:${sessionId}`);
      } catch (err) {
        logger.error('Failed to join session (trainee)', { error: err });
      }
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
