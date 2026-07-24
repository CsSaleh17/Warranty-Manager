# Security Review Summary

- Review date: 2026-07-18
- Project scope: Warranty Manager frontend, backend, API routes, authentication, authorization, MySQL queries/schema, invoice storage and analysis, sessions, password reset, configuration, logging, dependencies, tests, and build output.
- Components reviewed: all 50 application source files under `backend/src` and `frontend/src`, database schema/configuration, package manifests and lockfiles, environment templates, Git history, and automated tests.
- Coverage: 100% of application source files were inspected; tests exercise the applicable high-risk API paths. This is source-review coverage, not a claim of exhaustive exploit coverage.
- Commands and tools used: `rg`, Git status/history inspection, Jest/Supertest/React Testing Library, Vite build, `npm audit`, PowerShell secret-pattern scanning, and a local backend/frontend smoke test.
- Findings: 0 Critical, 3 High, 6 Medium, 2 Low, and 1 Informational.
- Fixed or mitigated: 11. Open security defects: 0. Production-verification items: listed under limitations and future work.
- Tests added or strengthened: malformed JSON, CSP/HSTS/Permissions-Policy, production-origin fail-closed behavior, schema validity, login timing parity, registration enumeration, reset replay/session invalidation, upload signature/size/name validation, input bounds, MySQL session persistence, safe audit logging, login rate limiting, and React XSS rendering.
- Final test results: backend 29 suites / 140 tests passed; frontend 12 suites / 58 tests passed; Vite production build passed.
- Dependency audit: backend 0 known advisories across 525 dependency entries; frontend 0 known advisories across 638 dependency entries on 2026-07-18.
- Secret review: no private keys, AWS keys, GitHub tokens, or JWTs found. `.env` is ignored and untracked. Git-history matches for sensitive environment names were blank `.env.example` placeholders.

## [SEC-001] State-changing session requests lacked CSRF enforcement

- Severity: High
- Status: Fixed
- Category: CSRF
- Location: `backend/src/app.js`, `backend/src/middleware/verifyRequestOrigin.js`
- Affected component: Cookie-authenticated API requests
- Description: Unsafe HTTP methods were accepted without verifying the browser origin.
- Exploitation scenario: An attacker-controlled page could submit a state-changing request with the victim's session cookie.
- Impact: Unauthorized creation, modification, deletion, logout, upload, or account changes.
- Evidence: Security tests demonstrate rejection of missing and untrusted origins and acceptance only of configured origins.
- Root cause: Session cookies were configured without a server-side CSRF request check.
- Fix implemented: Applied origin verification to POST/PUT/PATCH/DELETE requests, aligned it with the strict CORS allowlist, and retained `HttpOnly`, `SameSite=Lax`, and production-only `Secure` cookies.
- Tests added: `backend/tests/security.test.js`, `backend/tests/origins.test.js`
- Verification: Trusted requests pass; missing/untrusted origins return generic 403 JSON.
- Remaining risk: Production must configure the exact HTTPS frontend origins; non-browser clients must send an approved Origin header.

## [SEC-002] Invoice validation trusted extension and MIME metadata

- Severity: High
- Status: Fixed
- Category: Unsafe File Upload / Parser Security
- Location: `backend/src/routes/products.js`, `backend/src/routes/invoiceAnalysis.js`, `backend/src/services/invoiceFiles.js`
- Affected component: Stored invoice attachments and invoice analysis
- Description: A file with an allowed name and client-declared MIME type reached storage or image/PDF parsers without signature validation.
- Exploitation scenario: An attacker uploads script or malformed parser content named `invoice.jpg` with `image/jpeg` metadata.
- Impact: Untrusted bytes persisted or entered complex document/image parsing code, increasing stored-content and parser-exploitation risk.
- Evidence: RED test submitted HTML/script bytes as a JPEG; the old path accepted the upload and continued to persistence.
- Root cause: Extension/MIME checks trusted attacker-controlled multipart metadata.
- Fix implemented: Added exact extension-to-MIME allowlists and magic-byte/file-signature checks for every supported format before persistence or parsing. Existing UUID names, 10 MB limit, authenticated routes, owner checks, path containment, `nosniff`, and attachment downloads remain.
- Tests added: spoofed bytes, oversized files, traversal-style original names, owner-only view/download.
- Verification: Spoofed content returns 400 and is removed; valid server-generated filenames contain no traversal components.
- Remaining risk: No malware-scanning service is available. Production should add scanning/quarantine if uploads cross a higher-trust boundary.

## [SEC-003] Password-reset tokens could be consumed concurrently

- Severity: High
- Status: Fixed
- Category: Authentication / Race Condition / Session Security
- Location: `backend/src/routes/passwordReset.js`, `database/schema.sql`
- Affected component: Password reset and active sessions
- Description: Token validity was selected first, then password/token updates ran separately, allowing concurrent requests to pass the same validity check.
- Exploitation scenario: Two requests replay one valid token before either marks it used.
- Impact: Repeated one-time action and non-deterministic password state; existing sessions also remained active after reset.
- Evidence: RED tests required a single conditional update and failed against the former SELECT-then-UPDATE flow.
- Root cause: Token validation and consumption were not one atomic database operation.
- Fix implemented: One conditional multi-table MySQL update changes the bcrypt hash, marks all reset tokens used, and expires all matching server-side sessions only when the token is unused and unexpired.
- Tests added: valid, expired/invalid, reused, atomic-consumption, and active-session-expiry assertions.
- Verification: Related password-reset tests pass and replay returns the same generic invalid/expired response.
- Remaining risk: Real concurrent MySQL integration testing remains a production/staging verification item.

## [SEC-004] Production sessions used the development MemoryStore

- Severity: Medium
- Status: Fixed
- Category: Session Security / Deployment
- Location: `backend/src/app.js`, `backend/src/services/mysqlSessionStore.js`, `database/schema.sql`
- Affected component: Production authentication sessions
- Description: `express-session` defaulted to its in-process development store.
- Exploitation scenario: Restarts invalidate all sessions, horizontal instances disagree about login state, and memory grows with sessions.
- Impact: Availability and session-consistency weaknesses in production.
- Evidence: No explicit store was configured in the reviewed application.
- Root cause: Development session defaults were carried into production.
- Fix implemented: Production now uses a parameterized MySQL session store with server-side expiry, touch, lookup, and destroy operations. Development/tests retain the lightweight store.
- Tests added: `backend/tests/mysqlSessionStore.test.js`
- Verification: Store lifecycle tests pass; logout destroys the server-side record and handles destroy failures safely.
- Remaining risk: Deployments must apply the new `sessions` table migration and schedule deletion of expired rows as routine maintenance.

## [SEC-005] Framework parser errors and development HSTS/header defaults were unsafe

- Severity: Medium
- Status: Fixed
- Category: Error Handling / Security Headers
- Location: `backend/src/app.js`
- Affected component: All API responses
- Description: Malformed JSON fell through to HTML parser errors, while HSTS was emitted during local HTTP development and the default CSP allowed inline styles.
- Exploitation scenario: Invalid JSON reveals framework/parser details; local HSTS creates confusing HTTP behavior; permissive policy weakens XSS defense in depth.
- Impact: Information disclosure and security-policy misconfiguration.
- Evidence: RED tests received `text/html` for malformed JSON and an HSTS header in development.
- Root cause: Missing terminal JSON error handler and uncustomized Helmet defaults.
- Fix implemented: Added generic JSON parser/internal errors, strict CSP without `unsafe-inline`/`unsafe-eval`, `no-referrer`, `nosniff`, restrictive Permissions-Policy, frame denial, and production-only HSTS/upgrades.
- Tests added: malformed JSON and header assertions.
- Verification: Tests confirm generic JSON and expected header behavior.
- Remaining risk: The deployment proxy/CDN must preserve or strengthen these headers.

## [SEC-006] Production CORS/CSRF origin configuration failed open to localhost

- Severity: Medium
- Status: Fixed
- Category: CORS / Configuration
- Location: `backend/src/config/origins.js`
- Affected component: Browser API access
- Description: Missing production origin variables fell back to a localhost origin.
- Exploitation scenario: A production deployment starts with an unintended development allowlist.
- Impact: Misconfigured CORS/CSRF policy and deployment failure that is difficult to diagnose.
- Evidence: RED production-origin test expected startup configuration to fail but received a localhost allowlist.
- Root cause: Development default was shared with production.
- Fix implemented: Production now requires an explicit `FRONTEND_ORIGINS`/`FRONTEND_ORIGIN`; wildcard removal and development loopback aliases remain.
- Tests added: production fail-closed and strict allowlist tests.
- Verification: Missing production configuration throws a clear startup error.
- Remaining risk: Exact production URLs require operator verification.

## [SEC-007] Product bounds and checked-in schema were not safely enforced

- Severity: Medium
- Status: Fixed
- Category: Input Validation / Deployment Integrity
- Location: `backend/src/routes/products.js`, `database/schema.sql`
- Affected component: Product creation/update and fresh database setup
- Description: Product/store/warranty upper bounds were left to MySQL, and the schema began with the invalid token `usersCREATE`.
- Exploitation scenario: Oversized values trigger database errors instead of deterministic 400 responses; fresh setup fails before creating the database.
- Impact: Avoidable error handling, availability, and deployment failures.
- Evidence: RED tests returned 500 for oversized input and failed the schema's first-statement assertion.
- Root cause: Missing route bounds and accidental schema corruption.
- Fix implemented: Enforced 255-character name/store limits and a 1–3650 warranty range; corrected and tested the schema.
- Tests added: product bound and schema executable-start tests.
- Verification: Focused tests pass with generic validation responses and no persistence call.
- Remaining risk: MySQL migration execution must be verified against the production version.

## [SEC-008] Registration and login leaked account-existence signals

- Severity: Medium
- Status: Fixed
- Category: Authentication / User Enumeration
- Location: `backend/src/routes/registration.js`, `backend/src/routes/authentication.js`
- Affected component: Registration and login
- Description: Registration returned an explicit duplicate-email 409, and unknown-user login skipped bcrypt comparison.
- Exploitation scenario: An attacker distinguishes registered emails through response content or login timing.
- Impact: Account enumeration supporting phishing and credential attacks.
- Evidence: Registration RED tests observed different responses; login RED test observed zero bcrypt comparisons for an unknown account.
- Root cause: Helpful duplicate handling and short-circuit authentication logic.
- Fix implemented: New and duplicate registrations return the same 202/body; login always performs one bcrypt comparison using a valid dummy hash for unknown users.
- Tests added: response equality and bcrypt-call assertions.
- Verification: Registration and login tests pass without exposing account existence.
- Remaining risk: Distributed timing noise was not statistically measured; the principal application-level signal is removed.

## [SEC-009] Security logging was incomplete and password-reset logs were overly verbose

- Severity: Low
- Status: Fixed
- Category: Logging / Audit Trail
- Location: `backend/src/services/auditLogger.js`, authentication/registration/profile/password-reset routes
- Affected component: Security operations and SMTP reset workflow
- Description: Important authentication events were not structured, while SMTP result objects could include recipient/provider metadata.
- Exploitation scenario: Incident responders lack reliable events or logs collect unnecessary personal/provider details.
- Impact: Reduced detection value and privacy/log-injection risk.
- Evidence: Existing password-reset tests displayed verbose SMTP console objects; no shared authentication logger existed.
- Root cause: Ad hoc console logging.
- Fix implemented: Added normalized allowlisted security events containing only event, numeric actor ID when available, outcome, and timestamp. Removed SMTP result logging and added login, logout, registration, reset, and password-change events.
- Tests added: secret and newline-injection exclusion test.
- Verification: Test confirms supplied password, token, email, and CR/LF data are absent from serialized output.
- Remaining risk: Central log transport, retention, access controls, and alert rules require production configuration.

## [SEC-010] Rate limiting and safe React rendering required explicit verification

- Severity: Low
- Status: Mitigated
- Category: Abuse Prevention / XSS
- Location: Authentication/upload routes and React product rendering
- Affected component: Login, registration, reset, invoice endpoints, frontend output
- Description: Controls existed but lacked direct end-to-end assertions for threshold activation and representative stored XSS payloads.
- Exploitation scenario: A future regression removes a limiter or introduces executable rendering.
- Impact: Brute-force exposure or stored XSS regression.
- Evidence: Static review found no `innerHTML`/`dangerouslySetInnerHTML`; route limiters and React text rendering were present.
- Root cause: Test coverage gap rather than a confirmed exploitable implementation defect.
- Fix implemented: Added upload/analysis limits and direct login 429 plus React payload-as-text tests.
- Tests added: `backend/tests/rateLimit.test.js` and XSS case in `frontend/src/ProductsPage.test.jsx`.
- Verification: These tests passed immediately because the relevant base controls already existed; there was no RED failure for those specific cases.
- Remaining risk: Distributed rate limiting across multiple application instances requires a shared limiter store.

## [SEC-011] Dependency and secret controls verified

- Severity: Informational
- Status: Mitigated
- Category: Supply Chain / Secrets
- Location: Repository and lockfiles
- Affected component: Whole project
- Description: Lockfiles are present and no active hard-coded credential was identified in source or the single committed history.
- Exploitation scenario: Not applicable to a confirmed vulnerability.
- Impact: Informational assurance only.
- Evidence: Registry audits returned zero advisories; redacted scans found only blank sensitive-variable placeholders and test/UI password strings.
- Root cause: Not applicable.
- Fix implemented: Expanded `.env.example` with names/default-safe non-secrets for frontend URL and SMTP configuration; `.env` remains ignored.
- Tests added: Not applicable.
- Verification: `git check-ignore .env` succeeds and `git ls-files .env` is empty.
- Remaining risk: Any credential ever shared outside Git must be managed and rotated through deployment secrets; this review cannot validate external systems.

## Security Controls Verified

- Authentication: bcrypt cost 12, generic login errors, constant bcrypt work for unknown users, session regeneration after login, rate limiting, current-password verification.
- Authorization: private routers require a session; product/invoice SQL scopes every owned resource by both resource ID and session user ID; client `user_id` is ignored.
- Database security: reviewed application queries use `database.execute` placeholders; dynamic product sorting is a code allowlist/in-memory comparator; no request value is concatenated into SQL.
- Upload/download security: authentication, upload rate/size limits, exact extension/MIME/signature checks, UUID names, non-public storage, cleanup, path containment, owner checks, attachment downloads, and `nosniff`.
- CSRF/CORS: unsafe methods require an approved Origin; credentialed CORS uses a strict allowlist and rejects wildcard production behavior.
- XSS: React text rendering, no application `innerHTML`/`dangerouslySetInnerHTML`, restrictive CSP, and active-content upload types excluded.
- Sessions: `HttpOnly`, `SameSite=Lax`, production `Secure`, seven-day expiry, login rotation, MySQL production store, logout destruction, reset-time expiry.
- Secrets: environment loading, ignored/untracked `.env`, blank examples, redacted source/history scan.
- Errors: route catches and terminal generic JSON handler; no SQL/database/stack details returned in reviewed paths.
- Logging: structured allowlisted security/product events without passwords, tokens, session IDs, emails, invoice contents, or product notes.
- Headers: CSP, frame ancestors, HSTS only in production, `nosniff`, no-referrer, Permissions-Policy, Helmet cross-origin policies.
- Abuse prevention: login, registration, forgot-password, invoice upload, and invoice-analysis limits; proxy trust is not enabled implicitly.
- API/business logic: allowed fields are selected explicitly; ownership/status/reminder fields are server-derived; pagination is capped; reminder claiming is atomic.
- Dependency security: reproducible lockfiles and zero advisories in both npm audits at review time.
- Not applicable: administrator endpoints/roles, payments/coupons, JWTs, outbound user-supplied URLs/SSRF, command execution, XML/YAML deserialization, and open redirects are not present.

## TDD Evidence

- Initial baseline before audit fixes: backend 17 suites / 74 tests passed; frontend 12 suites / 57 tests passed; Vite build passed.
- RED batch 1: 7 failures across login, password reset, security headers/errors, origins, and products. Causes were skipped bcrypt, non-atomic reset flow, HTML parser response, development HSTS, production localhost fallback, and spoofed upload acceptance.
- GREEN batch 1: 5 suites / 39 tests passed after the focused fixes.
- RED batch 2: oversized product values returned 500 and `usersCREATE` broke the schema assertion.
- GREEN batch 2: 2 suites / 28 tests passed.
- MySQL session store RED: test failed because the store module did not exist. GREEN: 2 store tests passed.
- Audit logger RED: `securityEvent` did not exist. GREEN: logger plus related auth/profile/reset suites passed 14 tests.
- Registration enumeration RED: 4 tests received distinguishable 201/409 responses. GREEN: all 5 registration tests passed with identical 202 responses.
- Reset-session invalidation RED: atomic SQL lacked the session join. GREEN: all 4 reset tests passed after active sessions were expired in the same statement.
- Existing-control tests: rate-limit activation, oversized upload, server-generated filename, and React XSS rendering passed on their first run; they verify existing controls and therefore had no RED failure.

## Verification

- `backend: npm test -- --runInBand` — passed after all changes: 20 suites, 87 tests.
- `frontend: npm test -- --runInBand` — passed after all changes: 12 suites, 58 tests.
- `frontend: npm run build` — passed; Vite transformed 50 modules.
- `backend: npm audit --json` — passed, 0 vulnerabilities.
- `frontend: npm audit --json` — passed, 0 vulnerabilities.
- Local smoke test — API health returned `ok`; frontend returned HTTP 200 with the root element; both temporary processes were stopped.
- `git diff --check` — passed after the final documentation edits (line-ending conversion warnings are informational and produced no diff errors).
- Lint/typecheck — not run because neither package defines a lint or typecheck script.

## Limitations and Recommended Future Work

- Apply and test `database/schema.sql` against the exact production MySQL version, including the JSON session join used during password reset.
- Verify HTTPS termination, production-only HSTS, `Secure` cookies, explicit HTTPS origins, reverse-proxy behavior, and database least-privilege grants in staging.
- Configure a shared rate-limit store when running multiple backend instances.
- Configure central log transport, access control, retention, alerting, and tamper resistance.
- Add malware scanning/quarantine if invoice trust requirements increase; keep image/PDF parser dependencies patched.
- Schedule deletion of expired session and reset-token rows.
- Perform a real-browser authenticated penetration test and concurrent reset test; this review did not run a full external DAST scanner.
- Validate SMTP sender-domain controls (SPF, DKIM, DMARC) and delivery failure monitoring in production.
- Review upload-directory permissions, backup encryption/restore tests, database network exposure, and cloud/storage ACLs in the deployment environment.

## Manual Verification Checklist

1. Start MySQL with the updated schema; confirm `users`, `products`, `password_reset_tokens`, and `sessions` exist.
2. Register the same email twice; confirm both responses and UI messages are indistinguishable, while only one account exists.
3. Attempt 11 rapid login requests; confirm the final response is 429 and no password/token appears in logs.
4. Log in and inspect the cookie: `HttpOnly`, `SameSite=Lax`, seven-day expiry, and `Secure` over production HTTPS.
5. Send POST/PUT/DELETE without Origin and with an attacker Origin; confirm 403. Confirm the configured frontend origin works.
6. Create two users. With User A, change product IDs to User B's ID for read/update/delete and invoice view/download; confirm 404/denial.
7. Upload a real supported invoice, then upload HTML renamed to `.jpg`, an extension/MIME mismatch, a traversal-style name, and a file over 10 MB; confirm only the valid file is accepted and stored under a UUID.
8. Download an owned invoice; confirm authentication, `Content-Disposition: attachment`, correct MIME, and `X-Content-Type-Options: nosniff`.
9. Place `<script>alert(1)</script>` and `<img src=x onerror=alert(1)>` in product text; confirm they display as text and no script executes.
10. Request a reset twice, use the newest link once, replay it, and confirm replay fails. Confirm previously authenticated sessions become invalid after reset.
11. Send malformed JSON; confirm generic JSON without stack trace, SQL text, or filesystem paths.
12. Inspect production headers and CORS from an approved and unapproved origin; confirm strict CSP, Permissions-Policy, HSTS only over production HTTPS, and no wildcard credentialed origin.
13. Run both complete Jest suites, the Vite build, and both `npm audit` commands; record exact outputs for the release.

# Production Readiness Review — 2026-07-18

## [SEC-012] App-factory CSRF origins could remain cached from development

- Severity: Medium
- Status: Fixed
- Category: Production Configuration / CSRF
- Location: `backend/src/middleware/verifyRequestOrigin.js`, `backend/src/app.js`
- Affected component: Production app instances created after module initialization
- Description: CORS accepted the validated production allowlist injected into the app factory, but the CSRF middleware instance had captured the process environment's development allowlist when its module loaded.
- Exploitation scenario: A correctly configured production frontend receives 403 on legitimate state-changing requests after an app is created in a long-lived process/test harness with different initial environment state.
- Impact: Production authentication and mutations become unavailable; security policy differs between CORS and CSRF.
- Evidence: The new production cookie/login integration test initially returned 403 for the exact approved production origin.
- Root cause: Origin configuration was cached in a module singleton rather than passed through the application factory.
- Fix implemented: Added a middleware factory and inject the same validated `Set` used by CORS.
- Tests added: `backend/tests/productionConfig.test.js`
- Verification: Production login now succeeds only for the configured exact origin and writes a Secure/HttpOnly/SameSite session through the MySQL store.
- Remaining risk: Deployed ingress/origin behavior still requires staging verification.

## Production hardening implemented

- Central fail-fast parsing validates production secrets, database settings, exact origins, ports, booleans, numeric limits, proxy hop count, SMTP pairing, upload persistence, and single/multi-instance rate-limit declarations.
- Production HTTPS detection is proxy-aware and bounded; untrusted forwarding headers do not become trusted automatically. Non-HTTPS API requests receive 426, while HSTS remains production-only.
- Added minimal liveness (`/api/health`) and dependency readiness (`/api/ready`) endpoints. Readiness checks only database connectivity and private upload-directory access and exposes no topology/details.
- Added bounded graceful shutdown for SIGTERM/SIGINT/unhandled failures, including scheduler stop, HTTP drain, and database-pool closure.
- Added hourly opportunistic expired-session cleanup without a new timer/open handle.
- Centralized upload path/size and SMTP timeout/TLS parsing. Private file responses now use `private, no-store`, `no-cache`, and disabled range behavior.
- Added an additive migration ledger/runner plus idempotent information-schema checks for reminder columns, reset/session tables, and query-driven indexes. Baseline tables use InnoDB/utf8mb4 Unicode collation.
- Production web replicas do not enable the reminder scheduler by default. One external scheduled `npm run reminders:run` invocation is recommended.
- Added provider-neutral deployment, backup/rollback, manual verification, CI, schema-validation, and syntax-check instructions.

## Production-readiness validation

- Backend Jest: 29 suites, 140 tests passed.
- Frontend Jest: 12 suites, 58 tests passed.
- Frontend Vite build: passed, 50 modules transformed.
- Backend schema validator: passed, 5 required tables found.
- Backend JavaScript syntax: passed.
- Production-mode startup: passed with explicit temporary production configuration.
- Production-mode liveness: HTTP 200, `ok`.
- Production-mode readiness: HTTP 200, `ready` using a non-destructive `SELECT 1` and private-storage access check.
- Real MySQL schema/migration execution: not performed. The configured database target was not proven to be an isolated disposable test database, and no MySQL client was installed.
- HTTPS/proxy: automated Express behavior passed; no real TLS ingress was available.
- Malware scanning: not implemented; recommended unless deployment policy makes it mandatory.
- Multi-instance rate limiting: this build deliberately rejects `MULTI_INSTANCE=true` and `RATE_LIMIT_STORE=shared` until a supported shared-store adapter has been implemented and tested. Production must remain single-instance in the current release.

## Deployment recommendation

**CONDITIONAL GO — Ready for staging after listed configuration steps.**

No code-level deployment blockers were found within the reviewed scope. Before production approval, operators must apply the migration to an isolated staging database, verify backup/restore, test actual HTTPS/proxy/cookie behavior, validate persistent file storage and SMTP, and either remain single-instance or configure a real shared rate-limit store. Full commands and evidence requirements are in `DEPLOYMENT.md`.

## Staging automation follow-up — July 19, 2026

### Finding PR-001 — Hardcoded baseline database target

- Priority: High
- Previous risk: `database/schema.sql` created and selected `warranty_managers`. Importing it while intending to initialize another staging database could modify the wrong schema.
- Fix: Removed database creation/selection from the baseline. The guarded initializer now accepts only an empty, explicitly confirmed staging target and applies the schema through the already selected connection.
- Tests: The schema test was changed first and failed against the hardcoded baseline. The corrected test now requires a target-neutral first statement and passed.

### Deployment automation added

- Explicit deployment-target guards refuse unspecified environments, unconfirmed staging mutation, restore into the active database, and production operations without an operation-specific approval value.
- Read-only migration preview and live information-schema inspection cover required tables, columns, indexes, and foreign keys.
- Staging database behavior verification uses a transaction and rolls back its Arabic/Unicode, product, session, and reset-token test rows.
- Database dump/verification/isolated-restore commands support a local MySQL client or an explicitly selected Docker MySQL container without placing passwords in command arguments.
- Private-file backup and isolated restore use SHA-256 manifests, reject symbolic links, and refuse overwrite.
- A local-only MySQL 8.4 Compose definition binds to loopback and uses an ignored environment file. It was statically validated but not started.
- A deployment smoke command checks HTTPS liveness/readiness and key headers without credentials.

### Validation status

- Guardrail TDD RED: 3 suites failed because `deploymentSafety`, `databaseDeployment`, and `fileBackup` did not exist.
- Focused GREEN: 4 suites and 23 tests passed.
- Target-neutral schema RED/GREEN: the updated security test failed against `CREATE DATABASE`/`USE`, then passed after removal.
- Docker Compose static configuration: passed without starting the engine.
- Mutation refusal: the current unknown local target was rejected before database connection because `DEPLOYMENT_ENV` was absent.
- Docker engine: stopped. No image was pulled, container/volume created, schema executed, backup produced, or remote service changed.
- Live checklist: `docs/STAGING_VERIFICATION.md`.
- Complete local release validation: backend 29 suites/140 tests, frontend 12 suites/58 tests, 54 backend source syntax checks, schema checks, and the Vite build passed. Both dependency audits reported zero vulnerabilities. The frontend clean-install dry run timed out on existing Babel peer warnings, so clean installation remains to be proven by the pending hosted CI run.
- With explicit user approval, an isolated MySQL 8.4 container was created on loopback port 3307 with a new named volume. Generated local secrets remained ignored and undisclosed. Read-only preview/inspection proved the selected staging database is empty and has one pending additive migration; schema initialization and migration remain separately approval-gated.

### Live staging migration result

- The target-neutral baseline initialized successfully against the approved empty database.
- Migration `20260718_production_readiness` applied successfully and its ledger entry was verified. A second run reported it as skipped with nothing pending, proving idempotency.
- Live inspection verified 5 tables, 37 columns, 11 indexes, and 2 foreign keys with no missing required objects.
- Live transactional tests passed for `utf8mb4`, Arabic round trips, product/session rows, atomic reset-token single use, replay rejection, and rollback. A separate query confirmed zero residual test rows.
- Live MySQL exposed uppercase information-schema field names, revealing a false-negative inspector defect. A reproducing RED assertion was added; the inspector now accepts both key casings and its focused test/live inspection pass.
- Docker backup wrappers were corrected before use to address port 3306 inside the container versus host port 3307. New command-construction tests passed. Backup and isolated restore have not yet run and remain separately approval-gated.

### Local backup and isolated restore proof

- With explicit approval, `mysqldump` ran inside the local staging container and produced a protected 7,001-byte dump containing all five application tables.
- The dump was scanned against the generated session secret, application database password, and MySQL root password; none were present. It contains no database creation or switching statements.
- The dump restored into distinct database `warranty_manager_restore_20260719`, never over the source. Schema and source/restore row-count comparison passed: 5 tables, 37 columns, 11 indexes, 2 foreign keys, zero application rows, and one migration-ledger row.
- Private upload backup and isolated restore mechanics passed with a manifest, but the source directory had zero files. Non-empty invoice restoration remains a staging-deployment requirement.
