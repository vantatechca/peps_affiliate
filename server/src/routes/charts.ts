import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/charts/affiliate/weekly - last 7 days
router.get('/affiliate/weekly', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const codes = await prisma.discountCode.findMany({
      where: { affiliateId: userId },
      select: { id: true },
    });
    const codeIds = codes.map((c) => c.id);

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const stats = await prisma.order.aggregate({
        where: {
          discountCodeId: { in: codeIds },
          attributed: true,
          createdAt: { gte: date, lt: nextDate },
        },
        _sum: { orderTotal: true, commissionEarned: true },
        _count: true,
      });

      days.push({
        label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        date: date.toISOString().split('T')[0],
        orders: stats._count,
        revenue: stats._sum.orderTotal || 0,
        earnings: stats._sum.commissionEarned || 0,
      });
    }

    res.json(days);
  } catch (error) {
    console.error('Weekly chart error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/charts/affiliate/monthly - last 6 months
router.get('/affiliate/monthly', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const codes = await prisma.discountCode.findMany({
      where: { affiliateId: userId },
      select: { id: true },
    });
    const codeIds = codes.map((c) => c.id);

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i, 1);
      date.setHours(0, 0, 0, 0);
      const nextMonth = new Date(date);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const stats = await prisma.order.aggregate({
        where: {
          discountCodeId: { in: codeIds },
          attributed: true,
          createdAt: { gte: date, lt: nextMonth },
        },
        _sum: { orderTotal: true, commissionEarned: true },
        _count: true,
      });

      months.push({
        label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        date: date.toISOString().split('T')[0],
        orders: stats._count,
        revenue: stats._sum.orderTotal || 0,
        earnings: stats._sum.commissionEarned || 0,
      });
    }

    res.json(months);
  } catch (error) {
    console.error('Monthly chart error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/charts/admin/weekly - all affiliate sales last 7 days
router.get('/admin/weekly', async (req: Request, res: Response) => {
  try {
    const { affiliateId } = req.query;
    let codeIds: string[] | undefined;

    if (affiliateId) {
      const codes = await prisma.discountCode.findMany({
        where: { affiliateId: affiliateId as string },
        select: { id: true },
      });
      codeIds = codes.map((c) => c.id);
    }

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const where: any = {
        attributed: true,
        createdAt: { gte: date, lt: nextDate },
      };
      if (codeIds) where.discountCodeId = { in: codeIds };

      const stats = await prisma.order.aggregate({
        where,
        _sum: { orderTotal: true, commissionEarned: true },
        _count: true,
      });

      days.push({
        label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        date: date.toISOString().split('T')[0],
        orders: stats._count,
        revenue: stats._sum.orderTotal || 0,
        commissions: stats._sum.commissionEarned || 0,
      });
    }

    res.json(days);
  } catch (error) {
    console.error('Admin weekly chart error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/charts/admin/monthly - all affiliate sales last 6 months
router.get('/admin/monthly', async (req: Request, res: Response) => {
  try {
    const { affiliateId } = req.query;
    let codeIds: string[] | undefined;

    if (affiliateId) {
      const codes = await prisma.discountCode.findMany({
        where: { affiliateId: affiliateId as string },
        select: { id: true },
      });
      codeIds = codes.map((c) => c.id);
    }

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i, 1);
      date.setHours(0, 0, 0, 0);
      const nextMonth = new Date(date);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const where: any = {
        attributed: true,
        createdAt: { gte: date, lt: nextMonth },
      };
      if (codeIds) where.discountCodeId = { in: codeIds };

      const stats = await prisma.order.aggregate({
        where,
        _sum: { orderTotal: true, commissionEarned: true },
        _count: true,
      });

      months.push({
        label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        date: date.toISOString().split('T')[0],
        orders: stats._count,
        revenue: stats._sum.orderTotal || 0,
        commissions: stats._sum.commissionEarned || 0,
      });
    }

    res.json(months);
  } catch (error) {
    console.error('Admin monthly chart error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/charts/admin/top-affiliates - top performers
router.get('/admin/top-affiliates', async (req: Request, res: Response) => {
  try {
    const affiliates = await prisma.user.findMany({
      where: { role: 'AFFILIATE', active: true },
      include: {
        discountCodes: {
          include: {
            orders: {
              where: { attributed: true },
              select: { orderTotal: true, commissionEarned: true },
            },
          },
        },
      },
    });

    const ranked = affiliates
      .map((a) => {
        const allOrders = a.discountCodes.flatMap((c) => c.orders);
        return {
          name: a.name,
          orders: allOrders.length,
          revenue: allOrders.reduce((sum, o) => sum + o.orderTotal, 0),
          commissions: allOrders.reduce((sum, o) => sum + o.commissionEarned, 0),
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    res.json(ranked);
  } catch (error) {
    console.error('Top affiliates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/charts/admin/business/weekly - ALL orders (not just attributed) last 7 days
router.get('/admin/business/weekly', async (req: Request, res: Response) => {
  try {
    const { source } = req.query;
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const baseWhere: any = { createdAt: { gte: date, lt: nextDate } };
      if (source) baseWhere.source = source as string;

      const [all, attributed] = await Promise.all([
        prisma.order.aggregate({ where: baseWhere, _sum: { orderTotal: true }, _count: true }),
        prisma.order.aggregate({ where: { ...baseWhere, attributed: true }, _sum: { orderTotal: true, commissionEarned: true }, _count: true }),
      ]);

      days.push({
        label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        date: date.toISOString().split('T')[0],
        totalOrders: all._count,
        totalRevenue: all._sum.orderTotal || 0,
        attributedOrders: attributed._count,
        attributedRevenue: attributed._sum.orderTotal || 0,
        nonAttributedOrders: all._count - attributed._count,
        nonAttributedRevenue: (all._sum.orderTotal || 0) - (attributed._sum.orderTotal || 0),
        commissions: attributed._sum.commissionEarned || 0,
      });
    }
    res.json(days);
  } catch (error) {
    console.error('Business weekly chart error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/charts/admin/business/monthly - ALL orders last 6 months
router.get('/admin/business/monthly', async (req: Request, res: Response) => {
  try {
    const { source } = req.query;
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i, 1);
      date.setHours(0, 0, 0, 0);
      const nextMonth = new Date(date);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const baseWhere: any = { createdAt: { gte: date, lt: nextMonth } };
      if (source) baseWhere.source = source as string;

      const [all, attributed] = await Promise.all([
        prisma.order.aggregate({ where: baseWhere, _sum: { orderTotal: true }, _count: true }),
        prisma.order.aggregate({ where: { ...baseWhere, attributed: true }, _sum: { orderTotal: true, commissionEarned: true }, _count: true }),
      ]);

      months.push({
        label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        date: date.toISOString().split('T')[0],
        totalOrders: all._count,
        totalRevenue: all._sum.orderTotal || 0,
        attributedOrders: attributed._count,
        attributedRevenue: attributed._sum.orderTotal || 0,
        nonAttributedOrders: all._count - attributed._count,
        nonAttributedRevenue: (all._sum.orderTotal || 0) - (attributed._sum.orderTotal || 0),
        commissions: attributed._sum.commissionEarned || 0,
      });
    }
    res.json(months);
  } catch (error) {
    console.error('Business monthly chart error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/charts/admin/business/stats - comprehensive business stats
router.get('/admin/business/stats', async (req: Request, res: Response) => {
  try {
    const { source } = req.query;
    const sourceWhere: any = source ? { source: source as string } : {};

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalOrders, totalRevenue,
      attributedOrders, attributedRevenue, totalCommissions,
      nonAttributedOrders,
      todayOrders, todayRevenue,
      monthOrders, monthRevenue,
      totalAffiliates, activeAffiliates,
      pendingPayouts,
      activeCodes,
    ] = await Promise.all([
      prisma.order.count({ where: sourceWhere }),
      prisma.order.aggregate({ where: sourceWhere, _sum: { orderTotal: true } }),
      prisma.order.count({ where: { attributed: true, ...sourceWhere } }),
      prisma.order.aggregate({ where: { attributed: true, ...sourceWhere }, _sum: { orderTotal: true } }),
      prisma.order.aggregate({ where: { attributed: true, ...sourceWhere }, _sum: { commissionEarned: true } }),
      prisma.order.count({ where: { attributed: false, ...sourceWhere } }),
      prisma.order.count({ where: { createdAt: { gte: todayStart }, ...sourceWhere } }),
      prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, ...sourceWhere }, _sum: { orderTotal: true } }),
      prisma.order.count({ where: { createdAt: { gte: monthStart }, ...sourceWhere } }),
      prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, ...sourceWhere }, _sum: { orderTotal: true } }),
      prisma.user.count({ where: { role: 'AFFILIATE' } }),
      prisma.user.count({ where: { role: 'AFFILIATE', active: true } }),
      prisma.payout.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true } }),
      prisma.discountCode.count({ where: { active: true } }),
    ]);

    res.json({
      totalOrders,
      totalRevenue: totalRevenue._sum.orderTotal || 0,
      attributedOrders,
      attributedRevenue: attributedRevenue._sum.orderTotal || 0,
      nonAttributedOrders,
      nonAttributedRevenue: (totalRevenue._sum.orderTotal || 0) - (attributedRevenue._sum.orderTotal || 0),
      totalCommissions: totalCommissions._sum.commissionEarned || 0,
      netRevenue: (totalRevenue._sum.orderTotal || 0) - (totalCommissions._sum.commissionEarned || 0),
      todayOrders,
      todayRevenue: todayRevenue._sum.orderTotal || 0,
      monthOrders,
      monthRevenue: monthRevenue._sum.orderTotal || 0,
      totalAffiliates,
      activeAffiliates,
      pendingPayouts: pendingPayouts._sum.amount || 0,
      activeCodes,
      conversionRate: totalOrders > 0 ? ((attributedOrders / totalOrders) * 100) : 0,
    });
  } catch (error) {
    console.error('Business stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
