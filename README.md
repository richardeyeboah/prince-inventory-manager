# Prince Auto Inventory & POS

Mobile-first inventory, checkout, and customer-credit system for Prince Auto. The application gives owners and workers a shared view of parts, jobs, payments, and stock on phones and desktops.

- Live app: [prince-inventory-manager.vercel.app](https://prince-inventory-manager.vercel.app)
- Stack: React 19, TypeScript, Vite, Supabase/PostgreSQL, Vitest, Progressive Web App

## What the application does

- Tracks parts, cost, selling price, quantity, and low-stock items
- Creates sales with parts, labor, customer, vehicle, notes, and payment method
- Prints receipts and keeps job history with the responsible worker
- Supports paid, partial-payment, and pay-later sales
- Shows customer balances and payment history
- Calculates sales, tax, cost, and gross profit reports
- Queues sales during a connection loss and syncs them after reconnection
- Lets owners manage worker accounts and void sales; voids restore stock and keep an audit record

## Data integrity and access control

Supabase Auth identifies each user as an owner or worker. PostgreSQL row-level security limits access, while database functions perform sensitive operations.

Sale finalization runs as one database operation: it validates stock, records immutable line-item and cost snapshots, updates inventory, and writes financial records. Client-generated operation IDs make retries idempotent, so an interrupted offline sync cannot create the same sale twice.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add the Supabase project URL and publishable key to `.env.local`.

## Database setup

Apply the SQL files in `supabase/migrations/` in filename order, or link a Supabase project and run:

```bash
npx supabase login
npx supabase link
npm run db:push
```

The first account becomes the owner. Later accounts become workers and can be managed from the Team screen.

## Verification

```bash
npm test
npm run lint
npm run build
```

The test suite covers shop summaries, profit calculations, worker checkout access, offline synchronization, and inventory behavior.

## Install on a phone

On iPhone, open the live app in Safari, tap **Share**, then **Add to Home Screen**. Android browsers provide the equivalent install option. The installed PWA opens full-screen and can queue sales while offline.

An optional Capacitor wrapper is also configured:

```bash
npm run ios:sync
npm run ios:open
```

See [`docs/IPHONE.md`](docs/IPHONE.md) for the full iPhone setup guide.

## Repository layout

- `src/components/` — checkout, inventory, sales, reports, credit, and team screens
- `src/lib/` — calculations, summaries, offline queue, and tests
- `supabase/migrations/` — schema, access policies, and transactional functions
- `docs/` — operating and installation notes

Credentials belong in `.env.local` and the deployment environment. Do not commit customer data or service keys.
