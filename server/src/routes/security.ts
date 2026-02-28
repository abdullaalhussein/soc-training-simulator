import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { DEFAULT_DEMO_EMAILS, DEFAULT_DEMO_PASSWORD } from '../config/constants';
import prisma from '../lib/prisma';

const router = Router();

router.use(authenticate);

// S-06: Check if any demo accounts still use default credentials
router.get('/default-credentials', requireRole('ADMIN'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const accounts: string[] = [];

    for (const email of DEFAULT_DEMO_EMAILS) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { password: true },
      });
      if (user) {
        const isDefault = await bcrypt.compare(DEFAULT_DEMO_PASSWORD, user.password);
        if (isDefault) accounts.push(email);
      }
    }

    res.json({
      hasDefaultCredentials: accounts.length > 0,
      accounts,
    });
  } catch (error) {
    next(error);
  }
});

export { router as securityRouter };
