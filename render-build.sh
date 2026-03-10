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
npx tsc