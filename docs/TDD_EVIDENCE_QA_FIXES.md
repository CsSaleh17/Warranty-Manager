# Exploratory QA fixes: TDD evidence

## RED

- `backend/tests/profile.test.js`: password-change request returned `404` because the authenticated profile password route did not exist.
- `backend/tests/security.test.js`: a request from `http://127.0.0.1:5173` returned `403` because only the configured localhost origin was trusted.
- `frontend/src/DashboardPage.test.jsx`: the dashboard Add Product action called its navigation callback with no add-form intent.

## GREEN

- Added an authenticated password change endpoint which validates all fields, verifies the current bcrypt hash, hashes the replacement password with bcrypt cost 12, and never returns password data.
- Development-only origin allowlisting now accepts the matching localhost and loopback Vite origins for both CORS and state-changing-request verification. Production continues to allow only the explicitly configured origin.
- Dashboard navigation carries an explicit add-form intent; dashboard search includes serial numbers; the product API normalizes category values; and cards present expired products with a positive, clear label.
- Added a dedicated product details view and invoice actions, plus OCR label cleanup before detected values are returned to the editable form.

## REFACTOR / verification

- The focused dashboard, product, profile, security, and product endpoint suites are run after the changes. Full-suite results are recorded in the final handoff.

## Arabic exploratory QA follow-up (2026-07-18)

### Origin / CSRF / CORS

- Test: `backend/tests/security.test.js` covers registration and login from both `http://localhost:5173` and `http://127.0.0.1:5173`, plus rejection of `https://attacker.example`.
- RED: the expanded tests did not fail because the earlier local-loopback fix already covered both authentication endpoints. This is retained as explicit regression coverage, as required when RED cannot be reproduced.
- Implementation: local loopback aliases are accepted only outside production; production remains limited to the configured `FRONTEND_ORIGIN`. The same policy is applied to CORS and state-changing request-origin verification.
- GREEN: `backend/tests/security.test.js` passed in the full backend run.

### Arabic localization, dates, numbers, RTL, and warranty wording

- Test: `frontend/src/ArabicQa.test.jsx`.
- RED: five tests failed. The rendered UI contained `This year`, English table headings, ISO dates, an English comma in the greeting, English product validation, English expired wording, English filter accessibility text, and English Profile content.
- Reason: application-owned strings were hardcoded in Dashboard, Products, Profile, and Product Details; the product validation helper returned English literals; date/number helpers were not used consistently.
- Implementation: application-owned strings now come from i18n; Arabic dates use a Gregorian Arabic locale while API/form values remain ISO; Arabic numerals and punctuation are consistently formatted; expired warranties use `منتهي منذ … يوماً`; user-entered names, stores, serials, filenames, and notes remain unchanged with `dir="auto"`/`bdi` isolation.
- GREEN: `frontend/src/ArabicQa.test.jsx`, Dashboard, Products, App, login, and registration tests passed.

### Dashboard search

- Test: `frontend/src/ArabicQa.test.jsx` and `frontend/src/DashboardPage.test.jsx`.
- RED: a non-match emptied only Recently Added while upcoming products and summary sections remained visible.
- Implementation: entering a query switches Dashboard to one consistent deduplicated results view across the dashboard product datasets, searching name, store, and serial number; a localized accessible empty state is announced.
- GREEN: focused dashboard and Arabic QA suites passed.

### Profile routing and validation

- Tests: `frontend/src/ArabicQa.test.jsx` and `backend/tests/profile.test.js`.
- RED: direct `/profile` navigation rendered Dashboard, browser navigation did not change the visible page, whitespace-only names attempted a request, and Profile feedback remained English.
- Implementation: authenticated route state is derived from the URL and synchronized on `popstate`; Profile navigation writes `/profile`; whitespace names are rejected before the request and by the backend; success appears only after a successful response and is localized.
- GREEN: frontend routing/profile tests and backend profile tests passed.

### Product form, deletion, invoice controls, and accessibility

- Tests: `frontend/src/ArabicQa.test.jsx`, `frontend/src/ProductsPage.test.jsx`, and `frontend/src/ProductsPage.i18n.test.jsx`.
- RED: the form remained mixed with the list, future-date feedback was English, filter Back/Selected and delete confirmation were English, and duplicated English reminder/invoice controls remained in the Arabic DOM.
- Implementation: the list and filters are hidden while the accessible dialog-style add/edit form is open; failed validation preserves form state; field errors use alert semantics; deletion requires a localized native confirmation and cancel leaves data untouched; reminder, invoice, filter, pagination, and product-card controls share one localized implementation.
- GREEN: all product and Arabic QA tests passed.

### Final verification

### Second independent exploratory QA follow-up (2026-07-18)

#### Dashboard search, legacy product presentation, and read-only access

- Tests created first: `backend/tests/dashboard.test.js`, `frontend/src/DashboardPage.test.jsx`, and `frontend/src/localization.test.jsx`.
- RED: Dashboard returned no `searchResults`; the frontend only searched the limited recent/nearest lists; localized duration/date-time helpers did not exist. The focused frontend tests failed with missing serial result and `formatWarrantyDuration is not a function`; backend test received `undefined` search results.
- Implementation: dashboard now performs case-insensitive trimmed server-side matching across every owned product name, cleaned store name, and serial number; product read/save responses remove only an explicit OCR `Name:`/`Store Name:` prefix and normalize controlled categories. Read-only dashboard regression asserts its database operations are SELECT-only. Locale helpers provide Arabic-aware durations and timestamp presentation.
- GREEN: `backend/tests/dashboard.test.js` passed; `frontend/src/DashboardPage.test.jsx` and `frontend/src/localization.test.jsx` passed.

#### Routing and CORS regression coverage

- Tests created/updated first: `frontend/src/App.test.jsx` and `backend/tests/security.test.js`.
- RED: the route test would previously render Dashboard for `/does-not-exist`; the explicit 127 preflight assertion was added because normal request-origin coverage already passed from the earlier fix.
- Implementation: unknown authenticated routes render a localized Not Found page with a Dashboard action; approved loopback preflight is asserted to echo `http://127.0.0.1:5173` with credentials.
- GREEN: `frontend/src/App.test.jsx` passed and `backend/tests/security.test.js` passed.

- Backend: 14 suites, 54 tests passed.
- Frontend: 9 suites, 36 tests passed.
- Frontend production build passed.

## Latest QA retest fixes (2026-07-18)

### Final targeted QA retest (2026-07-18)

- Tests written first: `frontend/src/ProfilePage.test.jsx`, `frontend/src/ProductsPage.test.jsx`, `frontend/src/mobileNavigation.test.jsx`, and `backend/tests/products.test.js`.
- RED: Profile kept a rendered English password error after an Arabic language switch. Product dialogs focused the container instead of Product name, Tab did not advance in React Testing Library, and create operations had no audit entry. The new focused run failed on these assertions.
- Implementation: password feedback stores safe i18n keys rather than translated server text, so the visible message rerenders immediately in either language. Profile loading no longer refetches because of a language change. Product dialogs focus the required input/Cancel action, explicitly cycle Tab and Shift+Tab, and restore focus to a stable opener ID after the DOM is restored. The controlled date handler snapshots the native input name/value before React queues the update. Mobile navigation uses a non-scrolling responsive grid. Product creation now records the same safe metadata-only audit event as update/delete.
- GREEN: focused frontend tests passed (3 suites, 26 tests) and focused backend tests passed (4 suites, 32 tests). Existing OCR normalization fixtures retain label stripping and legitimate-text coverage; password endpoint tests retain bcrypt success and safe structured validation coverage.

### Native Purchase Date reliability retest (2026-07-18)

- Tests updated first: `frontend/src/ProductsPage.test.jsx` covers native ISO input retention, valid add submission, edit preload, and edit submission; `backend/tests/products.test.js` covers create/update/delete and safe mutation audit metadata.
- RED: the new JSDOM `input` test did not fail because the earlier event-value snapshot change already covers synthetic events. The live browser reproduced the actual defect on the then-current control: `fill('2026-07-18')` displayed the date, but submit received an empty `purchaseDate` and displayed `Purchase date is required.`
- Reason: browser-native date entry emitted an input event that did not reliably reach the controlled form state through the existing change-only handler in the live browser path.
- Implementation: retained the accessible native `<input type="date">` and added `onInput={updateForm}` alongside `onChange`, with the handler already snapshotting `name` and `value` before React schedules the state update.
- GREEN: live QA created a disposable product with `2026-07-18`, edited it with preloaded date and saved `2026-07-17`, observed the updated expiration date, and deleted it; the final list returned to zero products. Frontend full suite passed (12 suites, 57 tests), backend full suite passed (17 suites, 74 tests), and the production build passed.

### Local origins and authentication

- Tests created first: `backend/tests/origins.test.js`; registration, login, profile, and security assertions were also expanded.
- RED: the origin test failed because the shared origin configuration module did not exist. Live registration at `http://127.0.0.1:5173` also initially returned `Request origin is not allowed.` because stale Node processes were serving an older build on ports 3000 and 5173.
- Reason: CORS and CSRF origin handling needed one source of truth, and the live ports were owned by pre-fix processes.
- Implementation: `getAllowedOrigins()` accepts only explicitly configured origins in production and adds the matching localhost/127 loopback alias in development. CORS and unsafe-request verification consume the same allowlist; missing and attacker origins remain rejected.
- GREEN: fresh-server registration and login from `127.0.0.1` succeeded and created an authenticated session; backend origin, registration, login, profile, and security tests passed.

### Password feedback and parser safety

- Test created first: `frontend/src/ProfilePage.test.jsx`; `backend/tests/profile.test.js` was expanded for missing-field and wrong-current-password JSON responses.
- RED: two frontend assertions failed because the wrong-current-password response was mapped to a generic message and an HTML response exposed a JSON parser error containing `Unexpected token`/DOCTYPE text.
- Implementation: the Profile form checks the response content type before parsing, maps only known validation errors, and otherwise displays a safe localized message. The backend continues to compare and hash passwords with bcrypt and never returns hashes.
- GREEN: localized wrong-password, safe malformed-response, successful change, and backend validation tests passed. A live isolated account showed the Arabic error, changed successfully, and logged in again with the replacement password.

### Product dates, localization, dialog behavior, and dashboard race handling

- Tests created/expanded first: `frontend/src/localization.test.jsx`, `frontend/src/ProductsPage.test.jsx`, `frontend/src/DashboardPage.test.jsx`, `frontend/src/ArabicQa.test.jsx`, and `backend/tests/products.test.js`.
- RED: seven focused frontend assertions failed: Arabic duration grammar was incorrect, reminder timestamps were raw, and the product dialog did not receive/contain focus or restore focus after Escape. The dashboard race test demonstrated that an older search response could replace newer results. Backend date-boundary coverage was added before implementation and confirmed only today/past writes are attempted.
- Implementation: Arabic and English duration helpers cover 1, 2, 3-10, 11-99, and 100+ forms for days/months/years; timestamps use localized date-time formatting; add/edit and delete dialogs trap focus, close with Escape, restore focus, and block background interaction; Dashboard aborts and ignores stale requests. Mobile navigation is a compact single row and the page itself does not overflow at approximately 375px.
- GREEN: the focused frontend tests passed (5 suites, 32 tests), then the full frontend suite passed (11 suites, 46 tests). The full backend suite passed (17 suites, 73 tests), and the production frontend build passed.

### OCR, categories, and data-integrity audit

- Tests created first: `backend/tests/categories.test.js`; dashboard and product tests retain serial-search, legacy normalization, owner scoping, and SELECT-only read assertions.
- RED: OCR cleanup left `Store:` attached to detected values.
- Implementation: known English and Arabic store-label prefixes are stripped without damaging legitimate names, and legacy category aliases map to the controlled list. Product update/delete routes now emit metadata-only mutation audit events without product content, credentials, or secrets.
- GREEN: category/OCR tests and the full backend suite passed. Code/query review found no read-only mutation path: dashboard/details/list handlers execute SELECT statements only, while writes remain behind authenticated owner-scoped POST/PUT/DELETE routes.
- Browser check at 375 × 812 confirmed `lang="ar"`, `dir="rtl"`, labeled controls within the viewport, and `scrollWidth === clientWidth === 375` on the Arabic authentication view.
