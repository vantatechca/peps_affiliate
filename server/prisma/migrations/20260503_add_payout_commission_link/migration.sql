-- Link OrderCommission rows to the Payout that disbursed them. A NULL
-- payoutId means the commission is unpaid and counts toward available balance.
ALTER TABLE "OrderCommission" ADD COLUMN "payoutId" TEXT;

-- Track the date range that a date-range payout swept up.
ALTER TABLE "Payout" ADD COLUMN "periodStart" TIMESTAMP(3);
ALTER TABLE "Payout" ADD COLUMN "periodEnd" TIMESTAMP(3);

CREATE INDEX "OrderCommission_payoutId_idx" ON "OrderCommission"("payoutId");

ALTER TABLE "OrderCommission" ADD CONSTRAINT "OrderCommission_payoutId_fkey"
    FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
