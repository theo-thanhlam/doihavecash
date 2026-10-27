# DoIHaveMoney

A focused budgeting app: log money in and out, plan each month by category, and know whether you can afford something. It does not connect to banks, move money, give investment or tax advice, or mix currencies.

**Status:** project setup and sign-in are done (landing page, email-code sign-in and sign-up, header, sessions). Budget screens come next.

## Prerequisites

- Node.js 22+
- Docker, which runs Postgres 17, Redis 7 and Mailpit locally. Without Docker you need your own PostgreSQL 13+ and Redis 6+.

## Local setup

```bash
npm install
cp .env.example .env        # then fill in the values below
docker compose up -d --wait # Postgres :5432, Redis :6379, Mailpit SMTP :1025 + inbox http://localhost:8025
npm run db:migrate
npm run db:seed
npm run dev                 # http://localhost:3000
```

Sign in as the demo user `demo@doihavemoney.local`. The code shows up in the Mailpit inbox at http://localhost:8025.

## Environment variables

| Name                                    | Purpose                                                                |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`                          | Postgres connection string                                             |
| `JWT_SECRET`                            | Signs access tokens. At least 32 characters: `openssl rand -base64 48` |
| `REDIS_URL`                             | Redis for sign-in codes, e.g. `redis://localhost:6379`                 |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Mail server. Mailpit defaults: `localhost`, `1025`, `false`            |
| `SMTP_USER`, `SMTP_PASS`                | Leave empty for Mailpit                                                |
| `MAIL_FROM`                             | Sender shown on code emails                                            |

## Database

- Schema: `src/db/schema.ts`, mirroring the approved design in `TableDesign/v6/schema.dbml`. Table changes need a new `TableDesign/vN` and approval first.
- `npm run db:generate` creates a migration in `drizzle/` from schema changes.
- `npm run db:migrate` applies migrations.
- `npm run db:seed` adds the demo user. It is safe to re-run. The data includes an archived account, a budgeted category with no spending yet, and an uncategorized transaction.

## Tests

```bash
npm test
```

The tests need `DATABASE_URL`, `REDIS_URL` and `JWT_SECRET`. Database tests create a throwaway `test_*` schema, run the migrations in it, and drop it when they finish. Your real tables are never touched. Redis tests use random `otp:*@test.local` keys and delete them afterwards.

The tests cover token signing and tampering, open-redirect blocking, single-use codes, the wrong-attempt lockout and resend limit, refresh token rotation including parallel refreshes, and the middleware's redirects and silent refresh.

Also available: `npm run typecheck` and `npm run lint`.

## How sign-in works

1. The user enters an email (plus first and last name to sign up). On Sign in, an email with no account goes straight to the Sign up tab and no code is sent. Otherwise the server emails a 6-digit code. Only a hash of the code is stored in Redis, for 5 minutes.
2. Each code works once. After 5 wrong tries it stops working, and a new code can be requested only once a minute.
3. A correct code signs the user in with two `HttpOnly`, `SameSite=Lax` cookies (`Secure` in production):
   - `accessToken`: a JWT (HS256), valid for 15 minutes. It holds the user id and name.
   - `refreshToken`: a random string, valid for 30 days. Only its SHA-256 hash is stored, in `refresh_tokens`.
4. `src/proxy.ts` (Next.js 16's name for middleware) checks the access token on every request. When it has expired, the proxy swaps the refresh token for a new pair. The old token is revoked and the new one inserted in one SQL statement, and the new tokens are visible to the same request. Every path except those in `PUBLIC_PATHS` (`/` and `/auth`) needs sign-in. Signed-out visitors are sent to `/auth?next=…`.
5. If several requests refresh at the same moment, one wins. The others aren't logged out for 30 seconds, because the browser already holds the new cookies.
6. Signing out revokes the refresh token and clears both cookies.

Pages that need sign-in live in `src/app/(protected)/`. That folder's layout checks on the server with `requireUser()`, and pages that load user data call it again themselves. The proxy is never the only check.

## Deployment

### With Docker (`docker-compose.prod.yml`)

Runs the app, Postgres and Redis. There's no Mailpit, so use a real mail provider. Postgres and Redis aren't reachable from outside; only the app's port is.

1. Create `.env.production` next to the compose file (it's git-ignored and never copied into the image):

   ```bash
   POSTGRES_PASSWORD=   # letters and digits only (it goes inside a URL)
   JWT_SECRET=          # openssl rand -base64 48
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587        # optional, default 587
   SMTP_SECURE=false    # true for port 465
   SMTP_USER=
   SMTP_PASS=
   MAIL_FROM="DoIHaveMoney <no-reply@example.com>"
   APP_PORT=3000        # optional, host port
   ```

2. Start it:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
   ```

   A one-off `migrate` service applies migrations first, and the app starts only if they succeed. Re-running the command after a code change rebuilds the image and applies new migrations. If a required variable is missing, Compose refuses to start and names it.

3. Put an HTTPS reverse proxy (Caddy, nginx, a load balancer) in front of the app. In production the session cookies are `Secure`, so sign-in won't stick over plain http.

Back up the `postgres-data` volume (see below). Redis only holds 5-minute sign-in codes and keeps nothing on disk.

### Without Docker

Any Node 22 host works: `npm ci`, `npm run build`, `npm run db:migrate`, then `node .next/standalone/server.js` (copy `.next/static` to `.next/standalone/.next/static` first). Set the same variables as `.env.example`, and point `SMTP_*` at a real provider.

## Backup and restore

```bash
pg_dump --format=custom "$DATABASE_URL" > backup.dump
pg_restore --clean --no-owner --dbname "$DATABASE_URL" backup.dump
```

Redis holds only short-lived sign-in codes and doesn't need a backup.

## Known limitations

- Screens: `/dashboard` (recent transactions, budgets used, monthly expense chart, next subscriptions), `/transactions` (table of the newest 200, with add, edit and delete), `/accounts`, and `/subscriptions` (a reminder list you can add, edit and remove; it never records transactions or charges anything). `/budgets` lists this month's budgets (name, percent used, desired amount). A budget covers one or more expense categories; percent used = this month's spending across them ÷ the desired amount. Budgets can't be edited or removed yet, and earlier months aren't browsable.
- "This month" on the dashboard follows the database clock, not your timezone.
- There's no way to sign out all devices, and reuse of a stolen refresh token isn't detected.
- Sign-in codes are limited per email, not per IP address.
- Changing your name only shows up in the header after the access token refreshes (within 15 minutes).
