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
