# Staging Verification Record

Updated: July 19, 2026

## Live status

| Item | Status | Evidence or next gate |
| --- | --- | --- |
| Dirty-worktree preservation | Completed automatically | Existing modifications remain intact; no reset or clean command used. |
| Local release validation | Completed automatically | Backend 29/140 and frontend 12/58 passed; syntax/schema/build/audits/scans/diff check passed. |
| Guarded deployment automation | Completed automatically | Target guards, preview/inspection, initialization, backup/restore, file manifests, smoke tests, and local Compose definition added. |
| Isolated staging MySQL | Completed with approval | Healthy MySQL 8.4 container on `127.0.0.1:3307`; new named volume; ignored secrets and upload directory generated. |
| Staging migration and live schema tests | Completed with approval | Baseline/migration/idempotency/schema/Arabic/session/reset-token/rollback checks passed. |
| Hosting selection and staging deployment | Railway approved; access pending | Single-origin Railway packaging is locally prepared and tested. No Railway service, volume, database, charge, commit, or push has occurred. |
| HTTPS/proxy/cookie/origin verification | Waiting for staging deployment | Requires a real HTTPS staging URL. |
| Persistent private storage | Waiting for hosting selection | No volume or bucket created. |
| SMTP test | Waiting for approval and test recipient | No email sent. |
| Backup/restore proof | Completed with approval (database); partial for files | SQL restore matches source. Empty upload-directory manifest/restore passed; non-empty invoice proof awaits staging upload. |
| GitHub CI | Waiting for approval to publish changes | Workflow is local/untracked and therefore has not run remotely. |
| Production deployment | Blocked pending all staging checks | Separate production approvals are required. |

## Local automation evidence

- New deployment tests followed RED → GREEN: three suites initially failed because their modules were absent; the focused final run passed 4 suites and 23 tests.
- `docker compose ... config --no-interpolate` validated `docker-compose.staging.yml` without starting Docker.
- An unguarded `npm run db:migrate` was deliberately attempted with the current local configuration and correctly refused because `DEPLOYMENT_ENV` was absent. No connection or mutation occurred.
- `database/schema.sql` is target-neutral and cannot create or switch databases.
- `npm run release:validate` passed all five stages: backend 29 suites/140 tests, 54 backend source files, five schema tables, frontend 12 suites/58 tests, and a 50-module Vite production build.
- The staging environment generator followed RED → GREEN: its suite first failed because the module was absent, then passed 2 tests. It generates secrets without printing them and refuses overwrite.
- Backend and frontend `npm audit --audit-level=high` each reported zero vulnerabilities.
- Source, Git-history, and built-bundle secret/local-address scans returned no matches; `git diff --check` passed with line-ending notices only.
- Backend `npm ci --dry-run --ignore-scripts` passed. The equivalent frontend dry run timed out after 121 seconds while npm repeatedly emitted existing Babel peer-resolution warnings. Frontend tests and the production build passed; clean GitHub-hosted installation remains part of the pending CI proof.
- Docker Desktop was started with approval. `warranty-manager-staging-db` is healthy, bound only to `127.0.0.1:3307`, and backed by `warranty-manager-staging_staging-database` at `/var/lib/mysql`.
- `.env.staging.local` and `.staging-data/uploads` were generated without printing secrets and are ignored by Git. `STAGING_DATABASE_CONFIRMED` remains false.
- Read-only migration preview connected to `warranty_manager_staging`: no applied migrations and `20260718_production_readiness` pending.
- Read-only schema inspection reported zero application tables, columns, indexes, and foreign keys, confirming the newly created target is empty.
- A direct MySQL identity query through `docker exec` failed because the nested shell stripped the SQL argument. It made no changes and is non-blocking because the application-level preview and inspection independently proved connectivity and target state.
- With separate approval, the baseline and `20260718_production_readiness` migration applied successfully. Live inspection now reports 5 tables, 37 columns, 11 indexes, 2 foreign keys, and no gaps; the migration ledger has nothing pending.
- Transactional staging verification passed for `utf8mb4`, Arabic data, session storage, reset-token single use/replay denial, and rollback. Independent cleanup counts are zero for users, products, sessions, and reset tokens.
- Live inspection initially produced a false missing-object report because MySQL returned uppercase metadata keys. A reproducing test failed, the casing-compatible fix passed, and live inspection then passed.
- Migration no-op output now reports `applied: []` and the existing migration under `skipped`, avoiding misleading counts.
- Backup automation had an unexecuted Docker port defect (host 3307 versus container 3306). It was fixed before use with a RED/GREEN command-construction suite; backup/restore still awaits approval.
- With separate approval, a 7,001-byte SQL dump was created and verified to contain all five tables. It contains none of the generated session/database/root secrets and does not create or switch databases.
- `warranty_manager_restore_20260719` was created separately, restored successfully, and verified against the source: 5 tables, 37 columns, 11 indexes, 2 foreign keys, zero application rows, and one migration row.
- Private-file backup/verification/isolated restore passed with a SHA-256 manifest, but the source contained zero files. A non-empty invoice backup/restore remains part of deployed upload testing.
- Backup artifacts are under ignored `backups/`; the file restore proof is under ignored `.staging-data/`. No artifact was deleted.
- GitHub `main` and the local checkout both remain at `078f382` (`Initial release of Warranty Manager`). The root `package.json`, root lockfile, `railway.json`, production frontend serving, and deployment documentation exist only in the uncommitted local working tree. GitHub returns `404` for the root package, Railway config, and deployment guide, so a Railway build of current `main` cannot use the prepared single-origin build.
- The repository root is the required Railway build context. A clean temporary root build ran `npm ci` for backend and frontend and produced `frontend/dist`; selecting `backend` as the service root would exclude the frontend source and root deployment configuration.
- A production-mode local process passed `/api/health` and `/api/ready` (200), served the SPA route (200), kept unknown API and private-file paths at 404, and emitted HSTS, `nosniff`, and frame protection.
- Secret and bundle scans found no tracked environment files, credential patterns, exact local-secret matches, production localhost references, source maps, or secrets in compiled assets.

## Railway deployment smoke TDD evidence

- Test created first: `backend/tests/deploymentSmoke.test.js`.
- RED result: 2 tests failed because `hasExpectedStatus` was not exported and importing `smokeDeployment.js` executed the CLI immediately. The underlying tool also compared JSON endpoint bodies to the plain strings `ok` and `ready`.
- Implementation: parse and validate the JSON `status` contract, export the helper and `main`, and run the CLI only when the module is the entry point.
- GREEN result: focused suite passed 2/2; the complete release validation then passed backend 30 suites/143 tests, frontend 12 suites/58 tests, syntax validation for 54 source files, five-table static schema validation, and the 50-module production build.

## Approval checkpoints

1. Start/create the isolated local Docker staging database.
2. Preview, initialize, migrate, inspect, and behavior-test that confirmed database.
3. Create and restore database/file backups into separate isolated targets.
4. Select hosting and approve staging service creation/deployment.
5. Approve one test email to an identified recipient.
6. Publish changes and run GitHub-hosted CI.
7. Prepare separate production approvals only after every staging check passes.
