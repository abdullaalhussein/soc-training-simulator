import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { auditLog } from '../middleware/audit';
import { AuthService } from '../services/auth.service';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';
import prisma from '../lib/prisma';

const router = Router();

const passwordSchema = z.string()
  .min(8)
  .regex(/[A-Z]/, 'Must contain uppercase')
  .regex(/[a-z]/, 'Must contain lowercase')
  .regex(/[0-9]/, 'Must contain digit')
  .regex(/[^A-Za-z0-9]/, 'Must contain special character');

const createUserSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'TRAINER', 'TRAINEE']),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'TRAINER', 'TRAINEE']).optional(),
  isActive: z.boolean().optional(),
});

router.use(authenticate);

// Trainers can list users (needed for assigning trainees to sessions)
router.get('/', requireRole('ADMIN', 'TRAINER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, isActive, search } = req.query;
    const where: any = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, role: true, isActive: true, lastLogin: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireRole('ADMIN', 'TRAINER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, isActive: true, lastLogin: true, createdAt: true },
    });
    if (!user) throw new AppError('User not found', 404);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('ADMIN'), auditLog('CREATE', 'USER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createUserSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError('Email already in use', 409);

    const hashedPassword = await AuthService.hashPassword(data.password);
    const user = await prisma.user.create({
      data: { ...data, password: hashedPassword },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof z.ZodError) return next(new AppError('Invalid user data', 400));
    next(error);
  }
});

router.put('/:id', requireRole('ADMIN'), auditLog('UPDATE', 'USER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id as string;
    const data = updateUserSchema.parse(req.body);

    // H-4 + E-06: If role is being changed, revoke refresh tokens and increment tokenVersion
    const updateData: any = { ...data };
    if (data.role) {
      const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (currentUser && currentUser.role !== data.role) {
        // M-8: Prevent downgrading the last admin
        if (currentUser.role === 'ADMIN' && data.role !== 'ADMIN') {
          const adminCount = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
          if (adminCount <= 1) {
            throw new AppError('Cannot change role: this is the last active admin account', 400);
          }
        }
        await prisma.refreshToken.deleteMany({ where: { userId } });
        updateData.tokenVersion = { increment: 1 };
      }
    }

    // H-4 + E-06: If account is being deactivated, revoke refresh tokens and increment tokenVersion
    if (data.isActive === false) {
      // M-8: Prevent deactivating the last admin
      const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (targetUser?.role === 'ADMIN') {
        const adminCount = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
        if (adminCount <= 1) {
          throw new AppError('Cannot deactivate: this is the last active admin account', 400);
        }
      }
      await prisma.refreshToken.deleteMany({ where: { userId } });
      updateData.tokenVersion = { increment: 1 };
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) return next(new AppError('Invalid user data', 400));
    next(error);
  }
});

router.delete('/:id', requireRole('ADMIN'), auditLog('DELETE', 'USER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id as string;
    if (userId === req.user!.userId) {
      throw new AppError('Cannot delete own account', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

    const { force } = req.query;

    if (force === 'true') {
      // Hard delete: remove user and all related data
      const attempts = await prisma.attempt.findMany({ where: { userId }, select: { id: true } });
      const attemptIds = attempts.map(a => a.id);

      if (attemptIds.length > 0) {
        await prisma.aiAssistantMessage.deleteMany({ where: { attemptId: { in: attemptIds } } });
        await prisma.investigationAction.deleteMany({ where: { attemptId: { in: attemptIds } } });
        await prisma.answer.deleteMany({ where: { attemptId: { in: attemptIds } } });
        await prisma.attempt.deleteMany({ where: { userId } });
      }

      // SEC-05: Reassign sessions created by this user to the admin performing the deletion
      await prisma.session.updateMany({ where: { createdById: userId }, data: { createdById: req.user!.userId } });

      await prisma.trainerNote.deleteMany({ where: { trainerId: userId } });
      await prisma.sessionMessage.deleteMany({ where: { userId } });
      await prisma.sessionMember.deleteMany({ where: { userId } });
      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.auditLog.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });

      res.json({ message: 'User permanently deleted' });
    } else {
      // Soft delete: deactivate the user
      await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
      res.json({ message: 'User deactivated' });
    }
  } catch (error) {
    next(error);
  }
});

const resetPasswordSchema = z.object({
  password: passwordSchema,
});

router.post('/:id/reset-password', requireRole('ADMIN'), auditLog('RESET_PASSWORD', 'USER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id as string;
    const { password } = resetPasswordSchema.parse(req.body);
    const hashedPassword = await AuthService.hashPassword(password);
    // E-06: Increment tokenVersion + revoke refresh tokens on admin password reset
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, tokenVersion: { increment: 1 } },
    });
    await prisma.refreshToken.deleteMany({ where: { userId } });
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.errors.map(e => e.message).join(', '), 400));
    }
    next(error);
  }
});

export { router as usersRouter };
