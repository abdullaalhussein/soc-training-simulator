import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';
import prisma from '../lib/prisma';

const router = Router();

router.use(authenticate);

// H-8: Zod validation for messages
const messageSchema = z.object({
  content: z.string().min(1, 'Message content is required').max(5000, 'Message too long'),
});

// Check that the user is a session member (trainee) or the session creator (trainer)
async function assertSessionAccess(sessionId: string, userId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { createdById: true, members: { where: { userId }, select: { id: true } } },
  });
  if (!session) throw new AppError('Session not found', 404);
  if (session.createdById !== userId && session.members.length === 0) {
    throw new AppError('Not a member of this session', 403);
  }
}

// GET /sessions/:sessionId/messages
router.get('/:sessionId/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.sessionId as string;
    await assertSessionAccess(sessionId, req.user!.userId);

    const cursor = req.query.cursor as string | undefined;
    const take = 50;

    const messages = await prisma.sessionMessage.findMany({
      where: { sessionId },
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
      ...(cursor
        ? { cursor: { id: cursor }, skip: 1, take: -take }
        : { take: -take }),
    });

    res.json(messages);
  } catch (error) {
    next(error);
  }
});

// POST /sessions/:sessionId/messages
router.post('/:sessionId/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.sessionId as string;
    const { content } = messageSchema.parse(req.body);

    await assertSessionAccess(sessionId, req.user!.userId);

    const message = await prisma.sessionMessage.create({
      data: {
        sessionId,
        userId: req.user!.userId,
        content: content.trim(),
      },
      include: { user: { select: { id: true, name: true, role: true } } },
    });

    res.status(201).json(message);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors[0].message, 400));
    }
    next(error);
  }
});

export { router as messagesRouter };
