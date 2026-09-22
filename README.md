# Patient appointment app

A **solo dentist** scheduling product: patients request in-person appointments; the doctor or admin confirms them; reminders are logged for email, SMS, and push.

v1 is **booking + reminders only** (no clinical records, video visits, or payments). Clinic rules (hours, slot contention, cancel policy, reminders, auth, intake, locale, close-out) are **admin settings**, not hardcoded.

Day-one clients in the spec: **web (PWA + web push)**, **iOS**, and **Android**. This repository ships the **web app** (Next.js) with Prisma/Postgres. Native iOS/Android shells and live SMS/email providers are not included.

The product spec is in [docs/SPEC.md](docs/SPEC.md).

## Prerequisites

- Node.js 20+
- PostgreSQL 16+ (local default: `appointments` / `appointments` / `appointments`)

## Run locally

```bash
cp .env.example .env
# DATABASE_URL=postgresql://appointments:appointments@localhost:5432/appointments
# NODE_ENV=development

npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other scripts:

```bash
npm test          # vitest
npm run build     # production build
npm run lint
```

## Seed credentials

OTP is enabled by default. In non-production, `POST /api/auth/otp/request` (and register) returns `devCode` so you can sign in without SMS/email. The code is also printed to the Next.js server log as `[otp]`.

| Role | Identifier | Notes |
| --- | --- | --- |
| Staff (doctor + admin) | `dentist@practice.local` | Request OTP, then enter `devCode`. If password auth is enabled in Settings, password is `practice-dev`. After login, staff land on `/inbox`. |
| Patient | Register at `/register` with an email or mobile | Verify with `devCode`. After login, patients land on `/dashboard`. |

Session cookie name: `session` (httpOnly, SameSite=Lax).

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. Prisma **generate** and **migrate** both read it. A dummy URL is enough for `prisma generate` / `next build`; a real database is required at runtime. |
| `NODE_ENV` | no | `development` locally; `production` for `next start` / Docker. |
| `PORT` | no | Listen port (default `3000`). |
| `HOSTNAME` | no | Bind address for the container (`0.0.0.0` in Docker). |
| `SEED_ON_START` | no | Docker only. Set `true` to run `prisma db seed` after migrate (demo dentist account). |

Copy [`.env.example`](.env.example) for local development and [`.env.production.example`](.env.production.example) as a checklist for hosts.

## Production build

```bash
cp .env.example .env
npm ci
npx prisma generate          # also runs from npm run build / postinstall
npx prisma migrate deploy
npx prisma db seed           # optional demo data
npm run build                # prisma generate && next build
npm start                    # next start (output: standalone)
```

`npm run build` does not need a live database. `npm start` does.

Health check: `GET /api/health` → `{ "ok": true }`.

## Deploy

This environment has no Vercel / Fly / Railway / registry credentials, so there is **no live public URL** from this change. Use one of the paths below.

### Docker Compose (Postgres + app)

Requires Docker Engine and Compose v2.

```bash
# optional: SEED_ON_START=true (default in compose) for demo credentials
docker compose up --build
```

Then open [http://localhost:3000](http://localhost:3000) and hit [http://localhost:3000/api/health](http://localhost:3000/api/health).

The image runs `prisma migrate deploy` on start. Default DB: `postgresql://appointments:appointments@db:5432/appointments`.

### Vercel

1. Import the GitHub repo in Vercel (framework is Next.js; see [`vercel.json`](vercel.json)).
2. Set `DATABASE_URL` to a hosted Postgres (Neon, Supabase, Vercel Postgres, RDS).
3. After the first deploy (or as a release command), run migrations:

```bash
npx prisma migrate deploy
npx prisma db seed   # optional
```

`postinstall` / `npm run build` already run `prisma generate`. Do not commit secrets; configure them in the Vercel project.

### GitHub Actions

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs `npm ci`, `prisma generate`, `npm test`, and `npm run build` on pushes to `main` / `cursor/**` and on PRs targeting `main`. It uses a dummy `DATABASE_URL` (no Postgres service).

## Happy path

1. Register a patient, verify OTP, request a slot (`/request`).
2. Sign out, sign in as `dentist@practice.local`, confirm the request in `/inbox`.
3. Sign back in as the patient and confirm the visit shows **Confirmed**.
4. Admins can change catalog/policies at `/settings` (including Complete / no-show `completeMode`).
