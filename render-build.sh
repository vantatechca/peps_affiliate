#!/usr/bin/env bash
set -e

echo "=== Building client ==="
cd client
npm install
npm run build
cd ..

echo "=== Building server ==="
cd server
npm install
npx prisma generate
npx prisma db push
npm run build
