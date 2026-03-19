import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireSuperAdmin } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireSuperAdmin);

// GET /api/logs/audit
router.get('/audit', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', action, userId, entity, search } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (action) where.action = action as string;
    if (userId) where.userId = userId as string;
    if (entity) where.entity = entity as string;
    if (search) {
      const s = search as string;
      where.OR = [
        { action: { contains: s, mode: 'insensitive' } },
        { userEmail: { contains: s, mode: 'insensitive' } },
        { userName: { contains: s, mode: 'insensitive' } },
        { details: { contains: s, mode: 'insensitive' } },
        { entityId: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page as string), limit: take });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/logs/audit/stats - summary counts for dashboard
router.get('/audit/stats', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalToday, totalWeek, loginsToday, errorsToday] = await Promise.all([
      prisma.auditLog.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.auditLog.count({ where: { action: 'LOGIN', createdAt: { gte: todayStart } } }),
      prisma.systemLog.count({ where: { level: 'ERROR', createdAt: { gte: todayStart } } }),
    ]);

    res.json({ totalToday, totalWeek, loginsToday, errorsToday });
  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/logs/system
router.get('/system', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', level, source, search } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (level) where.level = level as string;
    if (source) where.source = source as string;
    if (search) {
      const s = search as string;
      where.OR = [
        { message: { contains: s, mode: 'insensitive' } },
        { details: { contains: s, mode: 'insensitive' } },
        { source: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.systemLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page as string), limit: take });
  } catch (error) {
    console.error('Get system logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/logs/audit/actions - distinct action types for filtering
router.get('/audit/actions', async (_req: Request, res: Response) => {
  try {
    const actions = await prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    });
    res.json(actions.map(a => a.action));
  } catch (error) {
    console.error('Get audit actions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
