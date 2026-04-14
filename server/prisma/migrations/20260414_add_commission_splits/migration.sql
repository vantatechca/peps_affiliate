-- Ensure gen_random_uuid() is available for the backfill step below (no-op on PG 13+).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateTable: CommissionSplit (per-code rule for splitting commission)
CREATE TABLE "CommissionSplit" (
    "id" TEXT NOT NULL,
    "discountCodeId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "sharePercent" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionSplit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommissionSplit_discountCodeId_idx" ON "CommissionSplit"("discountCodeId");
CREATE INDEX "CommissionSplit_recipientUserId_idx" ON "CommissionSplit"("recipientUserId");

ALTER TABLE "CommissionSplit" ADD CONSTRAINT "CommissionSplit_discountCodeId_fkey"
    FOREIGN KEY ("discountCodeId") REFERENCES "DiscountCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionSplit" ADD CONSTRAINT "CommissionSplit_recipientUserId_fkey"
    FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: OrderCommission (per-order ledger of actual amounts credited)
CREATE TABLE "OrderCommission" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "sharePercent" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderCommission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderCommission_orderId_idx" ON "OrderCommission"("orderId");
CREATE INDEX "OrderCommission_recipientUserId_idx" ON "OrderCommission"("recipientUserId");

ALTER TABLE "OrderCommission" ADD CONSTRAINT "OrderCommission_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderCommission" ADD CONSTRAINT "OrderCommission_recipientUserId_fkey"
    FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: for every existing attributed order, create one OrderCommission row
-- crediting 100% of commissionEarned to the discount code's affiliate.
-- This preserves historical earnings for the affiliate dashboard which now
-- reads from OrderCommission instead of Order.commissionEarned directly.
INSERT INTO "OrderCommission" ("id", "orderId", "recipientUserId", "amount", "sharePercent", "createdAt")
SELECT
    gen_random_uuid()::text,
    o."id",
    dc."affiliateId",
    o."commissionEarned",
    1.0,
    o."createdAt"
FROM "Order" o
INNER JOIN "DiscountCode" dc ON dc."id" = o."discountCodeId"
WHERE o."attributed" = true
  AND o."commissionEarned" > 0;
