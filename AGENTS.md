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

- Never hardcode passwords, API keys, database credentials, session secrets, or private tokens.
- Store sensitive values in `.env`.
- Never commit the real `.env` file.
- Hash passwords using `bcrypt`.
- Use parameterized MySQL queries to prevent SQL Injection.
- Validate and sanitize all user input on the backend.
- Protect against XSS and CSRF.
- Use secure HTTP-only session cookies.
- Protect all private routes.
- Verify that every product belongs to the logged-in user before viewing, editing, or deleting it.
- Do not trust `user_id` received from the frontend.
- Validate uploaded invoices by extension, MIME type, and file size.
- Reject executable and unsupported files.
- Do not expose stack traces, database errors, or secrets to users.
- Add rate limiting to login and registration routes.
- Use Helmet security headers.
- Run `npm audit` and fix high-risk issues when possible.

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
