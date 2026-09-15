# Prince Auto — product & design notes

> Internal planning doc. **Do not push to GitHub until Rich says so.**

---

## Git / GitHub policy

- **No automatic pushes** to GitHub from the AI assistant.
- **No commits** made on Rich’s behalf for routine work — keeps his [GitHub contribution graph](https://github.com/richardeyeboah) clean (only his commits show up).
- When ready to save: Rich runs `git add`, `git commit`, and `git push` himself, **or** explicitly asks the assistant to commit with a message he approves.
- Code lives locally + Vercel deploy until he chooses to push.

---

## Vision: Zoho-grade, shop-grade

Reference: **Zoho Inventory** (desktop dashboard + mobile app in one product).

We are **not** cloning Zoho. We are matching its **professional feel** while keeping Prince Auto focused on:

> Track parts → worker rings up job → payment type → stock updates for everyone.

### What Zoho does well (steal the *pattern*, not the warehouse features)

| Zoho pattern | Prince Auto equivalent |
|--------------|------------------------|
| Dark left sidebar + light content | Same shell on desktop/tablet |
| **Home dashboard** with KPI cards | Today’s revenue, jobs closed, parts low, pending sync |
| Color-coded status chips (pack / ship / deliver) | Checkout queue, low stock, voided jobs, offline pending |
| Inventory summary block | Parts on hand, labor items, low-stock count |
| Product details + donut chart | Active parts vs low vs out |
| Top selling items | Top parts & labor this week |
| Sales activity table | Jobs by payment type (cash / card / transfer) |
| Global search in header | Search parts, jobs, customers |
| User org + notifications + settings top-right | Shop name, worker name, role, sign out |
| Mobile: red header + bottom nav | Same 4–5 tabs, full-width cards, thumb-friendly |
| Clean cards, white panels, subtle shadows | Enterprise SaaS look — not “side project” |

### What we skip from Zoho

- Multi-warehouse, purchase orders, shipping carriers, Amazon/eBay
- Invoicing/accounting (unless Phase 3+)
- Vendor portals, serial/batch tracking at launch

---

## Current app vs target

### Have now (Phase 1 — backend & flow)

- Supabase auth (owner / worker)
- Shared stock, checkout, void, receipt
- Customer + vehicle on ticket
- PWA (Add to Home Screen)
- Offline sale queue
- Mobile tab bar (basic)

### Missing for “Zoho-level” UI (Phase 2 — design system)

1. **App shell**
   - Desktop: fixed dark sidebar (Home, Checkout, Parts, Jobs, Reports)
   - Top bar: search, shop name, user menu
   - Mobile: branded header + bottom nav (like reference image)

2. **Home dashboard** (new default screen)
   - Row 1: KPI cards — Revenue today | Jobs today | Parts low | Offline pending
   - Row 2: Inventory summary + low-stock list
   - Row 3: Top parts sold (7 days) + payment breakdown
   - Row 4: Recent jobs list

3. **Visual system**
   - Neutral gray page background (`#f5f6f8`)
   - White cards, 8px radius, light border
   - Sidebar `#1e2a3a`, accent **Prince teal** (keep brand, not Zoho red)
   - Status colors: info blue, warn orange, danger red, success green
   - Dense but readable tables on desktop

4. **Checkout UX**
   - Split view on desktop (catalog left, ticket right) — already close
   - Mobile: full-screen steps or sticky ticket footer
   - Bigger tap targets, clearer payment pills

5. **Parts screen**
   - Table view on desktop (sortable columns)
   - Card list on mobile
   - Low-stock row highlight (red text like Zoho)

6. **Jobs screen**
   - Filter: Today / Week / Voided
   - Expand row for line items + receipt reprint

7. **Reports** (light v1)
   - Daily totals by payment type
   - Worker sales summary
   - Export CSV (owner only)

### Phase 3 — mobile / iOS

- PWA polish (icons, splash, install prompt)
- Capacitor wrapper for App Store when ready
- Optional: barcode scan via camera

---

## Build status (updated Aug 26, 2026)

```
DONE  Design tokens + app shell (dark sidebar desktop, header + bottom nav mobile)
DONE  DashboardView — KPI cards, 7-day revenue chart, payments split,
      inventory value/summary, restock list, top sellers, recent jobs
DONE  ReportsView — Today/7d/30d/All, by payment, by worker, top items,
      CSV export (owner only)
DONE  Restyled Checkout, Parts, Jobs, Login, Receipt to the new system
DONE  Inter font, professional SaaS palette (navy sidebar + teal accent)
TODO  Global search in topbar
TODO  Barcode scan (Phase 2)
TODO  PWA custom icons + Capacitor wrap for App Store
```

---

## Brand direction (Prince Auto, not Zoho)

- Keep **Prince Auto** name and teal accent — professional, not a Zoho clone
- Typography: keep Figtree + Bricolage or switch to single professional stack (e.g. Inter) for tighter SaaS look
- Logo mark in sidebar + app icon for home screen

---

## Live URLs (no GitHub yet)

- **App:** https://prince-inventory-manager.vercel.app
- **Repo (local only until push):** `richardeyeboah/prince-inventory-manager`

---

## Supabase reminder

Run `supabase/migrations/20250826000000_phase1_auth.sql` if login/roles are not working yet.

---

*Last updated: Aug 26, 2026 — Rich requested Zoho-style professional UI; no GitHub push.*
