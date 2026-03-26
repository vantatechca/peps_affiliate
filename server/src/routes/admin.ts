import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { logAudit, logSystem, auditFromReq, enrichAuditUser } from '../lib/logger';

const router = Router();

router.use(authenticate, requireAdmin, enrichAuditUser);

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

    logAudit({ ...auditFromReq(req), action: 'CREATE_AFFILIATE', entity: 'User', entityId: affiliate.id, details: { email: affiliate.email, name: affiliate.name } });

    res.status(201).json({
      id: affiliate.id,
      email: affiliate.email,
      name: affiliate.name,
      defaultCommissionRate: affiliate.defaultCommissionRate,
      passwordPlain: affiliate.passwordPlain,
    });
  } catch (error) {
    console.error('Create affiliate error:', error);
    logSystem({ level: 'ERROR', source: 'API', message: 'Create affiliate error', details: { error: String(error) } });
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

    logAudit({ ...auditFromReq(req), action: 'UPDATE_AFFILIATE', entity: 'User', entityId: id, details: { changes: Object.keys(data) } });

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
    logSystem({ level: 'ERROR', source: 'API', message: 'Update affiliate error', details: { error: String(error), affiliateId: req.params.id } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/affiliates/:id
router.delete('/affiliates/:id', async (req: Request, res: Response) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { email: true, name: true } });
    await prisma.user.delete({ where: { id: req.params.id } });
    logAudit({ ...auditFromReq(req), action: 'DELETE_AFFILIATE', entity: 'User', entityId: req.params.id, details: { deletedEmail: target?.email, deletedName: target?.name } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete affiliate error:', error);
    logSystem({ level: 'ERROR', source: 'API', message: 'Delete affiliate error', details: { error: String(error), affiliateId: req.params.id } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/affiliates/batch-delete
router.post('/affiliates/batch-delete', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const targets = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, name: true } });
    const result = await prisma.user.deleteMany({ where: { id: { in: ids } } });
    logAudit({ ...auditFromReq(req), action: 'BATCH_DELETE_AFFILIATES', entity: 'User', details: { count: result.count, deleted: targets.map(t => ({ id: t.id, email: t.email, name: t.name })) } });
    res.json({ success: true, deleted: result.count });
  } catch (error) {
    console.error('Batch delete affiliates error:', error);
    logSystem({ level: 'ERROR', source: 'API', message: 'Batch delete affiliates error', details: { error: String(error) } });
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

    logAudit({ ...auditFromReq(req), action: 'CREATE_CODE', entity: 'DiscountCode', entityId: discountCode.id, details: { code: discountCode.code, affiliateId } });

    res.status(201).json(discountCode);
  } catch (error) {
    console.error('Create code error:', error);
    logSystem({ level: 'ERROR', source: 'API', message: 'Create code error', details: { error: String(error) } });
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

    logAudit({ ...auditFromReq(req), action: 'UPDATE_CODE', entity: 'DiscountCode', entityId: id, details: { code: code.code, changes: Object.keys(data) } });

    res.json(code);
  } catch (error) {
    console.error('Update code error:', error);
    logSystem({ level: 'ERROR', source: 'API', message: 'Update code error', details: { error: String(error), codeId: req.params.id } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/codes/:id
router.delete('/codes/:id', async (req: Request, res: Response) => {
  try {
    const target = await prisma.discountCode.findUnique({ where: { id: req.params.id }, select: { code: true } });
    await prisma.discountCode.delete({ where: { id: req.params.id } });
    logAudit({ ...auditFromReq(req), action: 'DELETE_CODE', entity: 'DiscountCode', entityId: req.params.id, details: { deletedCode: target?.code } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete code error:', error);
    logSystem({ level: 'ERROR', source: 'API', message: 'Delete code error', details: { error: String(error), codeId: req.params.id } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/codes/batch-delete
router.post('/codes/batch-delete', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const targets = await prisma.discountCode.findMany({ where: { id: { in: ids } }, select: { id: true, code: true } });
    const result = await prisma.discountCode.deleteMany({ where: { id: { in: ids } } });
    logAudit({ ...auditFromReq(req), action: 'BATCH_DELETE_CODES', entity: 'DiscountCode', details: { count: result.count, deleted: targets.map(t => ({ id: t.id, code: t.code })) } });
    res.json({ success: true, deleted: result.count });
  } catch (error) {
    console.error('Batch delete codes error:', error);
    logSystem({ level: 'ERROR', source: 'API', message: 'Batch delete codes error', details: { error: String(error) } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ ORDERS ============

// GET /api/admin/orders
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', affiliateId, attributed, search, startDate, endDate, source, currency, storeName } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (affiliateId) {
      where.discountCode = { affiliateId: affiliateId as string };
    }
    if (attributed !== undefined) {
      where.attributed = attributed === 'true';
    }
    if (source) {
      where.source = source as string;
    }
    if (currency) {
      where.currency = currency as string;
    }
    if (storeName) {
      where.storeName = { contains: storeName as string, mode: 'insensitive' };
    }
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
    }
    if (search) {
      const s = search as string;
      where.OR = [
        { customerFirstName: { contains: s, mode: 'insensitive' } },
        { customerLastName: { contains: s, mode: 'insensitive' } },
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
    const target = await prisma.order.findUnique({ where: { id: req.params.id }, select: { externalOrderId: true, customerFirstName: true, orderTotal: true } });
    await prisma.order.delete({ where: { id: req.params.id } });
    logAudit({ ...auditFromReq(req), action: 'DELETE_ORDER', entity: 'Order', entityId: req.params.id, details: { externalOrderId: target?.externalOrderId, customer: target?.customerFirstName, total: target?.orderTotal } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete order error:', error);
    logSystem({ level: 'ERROR', source: 'API', message: 'Delete order error', details: { error: String(error), orderId: req.params.id } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/orders/batch-delete
router.post('/orders/batch-delete', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const result = await prisma.order.deleteMany({ where: { id: { in: ids } } });
    logAudit({ ...auditFromReq(req), action: 'BATCH_DELETE_ORDERS', entity: 'Order', details: { count: result.count, ids } });
    res.json({ success: true, deleted: result.count });
  } catch (error) {
    console.error('Batch delete orders error:', error);
    logSystem({ level: 'ERROR', source: 'API', message: 'Batch delete orders error', details: { error: String(error) } });
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

    logAudit({ ...auditFromReq(req), action: 'CREATE_PAYOUT', entity: 'Payout', entityId: payout.id, details: { affiliateId, amount, period } });

    res.status(201).json(payout);
  } catch (error) {
    console.error('Create payout error:', error);
    logSystem({ level: 'ERROR', source: 'API', message: 'Create payout error', details: { error: String(error) } });
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

    logAudit({ ...auditFromReq(req), action: 'UPDATE_PAYOUT', entity: 'Payout', entityId: req.params.id, details: { changes: Object.keys(data), newStatus: status } });

    res.json(payout);
  } catch (error) {
    console.error('Update payout error:', error);
    logSystem({ level: 'ERROR', source: 'API', message: 'Update payout error', details: { error: String(error), payoutId: req.params.id } });
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

    const [
      totalAffiliates, activeAffiliates, totalOrders, attributedOrders,
      totalRevenue, totalCommissions, pendingPayouts,
      allOrdersRevenue, nonAttributedCount,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'AFFILIATE' } }),
      prisma.user.count({ where: { role: 'AFFILIATE', active: true } }),
      affiliateId
        ? prisma.order.count({ where: { discountCodeId: { in: (orderWhere.discountCodeId as any).in } } })
        : prisma.order.count(),
      prisma.order.count({ where: orderWhere }),
      prisma.order.aggregate({ _sum: { orderTotal: true }, where: orderWhere }),
      prisma.order.aggregate({ _sum: { commissionEarned: true }, where: orderWhere }),
      prisma.payout.aggregate({ _sum: { amount: true }, where: payoutWhere }),
      prisma.order.aggregate({ _sum: { orderTotal: true } }),
      prisma.order.count({ where: { attributed: false } }),
    ]);

    res.json({
      totalAffiliates,
      activeAffiliates,
      totalOrders,
      attributedOrders,
      totalRevenue: totalRevenue._sum.orderTotal || 0,
      totalCommissions: totalCommissions._sum.commissionEarned || 0,
      pendingPayouts: pendingPayouts._sum.amount || 0,
      allOrdersRevenue: allOrdersRevenue._sum.orderTotal || 0,
      nonAttributedCount,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
