# Security Review

## Review Scope

Reviewed the backend application, middleware, database configuration, all API routes and services, the database schema, the frontend React pages, and the automated tests. This covers the production application code in `backend/src` and `frontend/src` (approximately 95% of application code), with emphasis on authentication, authorization, queries, sessions, invoice handling, and user-controlled rendering.

## Security Issue

Severity: High

Location: `backend/src/app.js` before the route routers

Problem: Session-authenticated state-changing endpoints accepted requests without validating the browser request origin. A malicious site could submit a cross-site request while a user had an active session.

Risk: An attacker could potentially cause an authenticated user to create, change, or delete application data through CSRF.

Fix: Added `verifyRequestOrigin` middleware for `POST`, `PUT`, `PATCH`, and `DELETE` requests. It only permits the configured `FRONTEND_ORIGIN` (or the local development origin by default) and returns a safe JSON 403 response for missing or untrusted origins. The CORS origin uses the same configuration. The session cookie remains HTTP-only, `SameSite=Lax`, and secure in production.

Status: Fixed and covered by an automated test.

## Verification

`backend/tests/security.test.js` sends a registration request with `Origin: https://attacker.example` and verifies it receives `403` with `Request origin is not allowed.`. The complete backend suite passes after the fix.

## Preventive Controls

- SQL Injection: All reviewed MySQL statements use `database.execute` with placeholder parameters; product identifiers are validated before query use.
- XSS: React renders product and profile values as text; no application use of `innerHTML` or `dangerouslySetInnerHTML` was found. Helmet provides response hardening headers.
- CSRF: Origin validation protects unsafe HTTP methods, and session cookies use `httpOnly`, `SameSite=Lax`, and production-only `secure` settings.
- Broken access control: Protected product and invoice queries include both resource ID and `req.session.user.id`; invoice routes return safe 404 responses for missing or unowned resources.
- Unsafe file uploads: Uploads use an allowlisted extension/MIME policy, a 10 MB limit, UUID filenames, an uploads directory outside source code, basename/path containment checks, and authenticated owner-only view/download routes.
- Session attacks: Login regenerates the session before assigning the user; logout destroys the session; password hashes are not returned in API responses.
- Exposed secrets: Database and session settings load from environment variables; `.env` and uploads are ignored by Git. No hard-coded credentials were found in the reviewed application code.
