import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireAdmin);

// ============ AFFILIATES ============

// GET /api/admin/affiliates
router.get('/affiliates', async (_req: Request, res: Response) => {
  try {
    const affiliates = await prisma.user.findMany({
      where: { role: 'AFFILIATE' },
      include: {
        discountCodes: {
          include: {
            _count: { select: { orders: { where: { attributed: true } } } },
          },
        },
        _count: { select: { payouts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(affiliates);
  } catch (error) {
    console.error('Get affiliates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/affiliates
router.post('/affiliates', async (req: Request, res: Response) => {
  try {
    const { email, name, password, defaultCommissionRate } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'email, name, and password are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const affiliate = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        passwordPlain: password,
        role: 'AFFILIATE',
        defaultCommissionRate: defaultCommissionRate ?? 0.20,
      },
    });

    res.status(201).json({
      id: affiliate.id,
      email: affiliate.email,
      name: affiliate.name,
      defaultCommissionRate: affiliate.defaultCommissionRate,
      passwordPlain: affiliate.passwordPlain,
    });
  } catch (error) {
    console.error('Create affiliate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/affiliates/:id
router.patch('/affiliates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, defaultCommissionRate, active, password } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email.toLowerCase();
    if (defaultCommissionRate !== undefined) data.defaultCommissionRate = defaultCommissionRate;
    if (active !== undefined) data.active = active;
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 10);
      data.passwordPlain = password;
    }

    const affiliate = await prisma.user.update({ where: { id }, data });

    res.json({
      id: affiliate.id,
      email: affiliate.email,
      name: affiliate.name,
      defaultCommissionRate: affiliate.defaultCommissionRate,
      active: affiliate.active,
      passwordPlain: affiliate.passwordPlain,
    });
  } catch (error) {
    console.error('Update affiliate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/affiliates/:id
router.delete('/affiliates/:id', async (req: Request, res: Response) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete affiliate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ DISCOUNT CODES ============

// GET /api/admin/codes
router.get('/codes', async (_req: Request, res: Response) => {
  try {
    const codes = await prisma.discountCode.findMany({
      include: {
        affiliate: { select: { id: true, name: true, email: true } },
        _count: { select: { orders: { where: { attributed: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(codes);
  } catch (error) {
    console.error('Get codes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/codes
router.post('/codes', async (req: Request, res: Response) => {
  try {
    const { code, affiliateId, discountPercent, commissionRateOverride, label, expiresAt } = req.body;

    if (!code || !affiliateId) {
      return res.status(400).json({ error: 'code and affiliateId are required' });
    }

    const existing = await prisma.discountCode.findUnique({ where: { code: code.toUpperCase() } });
    if (existing) {
      return res.status(409).json({ error: 'Code already exists' });
    }

    const discountCode = await prisma.discountCode.create({
      data: {
        code: code.toUpperCase(),
        affiliateId,
        discountPercent: discountPercent ?? 0.10,
        commissionRateOverride: commissionRateOverride ?? null,
        label: label || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        affiliate: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(discountCode);
  } catch (error) {
    console.error('Create code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/codes/:id
router.patch('/codes/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { discountPercent, commissionRateOverride, label, active, expiresAt } = req.body;

    const data: any = {};
    if (discountPercent !== undefined) data.discountPercent = discountPercent;
    if (commissionRateOverride !== undefined) data.commissionRateOverride = commissionRateOverride;
    if (label !== undefined) data.label = label;
    if (active !== undefined) data.active = active;
    if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;

    const code = await prisma.discountCode.update({
      where: { id },
      data,
      include: { affiliate: { select: { id: true, name: true } } },
    });

    res.json(code);
  } catch (error) {
    console.error('Update code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/codes/:id
router.delete('/codes/:id', async (req: Request, res: Response) => {
  try {
    await prisma.discountCode.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ ORDERS ============

// GET /api/admin/orders
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', affiliateId, attributed, search } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (affiliateId) {
      where.discountCode = { affiliateId: affiliateId as string };
    }
    if (attributed !== undefined) {
      where.attributed = attributed === 'true';
    }
    if (search) {
      const s = search as string;
      where.OR = [
        { customerFirstName: { contains: s, mode: 'insensitive' } },
        { itemsSummary: { contains: s, mode: 'insensitive' } },
        { externalOrderId: { contains: s, mode: 'insensitive' } },
        { discountCode: { code: { contains: s, mode: 'insensitive' } } },
        { discountCode: { affiliate: { name: { contains: s, mode: 'insensitive' } } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          discountCode: {
            include: { affiliate: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/orders/:id
router.delete('/orders/:id', async (req: Request, res: Response) => {
  try {
    await prisma.order.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ PAYOUTS ============

// GET /api/admin/payouts
router.get('/payouts', async (_req: Request, res: Response) => {
  try {
    const payouts = await prisma.payout.findMany({
      include: { affiliate: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payouts);
  } catch (error) {
    console.error('Get payouts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/payouts
router.post('/payouts', async (req: Request, res: Response) => {
  try {
    const { affiliateId, amount, period, notes } = req.body;

    if (!affiliateId || !amount || !period) {
      return res.status(400).json({ error: 'affiliateId, amount, and period are required' });
    }

    const payout = await prisma.payout.create({
      data: { affiliateId, amount, period, notes: notes || null },
      include: { affiliate: { select: { id: true, name: true } } },
    });

    res.status(201).json(payout);
  } catch (error) {
    console.error('Create payout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/payouts/:id
router.patch('/payouts/:id', async (req: Request, res: Response) => {
  try {
    const { status, paidAt, notes } = req.body;
    const data: any = {};
    if (status !== undefined) data.status = status;
    if (paidAt !== undefined) data.paidAt = paidAt ? new Date(paidAt) : null;
    if (notes !== undefined) data.notes = notes;

    // Auto-set paidAt when marking as PAID
    if (status === 'PAID' && !paidAt) {
      data.paidAt = new Date();
    }

    const payout = await prisma.payout.update({
      where: { id: req.params.id },
      data,
      include: { affiliate: { select: { id: true, name: true } } },
    });

    res.json(payout);
  } catch (error) {
    console.error('Update payout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ DASHBOARD STATS ============

// GET /api/admin/stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { affiliateId } = req.query;

    let orderWhere: any = { attributed: true };
    let payoutWhere: any = { status: 'PENDING' as const };

    if (affiliateId) {
      const codes = await prisma.discountCode.findMany({
        where: { affiliateId: affiliateId as string },
        select: { id: true },
      });
      const codeIds = codes.map((c) => c.id);
      orderWhere.discountCodeId = { in: codeIds };
      payoutWhere.affiliateId = affiliateId as string;
    }

    const [totalAffiliates, activeAffiliates, totalOrders, attributedOrders, totalRevenue, totalCommissions, pendingPayouts] =
      await Promise.all([
        prisma.user.count({ where: { role: 'AFFILIATE' } }),
        prisma.user.count({ where: { role: 'AFFILIATE', active: true } }),
        affiliateId
          ? prisma.order.count({ where: { discountCodeId: { in: (orderWhere.discountCodeId as any).in } } })
          : prisma.order.count(),
        prisma.order.count({ where: orderWhere }),
        prisma.order.aggregate({ _sum: { orderTotal: true }, where: orderWhere }),
        prisma.order.aggregate({ _sum: { commissionEarned: true }, where: orderWhere }),
        prisma.payout.aggregate({ _sum: { amount: true }, where: payoutWhere }),
      ]);

    res.json({
      totalAffiliates,
      activeAffiliates,
      totalOrders,
      attributedOrders,
      totalRevenue: totalRevenue._sum.orderTotal || 0,
      totalCommissions: totalCommissions._sum.commissionEarned || 0,
      pendingPayouts: pendingPayouts._sum.amount || 0,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
