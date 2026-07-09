# Studio Cafe — Management System

A real, database-backed cafe POS system: cashier/tables, warehouse stock, a weekly
stock-count tracker, employee consumption logging, reports, and settings — replacing
the original single-file HTML prototype (`StudioCafe_System_v4.html`). Also includes
a second, fully independent app for booking the venue's study tables/rooms by the
hour (see "Study booking system" below).

## Stack

- **Backend**: Node.js + Express + TypeScript + Prisma + PostgreSQL (`backend/`)
- **Frontend**: React + TypeScript + Vite + Tailwind CSS (`frontend/`)
- Per-user username+password accounts, JWT session token — two entirely separate
  auth realms (Cafe at `/`, Study at `/study`); a Study account cannot log into the
  Cafe app and vice versa
- PDF receipts generated server-side (`pdfkit`); Excel exports client-side (`xlsx`)

## Project layout

```
Cafe/
  backend/    Express API + Prisma schema/migrations/seed
  frontend/   React SPA
  package.json   npm workspaces root (build/start orchestration)
```

In production, the backend serves the built frontend (`frontend/dist`) as static
files and exposes the API under `/api/*` — one process, one deploy.

## Local setup

Prerequisites: Node.js 20+, a running PostgreSQL instance.

1. Create a database and role (adjust to your Postgres setup):
   ```sql
   CREATE ROLE cafe WITH LOGIN PASSWORD 'cafe';
   CREATE DATABASE cafe OWNER cafe;
   ```
2. Copy `backend/.env.example` to `backend/.env` and adjust `DATABASE_URL` /
   `JWT_SECRET` if needed.
3. Install dependencies from the repo root (installs both workspaces):
   ```
   npm install
   ```
4. Run migrations and seed the initial menu/stock/employees/tables/study resources:
   ```
   npm run db:migrate
   npm run db:seed
   ```
   The seed script creates one `admin` account per system (Cafe and Study) with the
   bootstrap password **`StudioCafe#2026Setup`** if no accounts exist yet — change it
   immediately from Settings → Security after first login on each system, and add
   named accounts for staff from Settings → Team access.
5. Run both dev servers (in two terminals):
   ```
   npm run dev:backend    # http://localhost:4000
   npm run dev:frontend   # http://localhost:5173 (proxies /api to :4000)
   ```
   Open http://localhost:5173 for the Cafe app, http://localhost:5173/study for the
   Study booking app.

## Production build

```
npm run build   # builds frontend, then backend (tsc)
npm start       # NODE_ENV=production node backend/dist/index.js, serves everything on one port
```

Set `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, and `PORT` in the
environment before running `npm start`. Run `npm run db:deploy` (applies
migrations non-interactively via `prisma migrate deploy`) against the
production database before first boot.

## Deploying for free (Render + Neon)

This is the recommended free path — $0/month, no credit card required. The
tradeoff: Render's free web services "sleep" after ~15 minutes with no
traffic, so the first request after a quiet period takes 30-60 seconds to
wake up. Fine for a cafe that isn't taking orders 24/7; if that wake delay
ever becomes a problem, the same `render.yaml` works unchanged on Render's
$7/month "Starter" plan (no more sleeping), or see the Railway alternative
below.

**1. Create the free database (Neon)**
1. Sign up at [neon.tech](https://neon.tech) (free, no card) and create a project.
2. Open the project's **Connection Details** and copy the connection string
   (it already includes `?sslmode=require`, which Prisma needs). Keep this
   handy for step 2 below.

**2. Push this repo to GitHub**
This repo is already a local git repository with everything committed. Create
an empty repository on [github.com/new](https://github.com/new) (don't
initialize it with a README), then:
```
git remote add origin <your-new-repo-url>
git push -u origin main
```

**3. Deploy on Render**
1. Sign up at [render.com](https://render.com) (free, no card) and connect
   your GitHub account.
2. New → **Blueprint**, pick this repo. Render will read `render.yaml` at the
   repo root and pre-fill the service (build command, start command, health
   check, and a freshly generated `JWT_SECRET`) — you only need to fill in
   one thing:
   - `DATABASE_URL` → paste the Neon connection string from step 1.
3. Click **Apply**. Render will run `npm install --include=dev && npm run build`,
   then start the service with `npm run db:deploy && npm run db:seed && npm start` —
   this applies all migrations and seeds the initial menu/stock/employees/tables
   automatically on first boot (both steps are safe to re-run on every restart,
   they skip anything already applied/present).
4. Once the deploy finishes, open the Render-assigned URL. Log in to the Cafe
   app (`/`) and the Study app (`/study`) separately with username **`admin`** /
   password **`StudioCafe#2026Setup`**, and change the password immediately from
   Settings → Security on each — then add named accounts per staff member from
   Settings → Team access.

No CORS configuration is needed — the same Render service serves both the
built frontend and the `/api/*` backend from one origin.

## Deploying to Railway (paid, ~$5/month, no sleep)

1. Create a new Railway project, add a **PostgreSQL** plugin — copy its
   `DATABASE_URL` (Railway calls it `DATABASE_URL` too, connect the service to
   it via a shared variable).
2. Add a service from this repo. Because it's an npm-workspaces monorepo,
   set:
   - **Build command**: `npm install --include=dev && npm run build`
   - **Start command**: `npm run db:deploy && npm run db:seed && npm start`
   - Railway's Nixpacks builder auto-detects Node from `package.json`; no
     Dockerfile is required.
3. Environment variables on the Railway service:
   - `NODE_ENV=production`
   - `DATABASE_URL` (reference the Postgres plugin's variable)
   - `JWT_SECRET` (generate a long random string — do **not** reuse the dev value)
   - `PORT` (Railway sets this automatically; the app reads `process.env.PORT`)
4. Visit the Railway-assigned URL — the same origin serves both the app and
   the API, so no CORS configuration is needed in production.

## Notable features

- **Multiple, independently-toggleable taxes** with compound support — a
  "compound" tax (e.g. a municipal surcharge) is calculated on top of the
  previously-applied tax's amount instead of the bill itself ("tax on tax").
  Managed in Settings → Tax rates; toggled per-order as chips in the Cashier
  screen. See `recomputeTotals` in `backend/src/services/orders.service.ts`
  for the exact algorithm.
- **Recipe-based stock auto-deduction** — each menu item can have a recipe
  (Settings → Menu → "Recipe" button: which stock items + how much per unit
  sold). Adding an item to an order deducts its recipe from stock immediately;
  reducing quantity, removing a line, or clearing/cancelling an order restores
  it. Items with no recipe simply don't affect stock. Stock is allowed to go
  negative rather than blocking a sale — that's surfaced as a low-stock
  warning instead.
- **Weekly stock tracker reconciliation** — saving a physical count doesn't
  just record the discrepancy, it corrects the system stock quantity to match
  what was actually counted (with a full audit trail via `StockAdjustment`).
- **Reports** support quick date presets (Today/Yesterday/This week/This
  month/Custom range) and a Daily/Weekly/Monthly trend grouping toggle,
  alongside average order value, tax collected, and payment-method split.
  Every report (Sales, Stock, Employees, and the Tracker history) can be
  downloaded as **both Excel and PDF** — Excel via client-side SheetJS, PDF
  generated server-side with `pdfkit` (`backend/src/lib/reportPdf.ts`, a
  reusable multi-page table renderer with automatic page breaks). Exports
  always cover the full matching result set for the selected date range, not
  just whatever page is currently visible on screen.
- **Per-user accounts, two independent systems** — Cafe and Study each have their
  own `User` accounts (username + bcrypt password hash), managed from each app's
  own Settings → Team access. Deleting the last active account for a system is
  blocked so you can never lock yourself out (`backend/src/services/users.service.ts`).
  A Study account has no access to the Cafe app's data or vice versa; they share
  only the underlying database.
- **Study booking system** (`/study`) — 9 tables + 2 rooms, booked hourly. A base
  booking is 1 hour; adding a drink from the booking card extends it to 1.5 hours
  and opens a real Cafe order for that drink (reusing the exact same order/payment
  pipeline as the Cashier screen — `CafeTable.kind` distinguishes dining tables from
  study resources, see `backend/src/services/study.service.ts`). Checkout settles
  both the room fee and any linked drink order together; Cancel and Delete are also
  available (Cancel keeps the record for History, Delete removes it entirely).
  Configurable hourly rate/currency at Settings → Pricing.
- **Legacy sales import** (Cafe Settings → Import legacy sales, always available) —
  upload a `.xls`/`.xlsx` daily cash-register export from a prior system and each
  transaction row becomes a real, dated, PAID `Order` (one placeholder line item,
  marked CASH), matched to the table number from the sheet. Safe to re-run on the
  same file any time — already-imported rows are skipped via a unique `importRef`
  (`backend/src/services/import.service.ts`, `backend/src/lib/ledgerImport.ts`).
- Real-time multi-device sync is done via short polling (~8s) on the
  Tables/POS screens rather than WebSockets — simpler for v1; swap in
  Socket.IO later if multiple simultaneous devices need instant push updates.
- **Bilingual menu and warehouse names** — every `MenuItem` and `StockItem` has
  an optional `nameAr` alongside its English name, both editable from Settings →
  Menu (bulk "Save all changes") and the Warehouse stock list (inline, saves on
  blur). Shown wherever the item appears (POS menu grid, Warehouse list,
  Tracker, Employees item picker) with `dir="rtl" lang="ar"`. The Employees
  "Item" field and the POS menu search box match against either language.
- **Cash change tracking** — every CASH payment stores `cashReceived` and
  `changeGiven` on the order (e.g. a 10,000 bill paid with 15,000 leaves 5,000
  change). Reports surfaces a "Change given" total for the selected date range
  (Payment split card) and a per-order "Change given" column in Sales history —
  cash that left the register on overpayment is tracked separately from actual
  revenue, both on-screen and in the Sales PDF export.
- **Employees consumption item picker** is a searchable combobox
  (`frontend/src/components/SearchableSelect.tsx`) sourced from the live menu,
  not free text — selecting an item auto-fills the price field from the
  menu's current price, but the price stays a normal editable input so a
  cashier can still log a custom/discounted amount.
- **Warehouse ↔ Tracker stay in sync** — every stock-mutating action
  (restock, manual +/-/set, delete, editing a name) invalidates both the
  `stock` and `tracker` React Query caches, so the weekly tracker always
  reflects the latest warehouse state without a manual refresh.
- **Tables can be added/removed from Settings**, not just seeded — removing a
  table with an open order is blocked (guarded in
  `backend/src/services/tables.service.ts`).
- The POS order panel is bounded to the viewport (`xl:sticky xl:top-8
  xl:max-h-[calc(100vh-2rem)]`) and scrolls as a single region — items,
  discount, tax, total, and the Cash/Card buttons all included — so a long
  order never gets clipped below the fold on a small laptop screen; you
  scroll the card itself, not the page (`frontend/src/pages/PosPage.tsx`).
- **Manageable units and stock categories** — Settings → Units / Stock
  categories let you add or remove the values offered in the Warehouse
  "Add item" dropdowns. These are plain lookup lists (`StockUnit`/
  `StockCategory` — no foreign key from `StockItem`), so removing one never
  touches existing stock rows, it only changes what's offered going forward.
- **Manageable menu categories** — Settings → Menu categories lets you add or
  remove the categories menu items are grouped into; every category (even an
  empty new one) immediately shows up as a filter chip on the Cashier screen.
  Deleting a category is guarded by a confirm modal since it cascades to
  delete every menu item inside it.

## Known dependency advisory

`npm audit` flags a high-severity advisory (prototype pollution / ReDoS) in the
`xlsx` (SheetJS) package used for client-side Excel exports. The npm-registry
build (0.18.5) is the last one SheetJS published there; their actual fixed
releases are distributed from `cdn.sheetjs.com` instead, not through `npm audit`'s
advisory database. In this app the library is **only ever used to write** files
(`XLSX.utils.aoa_to_sheet` + `XLSX.writeFile` in `frontend/src/lib/excel.ts`) —
it never parses user-supplied spreadsheets, which is where both advisories
apply, so the practical exploitability here is effectively nil. To fully clear
the finding, install SheetJS's patched build directly from their CDN:
`npm install https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz --workspace frontend`
(this pulls a tarball from outside the npm registry, so run it yourself rather
than having an agent do it unattended).
