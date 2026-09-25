# Returns and refunds

Owners and workers open Sales → Return / edit items. Choose the item, enter the quantity the customer keeps, optionally correct its pre-tax unit price, choose whether removed items are resalable and should return to stock, enter a reason, and record the refund method. Review the displayed amount to give back before saving. This records a refund already paid outside the app; it does not move money through a processor. Additional items or exchanges use a separate Checkout sale.

Each submission adjusts one line. Returns cannot exceed the quantity still sold. Prices can be corrected up or down; upward corrections create an outstanding balance. Pay-later adjustments reduce debt before refunding overpayment. Services cannot be restocked; deleted products cannot be restocked. Older sales without normalized line snapshots are rejected explicitly instead of inventing historical cost data.

Revenue, tax, quantity, and profit reports reflect revised amounts on the original sale date. Collection totals subtract refunds on their recording date. Damaged/non-restocked items retain their cost as a loss. Original payments are retained. Owners and workers see adjustment history in Sales; revised receipts are marked. The protected sale_adjustments table preserves complete before/after sale and line snapshots, actor, time, reason, restock quantity, and refund method/amount. Adjustment history cannot be edited through the app API. Adjusted sales cannot use Void; return the remaining quantities instead.

## Rollout

Apply `supabase/migrations/20260912000000_sale_adjustments.sql` followed by `supabase/migrations/20260912010000_worker_sale_adjustments.sql` to the intended Supabase database before publishing the updated frontend. The new frontend requires the new tables and RPC. Both migrations were applied to the linked production Supabase database on September 12, 2026. The frontend was published to https://prince-inventory-manager.vercel.app (Vercel deployment dpl_59BM1jcquuEa62qceTdvKeBgya5q). The remote database reports no pending migrations, the live JavaScript includes the return form and worker history integration, and the sign-in page loads after the PWA update. A real refund was not submitted against production customer records during verification.

## Verification

- `npm test`: calculation and existing application tests.
- `npm run test:returns`: executes the migration and functions in an isolated embedded PostgreSQL database with representative existing tables and stubbed authentication. Checks partial/full returns, duplicate submission, stale version, void protection, unpaid/part-paid credit, damaged stock cost, price correction, worker access and non-member rejection. Does not replace testing Supabase authentication/RLS and realtime updates in staging.
- `npm run build` and `npm run lint`.

In staging, use separate owner and worker sessions to check permissions, verify receipts and credit statements, test simultaneous adjustments to one sale, and confirm the cash drawer against recorded refunds. Writes are atomic and guarded by a sale lock, revision number, and unique request ID.

Workers can access all shop sales to handle returns, including sales recorded by other staff. Full cost/profit audit snapshots remain owner-only; the shared history exposes only operational amounts.

## Owner sales reset

Sales → Reset sales totals supports a month, year, custom inclusive Ghana calendar dates, or all sales. The owner reviews the count and total, enters a reason, and types RESET. The reset moves matching sales and their payment/refund entries out of active dashboards/reports, preserving all original records. Reset history sales remain accessible for receipts and returns. Customer balances and statements continue to include archived sales, so debts are not forgiven. Inventory is never changed. Restore these sales reverses the reset. Workers can handle returns from Sales but cannot reset/restore periods, enforced in both the interface and database. Other devices with unsynced offline sales must sync those separately; later arrivals are not silently included in an earlier reset.

Migration: `20260912020000_sales_period_reset.sql`. Database regression checks cover permission denial, period selection, stale preview rejection, repeat submission, restore, and stock/debt preservation.

Sales reset migration applied and frontend published September 12, 2026, deployment dpl_8oEkiQhhzb373VUTpvZeJd9sTDSP. Live assets verified. No real shop sales were reset during implementation.

## Void receipts

Owners use Sales → Void sale, enter a reason and refund method, review the amount, and confirm the refund already made. Sales → Voided → Void receipt / original opens the printable void document; View original receipt opens the archived sale copy with a void warning. Printing never records another refund.

Apply `20260924000000_void_receipts.sql` after the earlier migrations, before deploying this frontend. It replaces the old single-argument void RPC with a reason/method/expected-paid API and makes the old stock/payment reversal private. A unique, read-only void record captures the pre-void sale, refund amount, actor name and ID, reason and timestamp atomically with the existing reversal. Repeated calls cannot restock twice. Stale payment amounts are rejected. Adjusted sales still use the return workflow. Original payments remain stored with reversal markers; no extra negative payment is inserted (which would double-count the reversal).

Voids predating this migration display unavailable audit/refund information explicitly; no historical amounts are invented. The sample receipt uses fictional data. This change was verified locally with component tests, embedded PostgreSQL workflow checks, build and lint; the migration has not been applied to the live database.

## Test job and date-based receipt history

Sales → Test job is owner-only and renders the same ReceiptModal used by actual sales. Choose paid, part-paid, or void samples and Print to inspect the current receipt design. Test receipts carry a printed TEST ONLY banner. Samples exist only in component memory; no checkout, payment, stock, or database write is called.

Sales opens on today's Ghana shop date. Select a calendar day to view its receipts and net sale total (excluding voids), navigate months or use the month picker, and use Today to return. All receipts includes reset history by default; the filter can narrow to active or reset history. Historical sales are fetched in pages so old receipts are not hidden by the default server row limit. Before the void migration is installed, the reader falls back to ordinary sales on the specific missing relationship error; other errors remain visible.
