# AGENTS.md

## Project

Build the Warranty Manager application based on the requirements in `PRD.md`.

## Tech Stack

- Frontend: React, JavaScript, HTML, CSS
- Backend: Node.js, Express.js
- Database: MySQL
- Testing: Jest, Supertest, React Testing Library

## Development Rules

- Follow `PRD.md`.
- Do not change the technology stack without permission.
- Keep frontend, backend, database, and tests organized in separate folders.
- Write clean and reusable code.
- Do not rewrite unrelated files.
- Make the smallest necessary change for each task.
- Do not claim a feature works unless its tests pass.

## TDD Rules

For every important feature:

1. Write the test first.
2. Run the test and confirm it fails.
3. Write the minimum code required.
4. Run the test until it passes.
5. Refactor if needed.
6. Run all tests again.

Follow:

`RED → GREEN → REFACTOR`

## TDD Evidence

For every feature developed using TDD, record the following:

- The test file created before implementation.
- The initial failing test result.
- The reason the test failed.
- The implementation added to make the test pass.
- The final passing test result.

If the test does not fail during the RED phase, state that clearly and explain why.

If a test remains failing, do not hide it or claim the feature is complete. Document:

- The failing test.
- The error message.
- The suspected cause.
- The attempted fixes.
- The current status.

Keep this information so it can later be added to `README.md` or the final project report.

## Security Rules

- Enforce backend authentication and authorization for every protected action; UI visibility is never authorization.
- Add cross-user read, update, delete, and file-access tests for every user-owned resource.
- Never hardcode passwords, API keys, database credentials, session secrets, or private tokens.
- Store sensitive values in `.env`.
- Never commit the real `.env` file.
- Hash passwords using `bcrypt`.
- Use parameterized MySQL queries to prevent SQL Injection.
- Validate all user input on the backend with explicit types, lengths, ranges, enums, identifiers, and allowed fields.
- Protect against XSS and CSRF.
- Use server-side sessions, rotate the session after login, invalidate it on logout, and use secure HTTP-only cookies.
- Require CSRF protection for every cookie-authenticated state-changing request.
- Protect all private routes.
- Verify that every product belongs to the logged-in user before viewing, editing, or deleting it.
- Do not trust `user_id` received from the frontend.
- Validate uploaded invoices by extension, exact MIME type, file signature, and file size; generate storage names server-side.
- Serve uploaded files only through authenticated owner-checked routes with safe content headers and path containment.
- Reject executable and unsupported files.
- Return generic production errors; never expose stack traces, database errors, filesystem paths, or secrets.
- Log security events using allowlisted metadata only; never log passwords, tokens, session IDs, authorization headers, or sensitive content.
- Add rate limiting to login and registration routes.
- Use Helmet security headers.
- Add authentication, authorization, validation, CSRF, error-handling, and cross-user tests for every new endpoint.
- Review dependency risk and lockfile changes before adding or upgrading packages.
- Use RED → GREEN → REFACTOR for every security fix and record the failing and passing evidence.
- Run `npm audit` and fix high-risk issues when possible.
- Validate all production environment variables at startup and fail closed on missing, placeholder, malformed, or unsafe values.
- Keep reverse-proxy trust explicit and bounded; verify HTTPS detection, Secure cookies, and rate-limit client IPs in staging.
- Make database migrations additive, idempotent where practical, backup-first, and safe for existing user data; never auto-replace production schemas.
- Require an explicit deployment environment for database tooling; refuse unconfirmed staging targets and require operation-specific approval for production changes.
- Keep baseline schemas target-neutral: schema files must not create or switch databases, and initialization must refuse non-empty targets.
- Test backups by restoring into a distinct isolated target; never overwrite the active staging or production database during restore verification.
- Keep private upload storage persistent, outside the public web root, owner-checked, and covered by backup/restore procedures.
- Verify readiness, graceful shutdown, migrations, production build, deployed headers, cookies, origins, and health checks after every deployment.

## Security Review

After the main application features are completed:

- Review at least 80% of the project code for security issues.
- Fix any discovered high-risk issues.
- Document at least one discovered vulnerability and its fix in `SECURITY_REVIEW.md`.

Review for:

- SQL Injection
- XSS
- CSRF
- Broken Access Control
- Exposed Secrets
- Unsafe File Uploads
- Weak Authentication
- Insecure Sessions
- Unprotected Endpoints
- Sensitive Error Messages

Use this format:

```text
Severity:
Location:
Problem:
Risk:
Fix:
Status:
```
