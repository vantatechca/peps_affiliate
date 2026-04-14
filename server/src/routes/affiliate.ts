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

    // Period boundaries
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Earnings are the sum of this affiliate's OrderCommission ledger rows
    // (accounts for commission splits). Revenue and order counts still come
    // from Order rows where this affiliate is credited (via OrderCommission).
    const [totalEarnings, monthlyEarnings, dailyEarnings] = await Promise.all([
      prisma.orderCommission.aggregate({
        where: { recipientUserId: userId },
        _sum: { amount: true },
      }),
      prisma.orderCommission.aggregate({
        where: { recipientUserId: userId, createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      prisma.orderCommission.aggregate({
        where: { recipientUserId: userId, createdAt: { gte: startOfDay } },
        _sum: { amount: true },
      }),
    ]);

    // Order counts + revenue: count distinct orders where this affiliate got
    // any commission credit. Revenue is the order total on those orders.
    const [totalOrders, monthlyOrders, dailyOrders] = await Promise.all([
      prisma.order.findMany({
        where: { commissions: { some: { recipientUserId: userId } } },
        select: { orderTotal: true },
      }),
      prisma.order.findMany({
        where: {
          commissions: { some: { recipientUserId: userId } },
          createdAt: { gte: startOfMonth },
        },
        select: { orderTotal: true },
      }),
      prisma.order.findMany({
        where: {
          commissions: { some: { recipientUserId: userId } },
          createdAt: { gte: startOfDay },
        },
        select: { orderTotal: true },
      }),
    ]);

    const sumRevenue = (rows: { orderTotal: number }[]) =>
      rows.reduce((acc, r) => acc + r.orderTotal, 0);

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
          orders: totalOrders.length,
          revenue: sumRevenue(totalOrders),
          earnings: totalEarnings._sum.amount || 0,
        },
        monthly: {
          orders: monthlyOrders.length,
          revenue: sumRevenue(monthlyOrders),
          earnings: monthlyEarnings._sum.amount || 0,
        },
        daily: {
          orders: dailyOrders.length,
          revenue: sumRevenue(dailyOrders),
          earnings: dailyEarnings._sum.amount || 0,
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

    // Show every order where this user received any commission credit, not
    // just orders using codes they own (splits mean they can earn from others'
    // codes too).
    const where: any = {
      commissions: { some: { recipientUserId: userId } },
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
          commissions: { where: { recipientUserId: userId }, select: { amount: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.order.count({ where }),
    ]);

    // `commissionEarned` here = this affiliate's share of that order (not the
    // total pool). That way the dashboard numbers match what they actually got.
    const safeOrders = orders.map((o) => ({
      id: o.id,
      customerFirstName: o.customerFirstName,
      itemsSummary: o.itemsSummary,
      orderTotal: o.orderTotal,
      commissionEarned: o.commissions.reduce((acc, c) => acc + c.amount, 0),
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
