-- Delete duplicate orders, keeping the earliest one for each externalOrderId
DELETE FROM "Order"
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY "externalOrderId" ORDER BY "createdAt" ASC) AS rn
    FROM "Order"
    WHERE "externalOrderId" IS NOT NULL
  ) dupes
  WHERE rn > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_externalOrderId_key" ON "Order"("externalOrderId");
