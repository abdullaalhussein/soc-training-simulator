import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { auditLog } from '../middleware/audit';
import { AuthService } from '../services/auth.service';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'TRAINER', 'TRAINEE']),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'TRAINER', 'TRAINEE']).optional(),
  isActive: z.boolean().optional(),
});

router.use(authenticate, requireRole('ADMIN'));

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
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

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, name: true, role: true, isActive: true, lastLogin: true, createdAt: true },
    });
    if (!user) throw new AppError('User not found', 404);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.post('/', auditLog('CREATE', 'USER'), async (req: Request, res: Response, next: NextFunction) => {
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

router.put('/:id', auditLog('UPDATE', 'USER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) return next(new AppError('Invalid user data', 400));
    next(error);
  }
});

router.delete('/:id', auditLog('DELETE', 'USER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'User deactivated' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/reset-password', auditLog('RESET_PASSWORD', 'USER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) throw new AppError('Password must be at least 8 characters', 400);
    const hashedPassword = await AuthService.hashPassword(password);
    await prisma.user.update({ where: { id: req.params.id }, data: { password: hashedPassword } });
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
});

export { router as usersRouter };
