import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { logSystem } from '../lib/logger';

const router = Router();

// POST /api/webhooks/order-paid
// Receives: { customer_first_name, items_summary, order_total, discount_code, source, external_order_id }
router.post('/order-paid', async (req: Request, res: Response) => {
  try {
    const {
      customer_first_name,
      customer_last_name,
      items_summary,
      order_total,
      discount_code,
      source = 'shopify',
      store_name,
      source_store,
      currency = 'USD',
      external_order_id,
    } = req.body;

    console.log('📥 Webhook received:', JSON.stringify(req.body));
    logSystem({ source: 'WEBHOOK', message: 'Webhook received', details: { source, external_order_id, discount_code, order_total } });

    // Validate required fields
    if (!customer_first_name || !order_total) {
      return res.status(400).json({ error: 'customer_first_name and order_total are required' });
    }

    // Duplicate detection
    if (external_order_id) {
      const existing = await prisma.order.findFirst({
        where: { externalOrderId: external_order_id },
      });
      if (existing) {
        console.log(`⏩ Duplicate order skipped (same external_id): ${external_order_id}`);
        return res.json({
          success: true,
          order_id: existing.id,
          attributed: existing.attributed,
          commission_earned: existing.commissionEarned,
          duplicate: true,
        });
      }
    } else {
      // Fallback: check for same customer + amount within 5 minutes
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const existing = await prisma.order.findFirst({
        where: {
          customerFirstName: customer_first_name,
          orderTotal: parseFloat(order_total),
          source,
          createdAt: { gte: fiveMinAgo },
        },
      });
      if (existing) {
        console.log(`⏩ Duplicate order skipped (same customer+amount within 5min): ${existing.id}`);
        return res.json({
          success: true,
          order_id: existing.id,
          attributed: existing.attributed,
          commission_earned: existing.commissionEarned,
          duplicate: true,
        });
      }
    }

    let discountCodeRecord = null;
    let attributed = false;
    let commissionEarned = 0;

    // Look up discount code if provided
    if (discount_code) {
      const codeToFind = discount_code.toString().trim().toUpperCase();
      console.log(`🔍 Looking up discount code: "${codeToFind}"`);

      // Try exact match first
      discountCodeRecord = await prisma.discountCode.findUnique({
        where: { code: codeToFind },
        include: { affiliate: true, splits: true },
      });

      // If no exact match, try partial match (code might have extra text)
      if (!discountCodeRecord) {
        console.log('🔍 Exact match failed, trying partial match...');
        discountCodeRecord = await prisma.discountCode.findFirst({
          where: {
            code: {
              contains: codeToFind,
              mode: 'insensitive',
            },
          },
          include: { affiliate: true, splits: true },
        });
      }

      // If still no match, try if the incoming code contains any of our codes
      if (!discountCodeRecord) {
        console.log('🔍 Partial match failed, checking if code contains any known codes...');
        const allCodes = await prisma.discountCode.findMany({
          include: { affiliate: true, splits: true },
        });
        for (const c of allCodes) {
          if (codeToFind.includes(c.code.toUpperCase())) {
            discountCodeRecord = c;
            console.log(`✅ Found embedded code: ${c.code}`);
            break;
          }
        }
      }

      if (discountCodeRecord) {
        console.log(`✅ Code matched: ${discountCodeRecord.code} → Affiliate: ${discountCodeRecord.affiliate.name}`);

        const now = new Date();
        const isActive = discountCodeRecord.active;
        const isNotExpired = !discountCodeRecord.expiresAt || discountCodeRecord.expiresAt > now;
        const affiliateActive = discountCodeRecord.affiliate.active;

        console.log(`   Active: ${isActive}, Not expired: ${isNotExpired}, Affiliate active: ${affiliateActive}`);

        if (isActive && isNotExpired && affiliateActive) {
          attributed = true;

          // Commission priority: code override -> affiliate default -> global 20%
          const commissionRate =
            discountCodeRecord.commissionRateOverride ??
            discountCodeRecord.affiliate.defaultCommissionRate ??
            0.20;

          commissionEarned = parseFloat((order_total * commissionRate).toFixed(2));
          console.log(`💰 Commission: ${commissionRate * 100}% of $${order_total} = $${commissionEarned}`);
        }
      } else {
        console.log(`❌ No matching code found for: "${codeToFind}"`);
        // List all codes in DB for debugging
        const allCodes = await prisma.discountCode.findMany({ select: { code: true } });
        console.log('📋 Codes in database:', allCodes.map(c => c.code).join(', '));
        logSystem({ level: 'WARN', source: 'WEBHOOK', message: `No matching discount code found: "${codeToFind}"`, details: { codeAttempted: codeToFind, availableCodes: allCodes.map(c => c.code) } });
      }
    } else {
      console.log('ℹ️ No discount code provided in webhook');
    }

    // Build per-recipient commission rows (the ledger).
    // - No splits configured on the code → 100% goes to the code's affiliate (legacy behavior).
    // - Splits configured → distribute total commission by each split's sharePercent.
    // Rounding drift is absorbed by the last row so the sum matches `commissionEarned` exactly.
    type CommissionAllocation = { recipientUserId: string; amount: number; sharePercent: number };
    const allocations: CommissionAllocation[] = [];
    if (attributed && discountCodeRecord && commissionEarned > 0) {
      const splits = (discountCodeRecord as any).splits as Array<{ recipientUserId: string; sharePercent: number }> | undefined;
      if (splits && splits.length > 0) {
        let remaining = commissionEarned;
        splits.forEach((s, i) => {
          const isLast = i === splits.length - 1;
          const amount = isLast
            ? parseFloat(remaining.toFixed(2))
            : parseFloat((commissionEarned * s.sharePercent).toFixed(2));
          remaining = parseFloat((remaining - amount).toFixed(2));
          allocations.push({ recipientUserId: s.recipientUserId, amount, sharePercent: s.sharePercent });
        });
      } else {
        allocations.push({
          recipientUserId: discountCodeRecord.affiliateId,
          amount: commissionEarned,
          sharePercent: 1.0,
        });
      }
    }

    // Create order record + per-recipient commission rows in one transaction
    const order = await prisma.order.create({
      data: {
        externalOrderId: external_order_id || null,
        discountCodeId: discountCodeRecord?.id || null,
        customerFirstName: customer_first_name,
        customerLastName: customer_last_name || null,
        itemsSummary: items_summary || '',
        orderTotal: parseFloat(order_total),
        commissionEarned,
        attributed,
        source,
        storeName: source_store || store_name || null,
        currency: currency.toUpperCase(),
        commissions: {
          create: allocations.map((a) => ({
            recipientUserId: a.recipientUserId,
            amount: a.amount,
            sharePercent: a.sharePercent,
          })),
        },
      },
    });

    if (allocations.length > 1) {
      console.log(
        `🪓 Commission split across ${allocations.length} recipients: ${allocations
          .map((a) => `${a.recipientUserId.slice(0, 8)}=$${a.amount}`)
          .join(', ')}`
      );
    }

    console.log(
      `✅ Order saved: ${order.id} | Code: ${discount_code || 'none'} | Attributed: ${attributed} | Commission: $${commissionEarned}`
    );

    logSystem({ source: 'WEBHOOK', message: `Order processed: ${order.id}`, details: { orderId: order.id, discountCode: discount_code, attributed, commissionEarned, orderTotal: order_total, source } });

    res.json({
      success: true,
      order_id: order.id,
      attributed,
      commission_earned: commissionEarned,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    logSystem({ level: 'ERROR', source: 'WEBHOOK', message: 'Webhook processing error', details: { error: String(error), body: req.body } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/webhooks/valid-codes — public endpoint for Worker + theme.liquid
router.get('/valid-codes', async (_req: Request, res: Response) => {
  try {
    const codes = await prisma.discountCode.findMany({
      where: { active: true },
      include: { affiliate: { select: { active: true } } },
    });
    const now = new Date();
    const valid: Record<string, any> = {};
    for (const c of codes) {
      if (!c.affiliate.active) continue;
      if (c.expiresAt && c.expiresAt < now) continue;
      valid[c.code] = {
        value: (c.discountPercent * 100).toFixed(1),
        type: 'percentage',
        title: `${(c.discountPercent * 100).toFixed(0)}% Off`,
      };
    }
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    res.json(valid);
  } catch (error) {
    console.error('Valid codes error:', error);
    res.status(500).json({});
  }
});

export default router;
