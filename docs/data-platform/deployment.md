# Deployment

How to put the AVDP Integrated Data & Analytics Platform into production.

## What you are deploying

One Next.js application (dashboard + Data Manager + API), one PostgreSQL database, and
**one persistent directory of uploaded source files**. That third piece is easy to miss and
the most costly to lose: those files are the evidence behind every published figure and
cannot be reconstructed from the database.

## Before you start

| Requirement | Notes |
| --- | --- |
| Node.js 22 (or 20) | Only if deploying without containers |
| PostgreSQL 16 | A dedicated database; the app creates eight schemas |
| TLS termination | Session cookies are `secure` in production and will not be sent over plain HTTP |
| Persistent volume | For `UPLOAD_STORAGE_DIR`, backed up on the same schedule as the database |

## 1. Generate secrets

```bash
openssl rand -base64 48   # AUTH_SECRET
openssl rand -base64 32   # INTEGRATION_SECRET_KEY  (must decode to exactly 32 bytes)
openssl rand -base64 32   # database password
```

Store them in your secret manager. `INTEGRATION_SECRET_KEY` encrypts connector
credentials — **if it is lost, stored credentials cannot be decrypted** and each
integration must be re-entered. Rotating it requires re-entering them too.

## 2. Deploy

### Option A — Docker Compose (single node, pilot or internal server)

```bash
cp .env.docker.example .env      # fill in the generated secrets
docker compose up -d --build
docker compose exec app node node_modules/prisma/build/index.js migrate deploy
docker compose exec app node -e "require('./prisma/seed.js')" || \
  docker compose run --rm app npx prisma db seed
```

The compose file binds the app to `127.0.0.1:3000` only. Put a reverse proxy
(nginx, Caddy, Traefik) in front of it to terminate TLS.

### Option B — Any Node host / PaaS

```bash
npm ci
npm run build                    # generates the Prisma client, then builds
npx prisma migrate deploy
npm run db:seed                  # first deploy only
npm start                        # or: npm run start:standalone
```

`npm run build` runs `prisma generate` explicitly, so the build does not depend on
install-script behaviour — `npm ci --ignore-scripts` and `--omit=dev` both skip Prisma's
own postinstall hook.

### Option C — Managed Postgres + container platform

Build the image, push it, and run it with the environment below. Point `DATABASE_URL` at
the managed instance and mount object storage or a persistent disk at
`UPLOAD_STORAGE_DIR`.

## 3. Environment

Required in every environment:

```
DATABASE_URL=postgresql://user:password@host:5432/avdp?schema=public
AUTH_SECRET=<48-byte base64>
UPLOAD_STORAGE_DIR=/data/uploads
DATA_MODE=mock
```

Set `INTEGRATION_SECRET_KEY` before configuring any integration that needs credentials.
The full table is in the README.

**Leave `DATA_MODE=mock` at first.** The dashboard stays on fixtures until real AVDP
datasets are approved and published; switching early gives an empty dashboard, not a
wrong one, but there is no reason to.

## 4. First-run checklist

- [ ] `npx prisma migrate deploy` applied cleanly
- [ ] `npm run db:seed` run once (roles, permissions, districts, value chains, periods,
      indicators, and the initial administrator)
- [ ] **Signed in and changed the seeded administrator password immediately**
- [ ] Real staff accounts created and assigned roles; the shared seed account disabled
- [ ] Reporting periods reviewed and the current one set to `open`
- [ ] `GET /api/health` returns 200
- [ ] TLS confirmed — sign-in will not work without it in production
- [ ] Backups configured for **both** the database and `UPLOAD_STORAGE_DIR`
- [ ] A restore drill run: confirm an import job's stored checksum still matches its file

## 5. Health and monitoring

`GET /api/health` is unauthenticated and returns:

- `200 {"status":"ok"}` — the app is serving and PostgreSQL is reachable
- `503 {"status":"degraded"}` — PostgreSQL is unreachable; the instance should not take
  traffic, because it can serve no dashboard figure

Point your load balancer's readiness probe at it. It deliberately exposes no versions,
hostnames or error text.

## 6. Upgrades

```bash
git pull
npm ci
npm run build
npx prisma migrate deploy    # always before starting the new version
npm start
```

Migrations are forward-compatible; the analytics-views migration also ships a `down.sql`.
Never edit a migration that has been applied to a shared environment — add a new one.

## 7. Scaling

The app runs single-node out of the box. Before running more than one instance:

1. **Move `UPLOAD_STORAGE_DIR` to shared storage** (NFS or object storage). Two instances
   with separate disks will each be unable to read the other's uploads.
2. **Move the API rate limiter and login throttle to a shared store.** Both are in-process
   (`src/lib/api/rate-limit.ts`, `src/lib/auth/throttle.ts`), so limits are effectively
   multiplied per node and reset on deploy.
3. Consider promoting the analytics views to materialised views, and moving publication
   and integration runs to a background queue.

## 8. What is not wired yet

- **No scheduler.** `scheduleCron` is stored on integrations but nothing fires it, and
  `pruneExpiredSessions()` is never called on a timer. Point a cron job or worker at the
  Run Now endpoint and the prune helper.
- **Analytics refresh** happens on publication and on demand. A scheduled refresh is a
  cron call to the same function.

## 9. Backups

Back up together, on the same schedule, with the same retention:

1. **PostgreSQL** — nightly `pg_dump` plus WAL archiving for point-in-time recovery.
   Suggested retention: 30 daily, 12 weekly, 12 monthly.
2. **`UPLOAD_STORAGE_DIR`** — the retained source files.

A database restored without its files leaves every published figure unverifiable. Test
both together.
