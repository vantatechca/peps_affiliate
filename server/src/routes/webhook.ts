import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// POST /api/webhooks/order-paid
// Receives: { customer_first_name, items_summary, order_total, discount_code, source, external_order_id }
router.post('/order-paid', async (req: Request, res: Response) => {
  try {
    const {
      customer_first_name,
      items_summary,
      order_total,
      discount_code,
      source = 'shopify',
      external_order_id,
    } = req.body;

    // Validate required fields
    if (!customer_first_name || !order_total) {
      return res.status(400).json({ error: 'customer_first_name and order_total are required' });
    }

    let discountCodeRecord = null;
    let attributed = false;
    let commissionEarned = 0;

    // Look up discount code if provided
    if (discount_code) {
      discountCodeRecord = await prisma.discountCode.findUnique({
        where: { code: discount_code.toUpperCase() },
        include: { affiliate: true },
      });

      if (discountCodeRecord) {
        const now = new Date();
        const isActive = discountCodeRecord.active;
        const isNotExpired = !discountCodeRecord.expiresAt || discountCodeRecord.expiresAt > now;
        const affiliateActive = discountCodeRecord.affiliate.active;

        if (isActive && isNotExpired && affiliateActive) {
          attributed = true;

          // Commission priority: code override -> affiliate default -> global 20%
          const commissionRate =
            discountCodeRecord.commissionRateOverride ??
            discountCodeRecord.affiliate.defaultCommissionRate ??
            0.20;

          commissionEarned = parseFloat((order_total * commissionRate).toFixed(2));
        }
      }
    }

    // Create order record
    const order = await prisma.order.create({
      data: {
        externalOrderId: external_order_id || null,
        discountCodeId: discountCodeRecord?.id || null,
        customerFirstName: customer_first_name,
        itemsSummary: items_summary || '',
        orderTotal: parseFloat(order_total),
        commissionEarned,
        attributed,
        source,
      },
    });

    console.log(
      `Order received: ${order.id} | Code: ${discount_code || 'none'} | Attributed: ${attributed} | Commission: $${commissionEarned}`
    );

    res.json({
      success: true,
      order_id: order.id,
      attributed,
      commission_earned: commissionEarned,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
