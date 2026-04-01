import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authenticate, requireSuperAdmin, signToken } from '../middleware/auth';
import { logAudit, logSystem, auditFromReq, enrichAuditUser } from '../lib/logger';

const router = Router();

router.use(authenticate, requireSuperAdmin, enrichAuditUser);

// ============ ADMIN MANAGEMENT ============

// GET /api/super/admins
router.get('/admins', async (_req: Request, res: Response) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: {
        id: true, email: true, name: true, role: true,
        passwordPlain: true, active: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(admins);
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/super/admins
router.post('/admins', async (req: Request, res: Response) => {
  try {
    const { email, name, password, role = 'ADMIN' } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'email, name, and password are required' });
    }

    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return res.status(400).json({ error: 'Role must be ADMIN or SUPER_ADMIN' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        passwordPlain: password,
        role,
      },
    });

    logAudit({ ...auditFromReq(req), action: 'CREATE_ADMIN', entity: 'User', entityId: admin.id, details: { email: admin.email, name: admin.name, role: admin.role } });

    res.status(201).json({
      id: admin.id, email: admin.email, name: admin.name,
      role: admin.role, passwordPlain: admin.passwordPlain,
    });
  } catch (error) {
    console.error('Create admin error:', error);
    logSystem({ level: 'ERROR', source: 'API', message: 'Create admin error', details: { error: String(error) } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/super/admins/:id
router.patch('/admins/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, password, active, role } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email.toLowerCase();
    if (active !== undefined) data.active = active;
    if (role !== undefined && (role === 'ADMIN' || role === 'SUPER_ADMIN')) data.role = role;
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 10);
      data.passwordPlain = password;
    }

    const admin = await prisma.user.update({ where: { id }, data });

    logAudit({ ...auditFromReq(req), action: 'UPDATE_ADMIN', entity: 'User', entityId: id, details: { changes: Object.keys(data) } });

    res.json({
      id: admin.id, email: admin.email, name: admin.name,
      role: admin.role, active: admin.active, passwordPlain: admin.passwordPlain,
    });
  } catch (error) {
    console.error('Update admin error:', error);
    logSystem({ level: 'ERROR', source: 'API', message: 'Update admin error', details: { error: String(error), adminId: req.params.id } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/super/admins/:id
router.delete('/admins/:id', async (req: Request, res: Response) => {
  try {
    // Prevent deleting yourself
    if (req.params.id === req.user!.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { email: true, name: true, role: true } });
    await prisma.user.delete({ where: { id: req.params.id } });
    logAudit({ ...auditFromReq(req), action: 'DELETE_ADMIN', entity: 'User', entityId: req.params.id, details: { deletedEmail: target?.email, deletedName: target?.name, deletedRole: target?.role } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete admin error:', error);
    logSystem({ level: 'ERROR', source: 'API', message: 'Delete admin error', details: { error: String(error), adminId: req.params.id } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ IMPERSONATE / VIEW AS ============

// GET /api/super/view-as/:userId
// Returns the dashboard data for any user (affiliate or admin)
router.get('/view-as/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, defaultCommissionRate: true },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    logAudit({ ...auditFromReq(req), action: 'VIEW_AS', entity: 'User', entityId: userId, details: { targetEmail: user.email, targetName: user.name, targetRole: user.role } });

    if (user.role === 'AFFILIATE') {
      // Return affiliate dashboard data
      const codes = await prisma.discountCode.findMany({
        where: { affiliateId: userId },
        include: { _count: { select: { orders: { where: { attributed: true } } } } },
        orderBy: { createdAt: 'desc' },
      });

      const codeIds = codes.map((c) => c.id);

      const totalStats = await prisma.order.aggregate({
        where: { discountCodeId: { in: codeIds }, attributed: true },
        _sum: { orderTotal: true, commissionEarned: true },
        _count: true,
      });

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const monthlyStats = await prisma.order.aggregate({
        where: { discountCodeId: { in: codeIds }, attributed: true, createdAt: { gte: startOfMonth } },
        _sum: { orderTotal: true, commissionEarned: true },
        _count: true,
      });

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const dailyStats = await prisma.order.aggregate({
        where: { discountCodeId: { in: codeIds }, attributed: true, createdAt: { gte: startOfDay } },
        _sum: { orderTotal: true, commissionEarned: true },
        _count: true,
      });

      const pendingPayouts = await prisma.payout.aggregate({
        where: { affiliateId: userId, status: 'PENDING' },
        _sum: { amount: true },
      });

      const paidPayouts = await prisma.payout.aggregate({
        where: { affiliateId: userId, status: 'PAID' },
        _sum: { amount: true },
      });

      // Get recent orders
      const orders = await prisma.order.findMany({
        where: { discountCodeId: { in: codeIds }, attributed: true },
        include: { discountCode: { select: { code: true, label: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return res.json({
        user,
        type: 'affiliate',
        data: {
          codes: codes.map((c) => ({
            id: c.id, code: c.code, label: c.label, discountPercent: c.discountPercent,
            active: c.active, expiresAt: c.expiresAt, timesUsed: c._count.orders,
          })),
          stats: {
            total: { orders: totalStats._count, revenue: totalStats._sum.orderTotal || 0, earnings: totalStats._sum.commissionEarned || 0 },
            monthly: { orders: monthlyStats._count, revenue: monthlyStats._sum.orderTotal || 0, earnings: monthlyStats._sum.commissionEarned || 0 },
            daily: { orders: dailyStats._count, revenue: dailyStats._sum.orderTotal || 0, earnings: dailyStats._sum.commissionEarned || 0 },
          },
          payouts: { pending: pendingPayouts._sum.amount || 0, paid: paidPayouts._sum.amount || 0 },
          orders: orders.map((o) => ({
            id: o.id, customerFirstName: o.customerFirstName, itemsSummary: o.itemsSummary,
            orderTotal: o.orderTotal, commissionEarned: o.commissionEarned,
            discountCode: o.discountCode?.code, codeLabel: o.discountCode?.label,
            source: o.source, date: o.createdAt,
          })),
        },
      });
    }

    // Admin view - return overview stats
    const [totalAffiliates, activeAffiliates, totalOrders, attributedOrders, totalRevenue, totalCommissions] =
      await Promise.all([
        prisma.user.count({ where: { role: 'AFFILIATE' } }),
        prisma.user.count({ where: { role: 'AFFILIATE', active: true } }),
        prisma.order.count(),
        prisma.order.count({ where: { attributed: true } }),
        prisma.order.aggregate({ _sum: { orderTotal: true }, where: { attributed: true } }),
        prisma.order.aggregate({ _sum: { commissionEarned: true }, where: { attributed: true } }),
      ]);

    return res.json({
      user,
      type: 'admin',
      data: {
        totalAffiliates, activeAffiliates, totalOrders, attributedOrders,
        totalRevenue: totalRevenue._sum.orderTotal || 0,
        totalCommissions: totalCommissions._sum.commissionEarned || 0,
      },
    });
  } catch (error) {
    console.error('View-as error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/super/all-users
// List all users for the impersonation dropdown
router.get('/all-users', async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, active: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    res.json(users);
  } catch (error) {
    console.error('All users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ ORDERS ============

// POST /api/super/orders — manually create an order
router.post('/orders', async (req: Request, res: Response) => {
  try {
    const {
      customerFirstName,
      customerLastName,
      itemsSummary,
      orderTotal,
      discountCodeId,
      source = 'manual',
      storeName,
      currency = 'USD',
      externalOrderId,
    } = req.body;

    if (!customerFirstName || !orderTotal || !itemsSummary) {
      return res.status(400).json({ error: 'customerFirstName, itemsSummary, and orderTotal are required' });
    }

    let attributed = false;
    let commissionEarned = 0;

    // Calculate commission if a discount code is provided
    if (discountCodeId) {
      const discountCode = await prisma.discountCode.findUnique({
        where: { id: discountCodeId },
        include: { affiliate: true },
      });

      if (discountCode && discountCode.active && discountCode.affiliate.active) {
        const now = new Date();
        const isNotExpired = !discountCode.expiresAt || discountCode.expiresAt > now;

        if (isNotExpired) {
          attributed = true;
          const commissionRate =
            discountCode.commissionRateOverride ??
            discountCode.affiliate.defaultCommissionRate ??
            0.20;
          commissionEarned = parseFloat((parseFloat(String(orderTotal)) * commissionRate).toFixed(2));
        }
      }
    }

    const order = await prisma.order.create({
      data: {
        customerFirstName,
        customerLastName: customerLastName || null,
        itemsSummary,
        orderTotal: parseFloat(String(orderTotal)),
        discountCodeId: discountCodeId || null,
        commissionEarned,
        attributed,
        source,
        storeName: storeName || null,
        currency: currency.toUpperCase(),
        externalOrderId: externalOrderId || null,
      },
      include: {
        discountCode: {
          include: { affiliate: { select: { id: true, name: true } } },
        },
      },
    });

    logAudit({
      ...auditFromReq(req),
      action: 'CREATE_ORDER',
      entity: 'Order',
      entityId: order.id,
      details: {
        customerFirstName,
        orderTotal: order.orderTotal,
        source: order.source,
        attributed: order.attributed,
        commissionEarned: order.commissionEarned,
      },
    });

    res.status(201).json(order);
  } catch (error) {
    console.error('Create order error:', error);
    logSystem({ level: 'ERROR', source: 'API', message: 'Create order error', details: { error: String(error) } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/super/orders/:id  — edit currency, source, storeName
router.patch('/orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { currency, source, storeName, createdAt } = req.body;

    const data: any = {};
    if (currency !== undefined) data.currency = currency;
    if (source !== undefined) data.source = source;
    if (storeName !== undefined) data.storeName = storeName || null;
    if (createdAt !== undefined) data.createdAt = new Date(createdAt);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const order = await prisma.order.update({
      where: { id },
      data,
      include: {
        discountCode: {
          include: { affiliate: { select: { id: true, name: true } } },
        },
      },
    });

    logAudit({
      ...auditFromReq(req),
      action: 'EDIT_ORDER',
      entity: 'Order',
      entityId: id,
      details: { changes: data, externalOrderId: order.externalOrderId },
    });

    res.json(order);
  } catch (error) {
    console.error('Edit order error:', error);
    logSystem({ level: 'ERROR', source: 'API', message: 'Edit order error', details: { error: String(error), orderId: req.params.id } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/super/orders — manually create an order
router.post('/orders', async (req: Request, res: Response) => {
  try {
    const { customerFirstName, customerLastName, itemsSummary, orderTotal, commissionEarned, discountCodeId, source, storeName, currency, attributed, createdAt } = req.body;

    if (!customerFirstName || !itemsSummary || orderTotal === undefined) {
      return res.status(400).json({ error: 'customerFirstName, itemsSummary, and orderTotal are required' });
    }

    const order = await prisma.order.create({
      data: {
        customerFirstName,
        customerLastName: customerLastName || null,
        itemsSummary,
        orderTotal: parseFloat(orderTotal),
        commissionEarned: commissionEarned ? parseFloat(commissionEarned) : 0,
        discountCodeId: discountCodeId || null,
        source: source || 'shopify',
        storeName: storeName || null,
        currency: currency || 'USD',
        attributed: attributed ?? false,
        createdAt: createdAt ? new Date(createdAt) : new Date(),
      },
      include: {
        discountCode: {
          include: { affiliate: { select: { id: true, name: true } } },
        },
      },
    });

    logAudit({
      ...auditFromReq(req),
      action: 'CREATE_ORDER',
      entity: 'Order',
      entityId: order.id,
      details: { customerFirstName, itemsSummary, orderTotal, source: source || 'shopify' },
    });

    res.status(201).json(order);
  } catch (error) {
    console.error('Create order error:', error);
    logSystem({ level: 'ERROR', source: 'API', message: 'Create order error', details: { error: String(error) } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
