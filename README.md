# ConstructHub

Multi-site construction finance management for Indian construction companies.

Manage employee cash wallets, vendor purchases, material transfers, site-level
P&L, and per-site income tracking — all backed by audit trails and immutable
financial records.

---

## Features

- **Employee wallets** — top up employees with cash, track every rupee they
  carry. Derived balances, never stored separately.
- **Expense logging** — employees log expenses by site and category
  (Materials / Labor / Transport / Food / Misc / Other) with optional bill
  photo upload.
- **Peer transfers** — transfer cash between employees. Both sides voided
  atomically when reversed.
- **Vendor purchases** — log purchases against vendors with GST, discount,
  rate. Paid by employee wallet or owner-direct.
- **Material transfers** — move materials between sites with proportional cost
  accounting.
- **Site income** — record advances, running bills, final payments, and
  retention amounts per site.
- **Site P&L** — real-time: received − spent = P&L, budget used %.
- **Voiding** — no hard deletes. Every void creates an auditable reversing
  entry. Voided rows shown with strikethrough in all lists.
- **Reconcile modal** — step-by-step breakdown of credits and debits so
  supervisors can verify the balance calculation.
- **CSV exports** — per-site, per-employee, and company-wide reports.
- **Budget alerts** — dashboard warns when a site reaches 80% or 100%+ of
  its contract value.
- **Onboarding checklist** — first-time owner sees a guided card: add site →
  add employee → top up wallet.
- **PWA** — installable on Android and iOS home screen. Offline banner when
  network is lost.
- **Demo seed** — one command generates a complete realistic dataset.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript strict) |
| Styling | Tailwind CSS + shadcn/ui (new-york, neutral) |
| Package manager | pnpm |
| ORM | Prisma 6 with driver adapters |
| Database | Neon PostgreSQL (serverless) |
| File storage | Cloudinary (bill photos) |
| Auth | Custom: bcryptjs passwords + iron-session cookies |
| Money math | decimal.js (all amounts stored as BigInt paise) |
| Validation | Zod |
| Tests | Vitest (165 tests) |

---

## Architecture Overview

ConstructHub follows a strict set of rules applied throughout the codebase:

1. **Paise only** — All monetary amounts are stored as `BigInt` in paise
   (1 INR = 100 paise). Never `number` or `float` for money. Use `decimal.js`
   for arithmetic, convert to `BigInt` for storage.

2. **Derived wallet balances** — Wallet balances are never stored.
   Always derived by summing `wallet_transactions` (credits − debits,
   excluding voided rows). Use `getWalletBalance()` from `lib/wallet.ts`.

3. **Transactions for multi-writes** — Every operation that writes to
   multiple tables is wrapped in `db.$transaction(...)`.

4. **No hard deletes on financial records** — Use `voidedAt + voidedById`.
   Voiding creates a reversing entry where appropriate.

5. **Actor vs Logger** — Every transaction has both `actorUserId`
   (whose wallet moves) and `loggedById` (who entered the record).

6. **Single Prisma singleton** — All Prisma access goes through `lib/db.ts`.

7. **Hashed passwords** — bcryptjs, 10 rounds. Never logged or stored plain.

8. **Cookie sessions** — iron-session, `httpOnly`, `secure`, signed cookies.

The data model has six financial tables:
`WalletTransaction → Purchase → MaterialTransfer → SiteIncome`
all referencing `User`, `Site`, and `Vendor`. Every table has `voidedAt`,
`voidedById`, and `loggedById` for a complete audit trail.

---

## Prerequisites

- **Node.js 20+** (`node --version`)
- **pnpm** (`npm install -g pnpm`)
- **Neon account** — [neon.tech](https://neon.tech) (free tier works)
- **Cloudinary account** — [cloudinary.com](https://cloudinary.com) (free tier works)

---

## Setup from Scratch

### 1. Clone and install

```bash
git clone <your-repo-url>
cd constructhub
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Neon dashboard → Connection Details → Direct connection |
| `SESSION_SECRET` | `openssl rand -base64 32` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary → Settings → Account |
| `CLOUDINARY_API_KEY` | Cloudinary → Settings → Access Keys |
| `CLOUDINARY_API_SECRET` | Cloudinary → Settings → Access Keys |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Same as `CLOUDINARY_CLOUD_NAME` |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | `constructhub_bills` (see below) |

### 3. Cloudinary upload preset

1. Cloudinary Dashboard → Settings → Upload → Upload presets → Add preset
2. Preset name: `constructhub_bills`
3. Signing mode: `Signed`
4. Folder: `bill-photos`
5. Allowed formats: `jpg, jpeg, png, webp, heic`
6. Max file size: `5 MB`
7. Save

### 4. Run database migrations

```bash
pnpm prisma migrate dev --name init
```

### 5. Create the owner account

```bash
pnpm seed:owner
```

Interactive prompt for username, name, password. Only one OWNER per database.

### 6. (Optional) Load demo data

```bash
pnpm seed:demo
```

Clears all data and loads a full demo dataset with 4 employees, 3 sites,
2 vendors, and 30+ realistic transactions. Credentials: `demo_owner / demo1234`.

### 7. Generate PWA icons (placeholder)

```bash
pnpm tsx scripts/generate-icons.ts
```

Replace `public/icons/*.png` with branded icons before launch.

### 8. Start development server

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## Development Workflow

```bash
pnpm dev          # Start dev server (hot reload)
pnpm build        # Production build
pnpm test         # Run all Vitest tests in watch mode
pnpm test:ui      # Open Vitest UI in browser
pnpm lint         # ESLint
pnpm prisma studio  # Browse database in GUI
```

When adding financial operations:
1. Always go through `lib/db.ts` (the singleton)
2. Wrap multi-table writes in `db.$transaction`
3. Use `toPaise()` for input conversion, `formatINR()` for display
4. Add `voidedAt` / `voidedById` to any new financial table
5. Add `loggedById` (who entered) and `actorUserId` (whose account moves)
6. Exclude voided rows from all aggregations: `where: { voidedAt: null }`

---

## Deploying to Vercel

1. Push repository to GitHub
2. Vercel → New Project → Import repo
3. Add all environment variables from `.env` in Vercel dashboard
4. Deploy — Vercel auto-detects Next.js

> **Important**: For Neon on Vercel, use the **pooler connection string** for
> `DATABASE_URL` in production. Use the direct connection only for migrations.

After first deploy:
```bash
pnpm prisma migrate deploy   # Apply migrations to production DB
```

---

## 20-Step Manual Test

End-to-end verification of the full financial loop.

### Step 1 — Seed the owner account

```bash
pnpm run seed:owner
```

Note the username/password. You'll use these to sign in.

### Step 2 — Sign in as owner

Navigate to `/login`. Use the credentials from Step 1. Land on the dashboard.
Verify the onboarding checklist card appears.

### Step 3 — Create Site A

**Sites → Create Site**:

| Field | Value |
|---|---|
| Name | Test Project A |
| Location | Mumbai |
| Client | ACME Corp |
| Contract Value | ₹15,00,000 |

Onboarding checklist: "Add your first site" checks off. ✓

### Step 4 — Create Site B

| Field | Value |
|---|---|
| Name | Test Project B |
| Location | Pune |
| Client | Beta Ltd |
| Contract Value | ₹10,00,000 |

### Step 5 — Add employees

**Employees → Add Employee** — create three:
- Ramesh (username: `ramesh`)
- Suresh (username: `suresh`)
- Mahesh (username: `mahesh`)

Onboarding checklist: "Add your first employee" checks off. ✓

### Step 6 — Top up Ramesh and Suresh

- Ramesh: Top up ₹20,000
- Suresh: Top up ₹15,000

Onboarding checklist: all checked. Dismiss the card.

Verify: Ramesh balance = ₹20,000, Suresh balance = ₹15,000.

### Step 7 — Log expense as Ramesh

Go to `/expense/new`:
- Amount: ₹3,000 · Site: Test Project A · Category: Materials · Note: Sand bags

Submit. Ramesh balance → ₹17,000. Site A Transactions tab shows `EXPENSE −₹3,000`.

### Step 8 — Attempt on-behalf expense for Mahesh (should fail)

Go to `/expense/new`:
- Amount: ₹2,500 · Site: Test Project A · On behalf of: Mahesh

Submit → **Insufficient wallet balance** (Mahesh has ₹0). ✓

### Step 9 — Top up Mahesh then retry

Top up Mahesh ₹10,000. Retry Step 8.

Mahesh balance → ₹10,000 − ₹2,500 = ₹7,500. Site A shows the transport expense. ✓

### Step 10 — Transfer money Ramesh → Suresh

`/transfer/new` → Ramesh → Suresh → ₹5,000.

Verify: Ramesh = ₹12,000, Suresh = ₹20,000.

### Step 11 — Add a vendor

**Vendors → Add Vendor**:
- Name: Shree Cement · GSTIN: `27AABCA1234C1Z5`

### Step 12 — Log purchase paid by Ramesh's wallet

`/purchases/new`:
- Vendor: Shree Cement · Item: Cement 50kg · Qty: 50 · Unit: bags
- Rate: ₹380 · Discount: 5% · GST: 18%
- Destination: Test Project A · Paid by: Ramesh

Expected total ≈ ₹21,299. Ramesh has ₹12,000 → **fail** (insufficient). Top up Ramesh ₹15,000 → retry.

Ramesh: ₹27,000 − ₹21,299 ≈ ₹5,701. Site A Material tab shows 50 bags cement.

### Step 13 — Log owner-direct purchase for Site B

`/purchases/new`:
- Item: Steel Rods · Qty: 10 · Unit: nos · Rate: ₹800 · GST: 18%
- Destination: Test Project B · **Paid by: Owner Direct**

Total = ₹9,440. Site B Spent increases by ₹9,440, no wallet movement. ✓

### Step 14 — Transfer 20 bags cement from Site A to Site B

`/material-transfers/new`:
- From: Test Project A · To: Test Project B
- Item: Cement 50kg · Qty: 20 · Unit: bags

Cost moved proportionally: 20/50 × ₹21,299 ≈ ₹8,519.60.

Verify: Site A shows 30 bags remaining; Site B shows 20 bags cement. ✓

### Step 15 — Record income for Site A

**Site A** → Income tab → Add Income:
- Amount: ₹5,00,000 · Type: Advance · Note: First advance from ACME Corp

Site A Received card → ₹5,00,000. ✓

### Step 16 — Verify Site A P&L by hand

| Component | Amount |
|---|---|
| Wallet expense (Materials, Ramesh) | ₹3,000 |
| Wallet expense (Transport, Mahesh) | ₹2,500 |
| Wallet VENDOR_PAYMENT (cement, Ramesh) | ≈ ₹21,299 |
| Material OUT (20 bags → Site B) | −₹8,519.60 |
| **Total Spent** | **≈ ₹18,279** |

P&L = ₹5,00,000 − ₹18,279 ≈ **₹4,81,721** (positive — green) ✓

### Step 17 — Void the steel rods purchase

**Site B** → Material tab → Steel Rods row → **...** → **Void** → Confirm.

Row shows strikethrough + **VOIDED** badge. Site B Spent decreases by ₹9,440. ✓

### Step 18 — Verify Ramesh's reconcile modal

**Employees → Ramesh → Reconcile**.

Verify:
- Total Credits = ₹20,000 + ₹15,000 = ₹35,000
- Total Debits = ₹3,000 (expense) + ₹5,000 (transfer out) + ₹21,299 (vendor payment) = ₹29,299
- Balance = ₹35,000 − ₹29,299 = ₹5,701 ✓

### Step 19 — Export Site A CSV

**Reports** (top nav) → Test Project A → **Download CSV**.

Open the file and verify:
- Headers: `Date,Type,Category,Item,Qty,Unit,Amount (₹),Site,Counterparty,Vendor,Logged By,Note,Voided`
- All rows present: expenses, vendor payment, material transfer out, income
- Amounts in rupees (not paise): e.g. `21299.00`
- Voided rows: `Voided` = `Yes`; live rows = `No`

### Step 20 — Reset Ramesh's password and verify login

**Employees → Ramesh → ... → Reset Password**. Set a new password.

Open an incognito window → `/login` as Ramesh with the new password.

Ramesh sees wallet balance ≈ ₹5,701 and transaction history. ✓

---

## Known Limitations (Intentionally Not in v1)

These are out of scope for the current release and documented as future work:

- **No offline writes** — The PWA shows an offline banner but cannot queue
  actions for later sync. Actions fail when network is unavailable.

- **No GST invoice generation** — Purchases are recorded but the app does not
  generate GST-compliant invoices for clients.

- **No payroll / attendance** — No integration with salary, overtime, or
  attendance tracking.

- **No bank / UPI integration** — Top-ups and payments are recorded manually;
  there is no connection to bank accounts or UPI.

- **No password self-reset** — Employees cannot reset their own password;
  the owner must do it from the Employees page.

- **No multi-company support** — One database = one company. There is no
  concept of organisations or tenants.

- **Transfer pair linking via time window** — TRANSFER_OUT and TRANSFER_IN
  pairs are identified by a 2-second creation time window rather than a
  database foreign key. A `transferGroupId` column is planned for Phase 7.

---

## Future Roadmap

### v1.5 (Q3 2026)
- transferGroupId for reliable pair voiding
- Offline queue for expense logging (background sync)
- Push notifications for low wallet balance
- GST invoice PDF generation

### v2 (Q4 2026)
- Multi-company / tenant support
- Bank/UPI reconciliation import (CSV upload)
- Payroll module (basic)
- Custom expense categories per company
- Public progress report link for clients

---

## License

Private / proprietary. All rights reserved.
