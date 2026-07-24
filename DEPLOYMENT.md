# Warranty Manager Deployment Guide

This guide is provider-neutral. The approved staging architecture uses one Node/Express process that serves the compiled React assets and same-origin API, MySQL 8, persistent private invoice storage, SMTP for reset/reminder email, and managed HTTPS ingress. Keeping the browser and API on one exact origin preserves `SameSite=Lax` session cookies and avoids cross-origin credential weakening.

## Required services and persistence

- Node.js runtime compatible with the committed lockfiles.
- MySQL 8-compatible database reachable only by the backend.
- HTTPS frontend hosting and HTTPS API ingress.
- A persistent, writable directory for invoices. Never place it under the frontend build or another public static root.
- SMTP when password-reset delivery and reminders are enabled.
- Exactly one reminder scheduler/cron worker. Do not enable the in-process scheduler on every web replica.
- Backups for both MySQL and the upload directory; product rows and files must be restored as one logical dataset.

## Production environment

Copy `.env.example` to the platform secret/configuration system; do not commit a real `.env`.

Required in production:

- `NODE_ENV=production`
- `PORT`: platform-assigned backend port.
- `SESSION_SECRET`: cryptographically random, non-placeholder, at least 32 bytes.
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `FRONTEND_ORIGINS`: comma-separated exact HTTPS origins.
- `FRONTEND_URL`: canonical exact frontend origin used in email links.
- `FRONTEND_BUILD_DIRECTORY`: optional absolute compiled React path; the repository layout defaults to `frontend/dist`.
- `UPLOAD_DIRECTORY`: absolute path on persistent private storage.

Proxy and HTTPS:

- Set `TRUST_PROXY=false` when Node terminates TLS directly.
- Set `TRUST_PROXY=1` only when exactly one trusted ingress/proxy sits in front of Node. Use the actual bounded hop count for another topology; never use a blanket `true` value.
- `ENFORCE_HTTPS=true` is the production default. The proxy must replace, not append untrusted, forwarding headers and must send `X-Forwarded-Proto: https` to Node.
- Redirect HTTP to HTTPS at the edge. The API returns 426 for a request it considers non-HTTPS rather than redirecting state-changing requests.

Database reliability:

- `DB_CONNECTION_LIMIT` defaults to 10 and must be sized against the database connection budget across all replicas.
- `DB_CONNECT_TIMEOUT_MS` defaults to 10000.
- Set `DB_SSL_MODE=required` or `verify_identity` when the managed database requires TLS. Set `DB_SSL_CA_FILE` to the mounted CA certificate path when supplied by the provider. Certificate verification is never disabled silently.

Files and request limits:

- `MAX_UPLOAD_SIZE_BYTES` defaults to 10485760 (10 MiB).
- `JSON_BODY_LIMIT` defaults to `100kb`.
- The upload mount must be writable by the non-privileged application user and inaccessible to the frontend/static server.

Multiple instances:

- MySQL sessions are shared across instances.
- The current `express-rate-limit` store is process-local. Keep `MULTI_INSTANCE=false` and `RATE_LIMIT_STORE=memory` for a single API instance. Before multiple API instances are permitted, implement and test a supported shared-store adapter and update the validator; this build deliberately rejects both multi-instance mode and a merely declared `shared` value.
- Run reminders from one external scheduled invocation of `npm run reminders:run`, or enable `REMINDER_SCHEDULER_ENABLED=true` on exactly one designated process.

Email delivery is selected with `EMAIL_PROVIDER`: use `smtp` with `SMTP_HOST`, `SMTP_FROM`, and optional paired `SMTP_USER`/`SMTP_PASSWORD`; or use `https_api` with `HTTPS_EMAIL_API_URL`, `HTTPS_EMAIL_API_KEY`, and `HTTPS_EMAIL_FROM`. The HTTPS adapter requires TLS, bounded `EMAIL_HTTPS_TIMEOUT_MS`, and bounded `EMAIL_HTTPS_MAX_RETRIES`. Provider rejection or timeout must not mark a reminder sent. SMTP is not part of `/api/ready`, so a temporary provider outage does not remove the whole site from service.

## Install, validate, migrate, build, and start

Every database deployment operation requires `DEPLOYMENT_ENV`. Mutating staging operations refuse to run unless `STAGING_DATABASE_CONFIRMED=true` or the approved command includes the one-operation `--confirm-staging` flag. Keep the file value false when possible. Production operations additionally require a short-lived, operation-specific `PRODUCTION_CHANGE_APPROVED` value; do not store that approval value in an environment file.

From a clean checkout:

```powershell
cd backend
npm.cmd ci
npm.cmd run db:validate
npm.cmd run syntax:check
npm.cmd test
npm.cmd run db:preview
npm.cmd run db:migrate

cd ..\frontend
npm.cmd ci
npm.cmd test
npm.cmd run build

cd ..\backend
npm.cmd start
```

Use `npm` rather than `npm.cmd` on Linux/macOS. Run `db:preview` before `db:migrate`. The preview is read-only. Run `db:migrate` as a release step before starting new application code; it creates a migration ledger and applies additive/idempotent checks for reminder columns, reset tokens, sessions, and required indexes. It never drops tables or columns.

For a brand-new empty and confirmed staging database, `npm run db:initialize:staging` applies the target-neutral `database/schema.sql`. The schema never creates or selects a database. For an existing database, use `npm run db:migrate`; do not re-import or replace the baseline.

Available guarded commands:

- `npm run release:validate`: backend/frontend tests, syntax/schema checks, and production build.
- `npm run db:preview`: read-only applied/pending migration report.
- `npm run db:inspect`: read-only table, column, index, and foreign-key inspection.
- `npm run db:initialize:staging`: initializes only an empty confirmed staging target.
- `npm run db:verify:staging`: transactionally verifies schema, UTF-8/Arabic data, sessions, and reset-token single use, then rolls test rows back.
- `npm run db:backup` and `db:backup:verify`: create and verify a protected SQL dump. Set `BACKUP_FILE` to a new absolute path. `MYSQL_CLIENT_CONTAINER` may identify a trusted MySQL container when host clients are unavailable.
- `npm run db:restore-target:create` and `db:restore:isolated`: create and restore only a distinct explicitly confirmed restore database.
- `npm run files:backup`, `files:backup:verify`, and `files:restore:isolated`: copy private uploads with SHA-256 manifests and refuse overwrite.
- `npm run deployment:smoke`: verify staging HTTPS health, readiness, HSTS, frame protection, and `nosniff` headers.

## Isolated local staging database

`docker-compose.staging.yml` provides the simplest isolated option on a development workstation. It binds MySQL only to `127.0.0.1`, uses a named persistent volume, and obtains every password from an ignored `.env.staging.local` file. It must not be started until the local-database action is approved.

After approval, run `npm run staging:env:create` from `backend/`. It creates the ignored `.env.staging.local` with cryptographically random local-only secrets, creates the ignored private upload directory, never prints secret values, and refuses overwrite. It keeps `STAGING_DATABASE_CONFIRMED=false`; after target identity is verified, supply `--confirm-staging` only to each separately approved mutation. Then run:

```powershell
docker compose --env-file .env.staging.local -f docker-compose.staging.yml up -d
cd backend
node --env-file=../.env.staging.local src/previewMigrations.js
node --env-file=../.env.staging.local src/initializeStagingDatabase.js --confirm-staging
node --env-file=../.env.staging.local src/migrate.js --confirm-staging
node --env-file=../.env.staging.local src/inspectDatabase.js
node --env-file=../.env.staging.local src/verifyStagingDatabase.js --confirm-staging
```

Starting Docker, pulling the image, creating the volume/database, or applying the baseline/migration are approval-required actions. The initial preview and connectivity check are read-only, but still use only the confirmed local container target.

## Health checks

- `GET /api/health`: liveness only, returns `ok`.
- `GET /api/ready`: readiness; checks a minimal database query and private storage read/write access. It returns only `ready` or `unavailable`; SMTP/Gemini are optional and do not fail site readiness.

Configure liveness and readiness probes through HTTPS (or through the trusted proxy headers). Do not expose database/version details in platform probes.

## Deployment order

1. Confirm the target is staging, not production.
2. Take a database backup and a consistent upload-directory snapshot; verify both artifacts exist and are readable.
3. Restore the backup into staging and run `npm run db:migrate` there.
4. Run `/api/health`, `/api/ready`, backend tests, frontend tests, and the manual security checklist below.
5. Build and deploy the frontend and backend using lockfile installs.
6. Verify exact origins, proxy hop count, HTTPS, HSTS, cookies, session persistence, SMTP, and persistent upload storage.
7. Repeat the backup, migration, deploy, and smoke sequence for production only after staging approval.

## Backup and rollback

- Database backup: use a managed provider snapshot or the guarded `db:backup` command from a protected operator host. Never place the dump in the repository; `backups/` is ignored locally.
- File backup: use the guarded hash-manifest commands or a platform snapshot of `UPLOAD_DIRECTORY` at the same deployment checkpoint. Encrypt backups and restrict access.
- Verify: check non-zero size, provider completion status, retention policy, and perform a staging restore test.
- Application rollback: deploy the previous application artifact. Additive schema changes may remain; they are backward-compatible.
- Data restore: restore only after an incident decision and a tested procedure. Do not use destructive rollback SQL that drops newly created user data.

No backup or restore was performed during the local review; this is required staging/production evidence.

## Post-deployment smoke and security checklist

1. Confirm HTTP is redirected/blocked at the edge and HTTPS works without loops.
2. Check `/api/health` and `/api/ready`; simulate a database/storage failure and confirm readiness becomes 503 without details.
3. Inspect the session cookie for `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and expected expiry.
4. Restart an API instance and confirm the MySQL-backed session remains valid; log out and confirm reuse fails.
5. Register an account, test generic unknown/wrong login responses, reset once, reject replay, and reject the pre-reset session.
6. Create User A and User B. Attempt User B read/update/delete/view/download of User A's product/invoice; expect indistinguishable 404/denial.
7. Test valid supported files, unsupported/empty/oversized files, renamed executable, MIME/signature mismatch, traversal/header-injection filename, replacement, deletion, and failed-database cleanup.
8. Confirm invoice responses are authenticated, owner-checked, `private, no-store`, `nosniff`, and use safe Content-Disposition.
9. Verify trusted frontend CORS/preflight. Reject missing/null/attacker/prefix/suffix/different-protocol/different-port origins for state changes.
10. Verify CSP, frame denial, Permissions-Policy, no-referrer, COOP/CORP compatibility, and production-only HSTS.
11. Send a reset and reminder through an approved test SMTP account. Confirm failed SMTP is not marked sent and duplicate worker runs do not duplicate reminders.
12. Send SIGTERM during a request; confirm the scheduler stops, HTTP drains within the configured timeout, the database pool closes, and logs contain no secrets.
13. Validate Arabic/Unicode names, stores, notes, and email content against staging MySQL.

## Logging and alerts

Ship stdout/stderr JSON records to the platform log service with restricted access and retention. Do not log bodies, passwords, hashes, cookies, session IDs, tokens, SMTP credentials, invoice contents, or authorization headers. Alert on authentication/rate-limit spikes, repeated access denial/upload rejection, database/session failures, reminder failures, failed migrations, and unexpected restarts.

## Known limitations

- Docker CLI and Compose are installed, but the Docker engine is stopped. No isolated MySQL instance has been created or started, and no schema/migration has been applied. These remain approval-gated staging checks.
- HTTPS and proxy behavior was covered with automated forwarded-protocol tests, but the actual ingress must be verified.
- Distributed rate limiting requires a deployment-selected shared store before scaling past one API instance.
- Malware scanning is not implemented. It is recommended hardening unless organizational policy makes it mandatory.
- Local private files require durable volume design and coordinated database/file backups. Object storage is a future architecture option, not part of this change.
