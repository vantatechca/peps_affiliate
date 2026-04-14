#!/usr/bin/env bash
set -e

echo "=== Building client ==="
cd client
npm install --include=dev
chmod -R +x node_modules/.bin
npx tsc
npx vite build
cd ..

echo "=== Building server ==="
cd server
npm install --include=dev
chmod -R +x node_modules/.bin
npx prisma generate
npx prisma db push
# Commission-splits feature: idempotent backfill of OrderCommission ledger.
# Safe to run on every deploy — it only touches attributed orders that have
# no ledger row yet (empty on second run and beyond).
npx tsx src/backfill-commissions.ts
npx tsc
