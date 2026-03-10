#!/usr/bin/env bash
set -e

echo "=== Building client ==="
cd client
npm install --include=dev
npm run build
cd ..

echo "=== Building server ==="
cd server
npm install --include=dev
npx prisma generate
npx prisma db push
npm run build
