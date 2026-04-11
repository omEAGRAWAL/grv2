# ConstructHub

Multi-site construction finance management for Indian construction companies.

Manage employee cash wallets, vendor purchases, material transfers, site-level
P&L, and per-site income tracking — all backed by audit trails and immutable
financial records.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript strict) |
| Styling | Tailwind CSS + shadcn/ui (new-york, neutral) |
| Package manager | pnpm |
| ORM | Prisma with driver adapters |
| Database | Neon PostgreSQL (serverless) |
| File storage | Cloudinary (bill photos) |
| Auth | Custom: bcryptjs passwords + iron-session cookies |
| Money math | decimal.js (all amounts stored as BigInt paise) |
| Validation | Zod |
| Tests | Vitest |

---

## Prerequisites

- **Node.js 20+** (`node --version`)
- **pnpm** (`npm install -g pnpm`)
- **Neon account** — [neon.tech](https://neon.tech) (free tier works)
- **Cloudinary account** — [cloudinary.com](https://cloudinary.com) (free tier works)

---

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env` with your real values:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Neon dashboard → Connection Details → Direct connection |
| `SESSION_SECRET` | Run `openssl rand -base64 32` in your terminal |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary dashboard → Settings → Account |
| `CLOUDINARY_API_KEY` | Cloudinary dashboard → Settings → Access Keys |
| `CLOUDINARY_API_SECRET` | Cloudinary dashboard → Settings → Access Keys |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Same as `CLOUDINARY_CLOUD_NAME` |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | `constructhub_bills` (see below) |

### 3. Run database migrations

```bash
pnpm prisma migrate dev --name init
```

### 4. Create the owner account

```bash
pnpm seed:owner
```

This runs an interactive prompt asking for username, name, and password.
Only one OWNER account is allowed per database.

### 5. Start the development server

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## Cloudinary Upload Preset

Before uploading bill photos, create an upload preset in Cloudinary:

1. Go to **Cloudinary Dashboard → Settings → Upload → Upload presets**
2. Click **Add upload preset**
3. Set **Preset name**: `constructhub_bills`
4. Set **Signing mode**: `Signed`
5. Set **Folder**: `bill-photos`
6. Under **Upload restrictions**, set:
   - **Allowed formats**: `jpg, jpeg, png, webp, heic`
   - **Max file size**: `5 MB`
7. Save the preset

---

## Running Tests

```bash
pnpm test          # Run all tests in watch mode
pnpm test:ui       # Open Vitest UI in browser
```

---

## Deploying to Vercel

1. Push your repository to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo
3. Add all environment variables from `.env` in the Vercel dashboard
4. Deploy — Vercel auto-detects Next.js

> **Important**: For Neon on Vercel, use the **pooler connection string** for
> the `DATABASE_URL` in production (Vercel uses serverless functions that
> can't maintain persistent connections). Use the direct connection only
> for `prisma migrate`.

---

## Architectural Rules

These rules apply throughout the entire codebase. Do not deviate.

1. **Paise only** — All monetary amounts are stored as `BigInt` in paise
   (1 INR = 100 paise). Never use `number` or `float` for money. Use
   `decimal.js` for arithmetic, convert to `BigInt` for storage.

2. **Derived wallet balances** — Wallet balances are never stored.
   Always derived by summing `wallet_transactions` for that user (credits
   minus debits, excluding voided rows). Use `getWalletBalance()` from
   `lib/wallet.ts`.

3. **Transactions for multi-writes** — Every operation that writes to
   multiple tables must be wrapped in `db.$transaction(...)`.

4. **No hard deletes on financial records** — Use `voidedAt` + `voidedById`.
   Voiding a transaction creates a reversing entry where appropriate.

5. **Actor vs Logger** — Every transaction table has both `actorUserId`
   (whose wallet/account moves) and `loggedById` (who entered the record).
   They may differ when an owner logs on behalf of an employee.

6. **Single Prisma singleton** — All Prisma access goes through `lib/db.ts`.
   Never instantiate `PrismaClient` directly anywhere else.

7. **Hashed passwords** — All passwords are hashed with bcryptjs (10 rounds).
   Never store plaintext. Never log passwords.

8. **Cookie sessions** — All sessions use iron-session in `httpOnly`, `secure`,
   signed cookies. No `localStorage` tokens. No URL tokens.

---

## 20-Step Manual Test

This verifies the full financial loop end-to-end: wallets → expenses → purchases → material → income → P&L → voiding → CSV export.

### Step 1 — Seed the owner account

```bash
pnpm run seed:owner
```

Note the username/password printed. You'll use these to sign in.

### Step 2 — Sign in as owner

Navigate to `/login`. Use the credentials from Step 1. You should land on the dashboard.

### Step 3 — Create Site A

**Sites → Create Site**:

| Field | Value |
|---|---|
| Name | Test Project A |
| Location | Mumbai |
| Client | ACME Corp |
| Contract Value | ₹15,00,000 |

The site should show ₹0 spent, ₹0 received, 0% budget used.

### Step 4 — Create Site B

Same flow:

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

### Step 6 — Top up Ramesh and Suresh

- Ramesh: Top up ₹20,000
- Suresh: Top up ₹15,000

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
Budget Used ≈ 18,279 / 15,00,000 × 100 ≈ **1.2%** ✓

### Step 17 — Void the steel rods purchase

**Site B** → Material tab → Steel Rods row → **...** → **Void Purchase** → Confirm.

Row shows strikethrough + **VOIDED** badge. Site B Spent decreases by ₹9,440. ✓

### Step 18 — Verify Site B spend decreased

Navigate to **Sites** list. Site B P&L column now only reflects the material transfer IN (≈ ₹8,519.60). ✓

### Step 19 — Export Site A CSV

**Reports** (top nav) → Test Project A → **Download CSV**.

Open the file and verify:
- Headers: `Date,Type,Category,Item,Qty,Unit,Amount (₹),Site,Counterparty,Vendor,Logged By,Note,Voided`
- All rows present: expenses, vendor payment, material transfer out, income
- Amounts in rupees (not paise): e.g. `21299.00`
- Voided rows: `Voided` column = `Yes`; live rows = `No`
- Notes with commas are quoted correctly

### Step 20 — Reset Ramesh's password and verify login

**Employees → Ramesh → ...** → **Reset Password**. Set a new password.

Open an incognito window → `/login` as Ramesh with the new password.

Ramesh sees his wallet balance (≈ ₹5,701) and transaction history. ✓
