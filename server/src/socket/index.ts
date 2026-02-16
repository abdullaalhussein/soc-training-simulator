import { Server as SocketIOServer } from 'socket.io';
import { AuthService } from '../services/auth.service';
import { logger } from '../utils/logger';

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

    socket.on('pause-session', (sessionId: string) => {
      traineeNsp.emit('session-paused', { sessionId });
      logger.info(`Session ${sessionId} paused by trainer`);
    });

    socket.on('resume-session', (sessionId: string) => {
      traineeNsp.emit('session-resumed', { sessionId });
      logger.info(`Session ${sessionId} resumed by trainer`);
    });

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

    socket.on('progress-update', (data: any) => {
      // Forward progress to all trainers watching this session
      if (data.sessionId) {
        trainerNsp.to(`session:${data.sessionId}`).emit('progress-update', {
          ...data,
          userName: socket.data.user.email,
        });
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Trainee disconnected: ${socket.id}`);
    });
  });

  logger.info('Socket.io initialized with /trainer and /trainee namespaces (authenticated)');
}
