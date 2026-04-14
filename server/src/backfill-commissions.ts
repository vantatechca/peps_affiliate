// One-shot backfill for the commission-splits feature.
//
// Because this project deploys via `prisma db push` (not `migrate deploy`),
// the backfill SQL in prisma/migrations/*/migration.sql is skipped on Render.
// This script does the same thing, is safe to run any number of times, and is
// invoked from render-build.sh right after `prisma db push`.
//
// For each attributed order with a positive commission, ensure there's an
// OrderCommission row crediting the code's affiliate for the full amount.
// If one already exists (created either by the webhook on new orders or by
// a previous run of this script), do nothing.

import prisma from './lib/prisma';

async function main() {
  console.log('🔄 Backfilling OrderCommission ledger from historical orders…');

  const orders = await prisma.order.findMany({
    where: {
      attributed: true,
      commissionEarned: { gt: 0 },
      commissions: { none: {} },
      discountCode: { isNot: null },
    },
    select: {
      id: true,
      commissionEarned: true,
      createdAt: true,
      discountCode: { select: { affiliateId: true } },
    },
  });

  console.log(`Found ${orders.length} orders needing backfill`);

  if (orders.length === 0) {
    console.log('✅ Nothing to do');
    return;
  }

  // Batch to avoid huge createMany payloads on large stores
  const BATCH = 500;
  let created = 0;
  for (let i = 0; i < orders.length; i += BATCH) {
    const chunk = orders.slice(i, i + BATCH);
    const result = await prisma.orderCommission.createMany({
      data: chunk
        .filter((o) => o.discountCode) // extra safety
        .map((o) => ({
          orderId: o.id,
          recipientUserId: o.discountCode!.affiliateId,
          amount: o.commissionEarned,
          sharePercent: 1.0,
          createdAt: o.createdAt,
        })),
      skipDuplicates: true,
    });
    created += result.count;
    console.log(`  …${created}/${orders.length}`);
  }

  console.log(`✅ Backfill complete. Created ${created} OrderCommission rows.`);
}

main()
  .catch((err) => {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
