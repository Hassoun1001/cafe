# Studio Cafe — Management System

A real, database-backed cafe POS system: cashier/tables, warehouse stock, a weekly
stock-count tracker, employee consumption logging, reports, and settings — replacing
the original single-file HTML prototype (`StudioCafe_System_v4.html`).

## Stack

- **Backend**: Node.js + Express + TypeScript + Prisma + PostgreSQL (`backend/`)
- **Frontend**: React + TypeScript + Vite + Tailwind CSS (`frontend/`)
- Single shared login (matches the original design), JWT session token
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
4. Run migrations and seed the initial menu/stock/employees/tables:
   ```
   npm run db:migrate
   npm run db:seed
   ```
   The seed script creates the default password **`01090703`** (change it from
   Settings → Security after first login).
5. Run both dev servers (in two terminals):
   ```
   npm run dev:backend    # http://localhost:4000
   npm run dev:frontend   # http://localhost:5173 (proxies /api to :4000)
   ```
   Open http://localhost:5173.

## Production build

```
npm run build   # builds frontend, then backend (tsc)
npm start       # NODE_ENV=production node backend/dist/index.js, serves everything on one port
```

Set `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, and `PORT` in the
environment before running `npm start`. Run `npm run db:deploy` (applies
migrations non-interactively via `prisma migrate deploy`) against the
production database before first boot.

## Deploying to Railway

1. Create a new Railway project, add a **PostgreSQL** plugin — copy its
   `DATABASE_URL` (Railway calls it `DATABASE_URL` too, connect the service to
   it via a shared variable).
2. Add a service from this repo. Because it's an npm-workspaces monorepo,
   set:
   - **Build command**: `npm install && npm run build`
   - **Start command**: `npm start`
   - Railway's Nixpacks builder auto-detects Node from `package.json`; no
     Dockerfile is required.
3. Environment variables on the Railway service:
   - `NODE_ENV=production`
   - `DATABASE_URL` (reference the Postgres plugin's variable)
   - `JWT_SECRET` (generate a long random string — do **not** reuse the dev value)
   - `PORT` (Railway sets this automatically; the app reads `process.env.PORT`)
4. After the first deploy, run once (Railway shell or a one-off deploy hook):
   ```
   npm run db:deploy
   npm run db:seed
   ```
   (or wire these into a Railway "release" command).
5. Visit the Railway-assigned URL — the same origin serves both the app and
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
- **Single shared login** — there are no per-user accounts/roles; anyone with
  the password has full access, matching the original prototype's design.
- Real-time multi-device sync is done via short polling (~8s) on the
  Tables/POS screens rather than WebSockets — simpler for v1; swap in
  Socket.IO later if multiple simultaneous devices need instant push updates.
- **Bilingual menu and warehouse names** — every `MenuItem` and `StockItem` has
  an optional `nameAr` alongside its English name, editable from Settings →
  Menu and the Warehouse stock list. Shown wherever the item appears (POS menu
  grid, Warehouse list, Tracker, Employees item picker) with `dir="rtl"
  lang="ar"`. The Employees "Item" field and the POS menu search box match
  against either language.
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
