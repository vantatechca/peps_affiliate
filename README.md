# Affiliate Dashboard

Affiliate tracking and management system. Affiliates log in to see their sales, admins manage everything.

## Stack
- **Backend:** Express + Prisma + PostgreSQL
- **Frontend:** React + Tailwind + Vite
- **Auth:** JWT (email + password)

## Quick Setup

### 1. Database
Make sure PostgreSQL is running. Create a database:
```bash
createdb affiliate_dashboard
```

### 2. Backend
```bash
cd server
cp .env.example .env    # Edit DATABASE_URL and JWT_SECRET
npm install
npx prisma db push      # Create tables
npm run db:seed          # Seed test data
npm run dev              # Starts on :3001
```

### 3. Frontend
```bash
cd client
npm install
npm run dev              # Starts on :5173, proxies /api to :3001
```

### 4. Open
Go to `http://localhost:5173`

**Test Credentials:**
- Admin: `admin@affiliates.com` / `admin123`
- Affiliate: `influencer@test.com` / `test123`

## Webhook Endpoint

Your checkout stores (Shopify + WordPress) should POST to:

```
POST /api/webhooks/order-paid
Content-Type: application/json

{
  "customer_first_name": "John",
  "items_summary": "BPC-157 x2, TB-500 x1",
  "order_total": 189.00,
  "discount_code": "INFLUENCER10",
  "source": "shopify",
  "external_order_id": "ORD-12345"
}
```

**Commission Logic:**
1. Looks up discount code
2. Checks if code is active AND not expired AND affiliate is active
3. If all pass → attributes order and calculates commission
4. Commission rate priority: code-level override → affiliate default → 20% fallback
5. If any check fails → order is logged but NOT attributed (no commission)

## Features

### Affiliate Dashboard
- Stats cards: today / this month / all time earnings
- Orders list with period filter (today, week, month, all)
- Discount codes list with status (active, expired, inactive)
- Payout history

### Admin Panel
- Overview stats
- CRUD affiliates (name, email, password, commission %)
- CRUD discount codes (code, affiliate, discount %, commission override, label, expiry date)
- All orders view with pagination
- Payout management (create, mark as paid)

## Deployment Notes
- Set `JWT_SECRET` to something random in production
- Set `CLIENT_URL` to your frontend domain for CORS
- Build frontend: `cd client && npm run build` → serve `dist/` folder
- Build backend: `cd server && npm run build` → run `node dist/index.js`
