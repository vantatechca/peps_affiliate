#!/usr/bin/env bash
set -e

echo "=== Building client ==="
cd client
npm install --include=dev
npx tsc && npx vite build
cd ..

echo "=== Building server ==="
cd server
npm install --include=dev
npx prisma generate
npx prisma db push
npx tsc