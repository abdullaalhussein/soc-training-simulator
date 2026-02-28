import { Server as SocketIOServer } from 'socket.io';
import { AuthService } from '../services/auth.service';
import { AIService } from '../services/ai.service';
import { logger } from '../utils/logger';
import { filterAiResponse } from '../utils/filterAiResponse';
import { filterAiInput } from '../utils/filterAiInput';
import { sanitizePromptContent } from '../utils/sanitizePrompt';
import { acquireAiSlot, releaseAiSlot } from '../utils/aiSemaphore';
import { env } from '../config/env';
import prisma from '../lib/prisma';

const MAX_MESSAGE_LENGTH = 5000;
const RATE_LIMIT_WINDOW_MS = 10_000; // 10 seconds
const RATE_LIMIT_MAX_EVENTS = 30; // max events per window
const AI_MESSAGES_PER_ATTEMPT = 20; // max AI assistant messages per attempt
const AI_DAILY_LIMIT_PER_USER = parseInt(process.env.AI_DAILY_LIMIT || '30', 10);
const MAX_CONNECTIONS_PER_USER = 3; // H-2: max concurrent sockets per user
const REAUTH_INTERVAL_MS = 5 * 60 * 1000; // H-9: re-verify token every 5 minutes

// D-02: Server-wide socket connection cap
const MAX_TOTAL_CONNECTIONS = env.SOCKET_MAX_CONNECTIONS;
let totalConnectionCount = 0;

/**
 * Check if a user has exceeded their daily AI message limit.
 */
async function checkDailyAiLimit(userId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const used = await prisma.aiAssistantMessage.count({
    where: {
      role: 'user',
      createdAt: { gte: startOfDay },
      attempt: { userId },
    },
  });

  return { allowed: used < AI_DAILY_LIMIT_PER_USER, used, limit: AI_DAILY_LIMIT_PER_USER };
}

/**
 * D-03: Check organization-wide daily AI message limit.
 */
async function checkOrgDailyAiLimit(): Promise<{ allowed: boolean; used: number; limit: number }> {
  if (env.AI_DAILY_ORG_LIMIT === 0) return { allowed: true, used: 0, limit: 0 };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const used = await prisma.aiAssistantMessage.count({
    where: {
      role: 'user',
      createdAt: { gte: startOfDay },
    },
  });

  return { allowed: used < env.AI_DAILY_ORG_LIMIT, used, limit: env.AI_DAILY_ORG_LIMIT };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// D-02: Per-user shared rate limiting (replaces per-socket)
const userRateLimiters = new Map<string, number[]>();

function isUserRateLimited(userId: string): boolean {
  const now = Date.now();
  let timestamps = userRateLimiters.get(userId);
  if (!timestamps) {
    timestamps = [];
    userRateLimiters.set(userId, timestamps);
  }
  // Remove expired timestamps
  while (timestamps.length > 0 && timestamps[0] <= now - RATE_LIMIT_WINDOW_MS) {
    timestamps.shift();
  }
  if (timestamps.length >= RATE_LIMIT_MAX_EVENTS) {
    return true;
  }
  timestamps.push(now);
  return false;
}

// D-02: Periodic cleanup of rate limiter entries for disconnected users
setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamps] of userRateLimiters.entries()) {
    // Remove expired entries
    while (timestamps.length > 0 && timestamps[0] <= now - RATE_LIMIT_WINDOW_MS) {
      timestamps.shift();
    }
    // If no active timestamps and user has no connections, clean up
    if (timestamps.length === 0 && !userConnectionCounts.has(userId)) {
      userRateLimiters.delete(userId);
    }
  }
}, 60_000);

// H-2: Track connections per user across both namespaces
const userConnectionCounts = new Map<string, number>();

function incrementUserConnections(userId: string): boolean {
  const current = userConnectionCounts.get(userId) || 0;
  if (current >= MAX_CONNECTIONS_PER_USER) {
    return false; // Reject connection
  }
  userConnectionCounts.set(userId, current + 1);
  return true;
}

function decrementUserConnections(userId: string): void {
  const current = userConnectionCounts.get(userId) || 0;
  if (current <= 1) {
    userConnectionCounts.delete(userId);
  } else {
    userConnectionCounts.set(userId, current - 1);
  }
}

/** Parse a cookie string into a map */
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(pair => {
    const [key, ...vals] = pair.trim().split('=');
    if (key) cookies[key.trim()] = vals.join('=').trim();
  });
  return cookies;
}

// D-02: Socket connection monitoring — log stats every 60 seconds
setInterval(() => {
  if (totalConnectionCount > 0) {
    let maxPerUser = 0;
    let uniqueUsers = 0;
    for (const [, count] of userConnectionCounts) {
      uniqueUsers++;
      if (count > maxPerUser) maxPerUser = count;
    }
    logger.info('Socket connection stats', {
      totalConnections: totalConnectionCount,
      uniqueUsers,
      maxPerUser,
      serverCap: MAX_TOTAL_CONNECTIONS,
    });
    // Warn if any user is at max
    for (const [userId, count] of userConnectionCounts) {
      if (count >= MAX_CONNECTIONS_PER_USER) {
        logger.warn(`User at max socket connections: ${userId} (${count}/${MAX_CONNECTIONS_PER_USER})`);
      }
    }
  }
}, 60_000);

export function initializeSocket(io: SocketIOServer) {
  const trainerNsp = io.of('/trainer');
  const traineeNsp = io.of('/trainee');

  // Authenticate sockets — C-1: read from cookie first, fall back to auth.token
  const authenticateSocket = async (socket: any, next: any) => {
    try {
      // D-02: Check server-wide connection cap before per-user check
      if (totalConnectionCount >= MAX_TOTAL_CONNECTIONS) {
        return next(new Error('Server connection limit reached. Please try again later.'));
      }

      // C-1: Read access token from httpOnly cookie only — no localStorage fallback
      const cookies = parseCookies(socket.handshake.headers?.cookie);
      const token = cookies['accessToken'];

      if (!token) {
        return next(new Error('Authentication required'));
      }
      const payload = AuthService.verifyToken(token);
      socket.data.user = payload;

      // H-2: Check per-user connection limit
      if (!incrementUserConnections(payload.userId)) {
        return next(new Error('Too many concurrent connections'));
      }

      // D-02: Increment server-wide count after successful auth
      totalConnectionCount++;

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
      // D-02: Decrement counts on role rejection
      decrementUserConnections(socket.data.user?.userId);
      totalConnectionCount--;
      return next(new Error('Access denied: TRAINER or ADMIN role required'));
    }
    next();
  });

  // Role enforcement middleware for /trainee namespace — allow any authenticated user
  traineeNsp.use((socket: any, next: any) => {
    next();
  });

  // H-9: Setup periodic re-authentication for a socket
  function setupReauth(socket: any) {
    const interval = setInterval(async () => {
      try {
        const cookies = parseCookies(socket.handshake.headers?.cookie);
        const token = cookies['accessToken'];
        if (!token) {
          socket.emit('error-message', { message: 'Session expired. Please refresh.' });
          socket.disconnect(true);
          return;
        }
        const payload = AuthService.verifyToken(token);

        // Check tokenVersion and isActive from DB — disconnect if revoked/deactivated
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { isActive: true, tokenVersion: true },
        });
        if (!user || !user.isActive || (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion)) {
          socket.emit('error-message', { message: 'Session invalidated. Please log in again.' });
          socket.disconnect(true);
          return;
        }
      } catch {
        socket.emit('error-message', { message: 'Session expired. Please refresh.' });
        socket.disconnect(true);
      }
    }, REAUTH_INTERVAL_MS);

    socket.on('disconnect', () => clearInterval(interval));
  }

  // Shared handler for send-session-message on both namespaces
  function handleSessionMessage(socket: any) {
    socket.on('send-session-message', async (data: { sessionId: string; content: string }) => {
      const { sessionId, content } = data;

      if (!isNonEmptyString(sessionId)) return;
      if (!isNonEmptyString(content)) return;
      if (content.length > MAX_MESSAGE_LENGTH) {
        socket.emit('error-message', { message: `Message content exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` });
        return;
      }

      try {
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
    // D-02: Per-user shared rate limiting
    socket.use((_event: any, next: any) => {
      if (isUserRateLimited(socket.data.user.userId)) {
        logger.warn(`Rate limited trainer socket: ${socket.id} (${socket.data.user.email})`);
        return next(new Error('Rate limit exceeded'));
      }
      next();
    });
    logger.info(`Trainer connected: ${socket.id} (${socket.data.user.email})`);

    // H-9: Periodic re-authentication
    setupReauth(socket);

    socket.on('join-session', async (sessionId: string) => {
      if (!isNonEmptyString(sessionId)) return;

      try {
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

    socket.on('send-hint', async (data: { attemptId: string; content: string }) => {
      if (!isNonEmptyString(data?.attemptId) || !isNonEmptyString(data?.content)) return;

      const attempt = await prisma.attempt.findUnique({
        where: { id: data.attemptId },
        include: { session: true },
      });
      if (!attempt || (socket.data.user.role !== 'ADMIN' && attempt.session.createdById !== socket.data.user.userId)) return;

      traineeNsp.to(`attempt:${data.attemptId}`).emit('hint-sent', {
        content: data.content,
        fromTrainer: socket.data.user.email,
      });

      // M-2: Audit log hint sent
      try {
        await prisma.auditLog.create({
          data: {
            userId: socket.data.user.userId,
            action: 'SEND_HINT',
            resource: 'attempt',
            resourceId: data.attemptId,
            details: { contentLength: data.content.length },
          },
        });
      } catch { /* non-fatal */ }

      logger.info(`Trainer sent hint to attempt:${data.attemptId}`);
    });

    socket.on('send-session-alert', async (data: { sessionId: string; message: string }) => {
      if (!isNonEmptyString(data?.sessionId) || !isNonEmptyString(data?.message)) return;

      const session = await prisma.session.findUnique({ where: { id: data.sessionId } });
      if (!session || (socket.data.user.role !== 'ADMIN' && session.createdById !== socket.data.user.userId)) return;

      const room = `session:${data.sessionId}`;
      traineeNsp.to(room).emit('session-alert', {
        message: data.message.trim(),
        fromTrainer: socket.data.user.email,
        timestamp: new Date().toISOString(),
      });
      logger.info(`Trainer broadcast alert to session:${data.sessionId}`);
    });

    socket.on('pause-session', async (data: { sessionId: string }) => {
      if (!isNonEmptyString(data?.sessionId)) return;

      const session = await prisma.session.findUnique({ where: { id: data.sessionId } });
      if (!session || (socket.data.user.role !== 'ADMIN' && session.createdById !== socket.data.user.userId)) return;

      traineeNsp.to(`session:${data.sessionId}`).emit('session-paused', { sessionId: data.sessionId });
      logger.info(`Session ${data.sessionId} paused by trainer`);
    });

    socket.on('resume-session', async (data: { sessionId: string }) => {
      if (!isNonEmptyString(data?.sessionId)) return;

      const session = await prisma.session.findUnique({ where: { id: data.sessionId } });
      if (!session || (socket.data.user.role !== 'ADMIN' && session.createdById !== socket.data.user.userId)) return;

      traineeNsp.to(`session:${data.sessionId}`).emit('session-resumed', { sessionId: data.sessionId });
      logger.info(`Session ${data.sessionId} resumed by trainer`);
    });

    handleSessionMessage(socket);

    socket.on('disconnect', () => {
      // H-2: Decrement user connection count
      decrementUserConnections(socket.data.user?.userId);
      // D-02: Decrement server-wide count
      totalConnectionCount--;
      logger.info(`Trainer disconnected: ${socket.id}`);
    });
  });

  // Trainee namespace
  traineeNsp.on('connection', (socket) => {
    // D-02: Per-user shared rate limiting
    socket.use((_event: any, next: any) => {
      if (isUserRateLimited(socket.data.user.userId)) {
        logger.warn(`Rate limited trainee socket: ${socket.id} (${socket.data.user.email})`);
        return next(new Error('Rate limit exceeded'));
      }
      next();
    });
    logger.info(`Trainee connected: ${socket.id} (${socket.data.user.email})`);

    // H-9: Periodic re-authentication
    setupReauth(socket);

    socket.on('join-attempt', async (attemptId: string) => {
      if (!isNonEmptyString(attemptId)) return;

      try {
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
      if (!isNonEmptyString(sessionId)) return;

      try {
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

    // H-3: Add ownership check to progress-update
    socket.on('progress-update', async (data: any) => {
      if (!data?.sessionId || typeof data.sessionId !== 'string') return;

      // H-3: Verify user belongs to this session before forwarding
      try {
        const userId = socket.data.user.userId;
        const membership = await prisma.sessionMember.findUnique({
          where: { sessionId_userId: { sessionId: data.sessionId, userId } },
        });
        const session = await prisma.session.findUnique({
          where: { id: data.sessionId },
          select: { createdById: true },
        });

        if (!membership && session?.createdById !== userId) {
          socket.emit('error-message', { message: 'Access denied: not a member of this session' });
          return;
        }
      } catch {
        return; // Fail silently on DB errors for progress updates
      }

      const sanitized = {
        sessionId: data.sessionId,
        userId: socket.data.user.userId,
        attemptId: typeof data.attemptId === 'string' ? data.attemptId : undefined,
        currentStage: typeof data.currentStage === 'number' ? data.currentStage : undefined,
        currentScore: typeof data.currentScore === 'number' ? data.currentScore : undefined,
        elapsedMinutes: typeof data.elapsedMinutes === 'number' ? data.elapsedMinutes : undefined,
        lastAction: typeof data.lastAction === 'string' ? data.lastAction : undefined,
        details: data.details && typeof data.details === 'object' ? data.details : undefined,
        evidenceCount: typeof data.evidenceCount === 'number' ? data.evidenceCount : undefined,
        checkpointsCompleted: typeof data.checkpointsCompleted === 'number' ? data.checkpointsCompleted : undefined,
        timeElapsed: typeof data.timeElapsed === 'number' ? data.timeElapsed : undefined,
        userName: socket.data.user.email,
      };
      trainerNsp.to(`session:${data.sessionId}`).emit('progress-update', sanitized);
    });

    socket.on('ai-assistant-message', async (data: { attemptId: string; message: string }) => {
      if (!isNonEmptyString(data?.attemptId) || !isNonEmptyString(data?.message)) return;
      if (data.message.length > MAX_MESSAGE_LENGTH) {
        socket.emit('error-message', { message: 'Message too long' });
        return;
      }

      // Early exit if AI is not configured — avoid misleading rate limit errors
      if (!AIService.isAvailable()) {
        socket.emit('ai-assistant-response', {
          content: 'SOC Mentor is not configured on this server. Contact your administrator to enable it by setting an Anthropic API key.',
          remaining: 0,
        });
        return;
      }

      // H-5: AI input filtering — reject jailbreak patterns
      const inputFilterResult = filterAiInput(data.message);
      if (inputFilterResult) {
        // Save the blocked message and response for audit
        try {
          await prisma.aiAssistantMessage.createMany({
            data: [
              { attemptId: data.attemptId, role: 'user', content: data.message },
              { attemptId: data.attemptId, role: 'assistant', content: inputFilterResult },
            ],
          });
        } catch { /* non-fatal */ }

        // M-2: Audit log jailbreak attempt
        try {
          await prisma.auditLog.create({
            data: {
              userId: socket.data.user.userId,
              action: 'AI_JAILBREAK_BLOCKED',
              resource: 'ai_assistant',
              resourceId: data.attemptId,
              details: { messagePreview: data.message.substring(0, 200) },
            },
          });
        } catch { /* non-fatal */ }

        const aiMsgCount = await prisma.aiAssistantMessage.count({
          where: { attemptId: data.attemptId, role: 'user' },
        });

        socket.emit('ai-assistant-response', {
          content: inputFilterResult,
          remaining: Math.max(0, AI_MESSAGES_PER_ATTEMPT - aiMsgCount),
        });
        return;
      }

      try {
        const userId = socket.data.user.userId;

        const attempt = await prisma.attempt.findUnique({
          where: { id: data.attemptId },
          include: {
            session: {
              include: {
                scenario: {
                  include: {
                    stages: { orderBy: { stageNumber: 'asc' } },
                    checkpoints: { select: { correctAnswer: true, explanation: true, options: true } },
                  },
                },
              },
            },
          },
        });

        if (!attempt || attempt.userId !== userId) {
          socket.emit('error-message', { message: 'Access denied' });
          return;
        }

        // Rate limit: count existing AI messages for this attempt
        const aiMessageCount = await prisma.aiAssistantMessage.count({
          where: { attemptId: data.attemptId, role: 'user' },
        });

        if (aiMessageCount >= AI_MESSAGES_PER_ATTEMPT) {
          socket.emit('ai-assistant-response', {
            content: 'You have reached the maximum number of messages for this attempt.',
            remaining: 0,
          });
          return;
        }

        // Daily rate limit per user across all attempts
        const dailyLimit = await checkDailyAiLimit(userId);
        if (!dailyLimit.allowed) {
          socket.emit('ai-assistant-response', {
            content: `You have reached your daily limit of ${dailyLimit.limit} SOC Mentor messages. Your limit resets tomorrow.`,
            remaining: 0,
          });
          return;
        }

        // D-03: Organization-wide daily AI budget cap
        const orgLimit = await checkOrgDailyAiLimit();
        if (!orgLimit.allowed) {
          socket.emit('ai-assistant-response', {
            content: `The organization's daily AI message limit (${orgLimit.limit}) has been reached. Please try again tomorrow.`,
            remaining: 0,
          });
          return;
        }

        // Fetch conversation history
        const history = await prisma.aiAssistantMessage.findMany({
          where: { attemptId: data.attemptId },
          orderBy: { createdAt: 'asc' },
          take: 50,
        });

        const conversationHistory = history.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        // Build context — C-2: Sanitize scenario content before prompt injection
        const scenario = attempt.session.scenario;
        const currentStageData = scenario.stages.find((s) => s.stageNumber === attempt.currentStage);

        // C-2: Sanitize all user-controlled fields injected into system prompt
        const sanitizedBriefing = sanitizePromptContent(scenario.briefing);
        const stageInfo = currentStageData
          ? `Stage ${currentStageData.stageNumber}: ${sanitizePromptContent(currentStageData.title)} — ${sanitizePromptContent(currentStageData.description)}`
          : `Stage ${attempt.currentStage}`;

        // D-01: AI concurrency semaphore — limit parallel API calls
        await acquireAiSlot();
        let aiResponse: string | null;
        try {
          // M-5: Call AI WITHOUT checkpoint answers — they are no longer in the context
          aiResponse = await AIService.getAssistantResponse(
            data.message,
            conversationHistory,
            sanitizedBriefing,
            stageInfo,
            {
              currentStage: attempt.currentStage,
              totalStages: scenario.stages.length,
              score: attempt.totalScore,
              hintsUsed: attempt.hintsUsed,
            },
          );
        } finally {
          releaseAiSlot();
        }

        if (!aiResponse) {
          socket.emit('ai-assistant-response', {
            content: 'SOC Mentor is currently unavailable. Please try again later.',
            remaining: AI_MESSAGES_PER_ATTEMPT - aiMessageCount,
          });
          return;
        }

        // Server-side output filter: check for leaked answer content
        const filteredResponse = filterAiResponse(aiResponse, scenario.checkpoints || []);
        const finalResponse = filteredResponse || aiResponse;

        if (filteredResponse) {
          logger.warn('AI output filter triggered', { attemptId: data.attemptId, userId });

          // M-2: Audit log filter trigger
          try {
            await prisma.auditLog.create({
              data: {
                userId,
                action: 'AI_OUTPUT_FILTERED',
                resource: 'ai_assistant',
                resourceId: data.attemptId,
              },
            });
          } catch { /* non-fatal */ }
        }

        // M-7: Track token usage (estimated from message lengths)
        const estimatedInputTokens = Math.ceil((data.message.length + sanitizedBriefing.length + stageInfo.length) / 4);
        const estimatedOutputTokens = Math.ceil(finalResponse.length / 4);

        // Save both messages
        await prisma.aiAssistantMessage.createMany({
          data: [
            { attemptId: data.attemptId, role: 'user', content: data.message },
            { attemptId: data.attemptId, role: 'assistant', content: finalResponse },
          ],
        });

        // M-7: Log AI usage for cost tracking
        logger.info('AI usage', {
          userId,
          attemptId: data.attemptId,
          estimatedInputTokens,
          estimatedOutputTokens,
          estimatedCost: ((estimatedInputTokens * 0.003 + estimatedOutputTokens * 0.015) / 1000).toFixed(4),
        });

        socket.emit('ai-assistant-response', {
          content: finalResponse,
          remaining: AI_MESSAGES_PER_ATTEMPT - aiMessageCount - 1,
        });
      } catch (err) {
        logger.error('AI assistant error', { error: err });
        socket.emit('error-message', { message: 'AI assistant error' });
      }
    });

    handleSessionMessage(socket);

    socket.on('disconnect', () => {
      // H-2: Decrement user connection count
      decrementUserConnections(socket.data.user?.userId);
      // D-02: Decrement server-wide count
      totalConnectionCount--;
      logger.info(`Trainee disconnected: ${socket.id}`);
    });
  });

  logger.info('Socket.io initialized with /trainer and /trainee namespaces (authenticated)');
}
