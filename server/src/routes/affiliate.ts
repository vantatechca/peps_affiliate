import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/affiliate/dashboard
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get affiliate's discount codes
    const codes = await prisma.discountCode.findMany({
      where: { affiliateId: userId },
      include: {
        _count: { select: { orders: { where: { attributed: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const codeIds = codes.map((c) => c.id);

    // Total stats
    const totalStats = await prisma.order.aggregate({
      where: { discountCodeId: { in: codeIds }, attributed: true },
      _sum: { orderTotal: true, commissionEarned: true },
      _count: true,
    });

    // This month stats
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyStats = await prisma.order.aggregate({
      where: {
        discountCodeId: { in: codeIds },
        attributed: true,
        createdAt: { gte: startOfMonth },
      },
      _sum: { orderTotal: true, commissionEarned: true },
      _count: true,
    });

    // Today stats
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const dailyStats = await prisma.order.aggregate({
      where: {
        discountCodeId: { in: codeIds },
        attributed: true,
        createdAt: { gte: startOfDay },
      },
      _sum: { orderTotal: true, commissionEarned: true },
      _count: true,
    });

    // Pending payouts
    const pendingPayouts = await prisma.payout.aggregate({
      where: { affiliateId: userId, status: 'PENDING' },
      _sum: { amount: true },
    });

    const paidPayouts = await prisma.payout.aggregate({
      where: { affiliateId: userId, status: 'PAID' },
      _sum: { amount: true },
    });

    res.json({
      codes: codes.map((c) => ({
        id: c.id,
        code: c.code,
        label: c.label,
        discountPercent: c.discountPercent,
        active: c.active,
        expiresAt: c.expiresAt,
        timesUsed: c._count.orders,
      })),
      stats: {
        total: {
          orders: totalStats._count,
          revenue: totalStats._sum.orderTotal || 0,
          earnings: totalStats._sum.commissionEarned || 0,
        },
        monthly: {
          orders: monthlyStats._count,
          revenue: monthlyStats._sum.orderTotal || 0,
          earnings: monthlyStats._sum.commissionEarned || 0,
        },
        daily: {
          orders: dailyStats._count,
          revenue: dailyStats._sum.orderTotal || 0,
          earnings: dailyStats._sum.commissionEarned || 0,
        },
      },
      payouts: {
        pending: pendingPayouts._sum.amount || 0,
        paid: paidPayouts._sum.amount || 0,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/affiliate/orders
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { page = '1', limit = '50', period, startDate, endDate } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const codes = await prisma.discountCode.findMany({
      where: { affiliateId: userId },
      select: { id: true },
    });
    const codeIds = codes.map((c) => c.id);

    const where: any = {
      discountCodeId: { in: codeIds },
      attributed: true,
    };

    // Filter by custom date range (takes priority over period)
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    } else if (period === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      where.createdAt = { gte: start };
    } else if (period === 'month') {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      where.createdAt = { gte: start };
    } else if (period === 'week') {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      where.createdAt = { gte: start };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          discountCode: { select: { code: true, label: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.order.count({ where }),
    ]);

    // Map to only show what affiliate should see
    const safeOrders = orders.map((o) => ({
      id: o.id,
      customerFirstName: o.customerFirstName,
      itemsSummary: o.itemsSummary,
      orderTotal: o.orderTotal,
      commissionEarned: o.commissionEarned,
      discountCode: o.discountCode?.code,
      codeLabel: o.discountCode?.label,
      source: o.source,
      date: o.createdAt,
    }));

    res.json({ orders: safeOrders, total, page: parseInt(page as string) });
  } catch (error) {
    console.error('Affiliate orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/affiliate/payouts
router.get('/payouts', async (req: Request, res: Response) => {
  try {
    const payouts = await prisma.payout.findMany({
      where: { affiliateId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payouts);
  } catch (error) {
    console.error('Affiliate payouts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
