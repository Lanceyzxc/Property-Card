# Firebase Usage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show reported Firestore usage and visible save failures in the Vercel-hosted property system without upgrading Firebase Spark.

**Architecture:** A shared Node monitoring service feeds a Vercel `/api/usage` function and the local server. A shared browser component displays delayed usage separately from confirmed save outcomes. No production Firestore writes are needed for tests.

**Tech Stack:** CommonJS Node.js, built-in node:test, google-auth-library, vanilla browser JavaScript/CSS, Firebase compat SDK, Vercel Node Functions.

**Spec:** `docs/superpowers/specs/2026-10-21-firebase-usage-design.md`

## Global Constraints

- Project `ucn-property-tag-b7e0a`, database `(default)`.
- Keep Firestore on Spark.
- Use the quota day in `America/Los_Angeles`, including daylight-saving changes.
- 50,000 reads, 20,000 writes, and 20,000 deletes per day.
- Return these as configured Spark reference limits; do not claim automatic discovery of the project's billing plan or limits.
- Cache successful data for five minutes and coalesce simultaneous requests per function instance.
- Never show missing samples, access failures, or configuration failures as zero.
- Monitoring percentages do not disable editing or saving.
- Only a confirmed successful write can show Saved.
- No cloud permissions, service accounts, billing settings, or deployment have been changed.

## Review Focus

- Midnight Pacific with daylight-saving transitions: use the correct quota day and clear old-day cached results (Task 1).
- Incomplete or paginated metrics: preserve unknown values and sum all series without double counting (Task 1).
- Access denied or malformed credentials: disclose no secret or raw upstream body (Task 2).
- Concurrent saves completing out of order: retain failures until the same operation is resolved (Task 3).
- Vercel static output configuration: both `/api/usage` and existing asset/page paths must remain reachable (Task 4).

## File Map

- `lib/firebase-usage.js`: monitoring authentication, day boundaries, queries, aggregation, cache.
- `api/usage.js`: fixed GET-only HTTP contract; reused locally.
- `server.js`: route `/api/usage` before static file handling; export server factory for tests.
- `public/assets/js/system-status.js`: usage panel and operation-specific save notices.
- `public/assets/css/system-status.css`: shared responsive and print-safe styles.
- `public/index.html`, `public/inventory.html`: panel mounts and shared asset inclusion.
- `public/assets/js/main.js`, `public/assets/js/inventory.js`: save-operation state hooks.
- `tests/firebase-usage.test.js`, `tests/usage-api.test.js`, `tests/system-status.test.js`: isolated regression tests.
- `package.json`, `package-lock.json`: auth dependency, test command, supported Node runtime.
- `vercel.json`: verified routing/build configuration for static pages and Node function.
- `.gitignore`, `.env.example`, `docs/FIREBASE-USAGE-SETUP.md`: deployment configuration and credential hygiene.

### Task 1: Monitoring service

**Interfaces:** Export `getQuotaPeriod(now: Date): {start: string, end: string}` and
`createUsageService({fetchImpl, getAccessToken, now, config}): {getUsage(): Promise<UsageResult>}`.
`UsageResult` contains `status`, `projectId`, `databaseId`, `periodStart`,
`fetchedAt`, `sampledAt`, and `metrics`. Each metric has `used: number|null`,
`limit: number`, and `sampledAt: string|null`; metric names are `reads`, `writes`, `deletes`.
Statuses are `available`, `stale`, `unconfigured`, and `unavailable`.

- [ ] Write failing tests in `tests/firebase-usage.test.js`: Pacific midnight in January and July, both DST transition days, and year rollover. Assert UTC start values and no previous-day cache reuse.
- [ ] Run `node --test tests/firebase-usage.test.js`; confirm missing-module/test failure.
- [ ] Implement the period calculation in `lib/firebase-usage.js` using Intl timezone information, without fixed UTC offsets.
- [ ] Write failing tests for two pages and multiple operation labels (assert summed totals), database resource filter, missing metric (assert null), and explicit zero sample (assert zero).
- [ ] Implement fixed `firestore.googleapis.com/document/{read,write,delete}_ops_count` queries with resource type `firestore.googleapis.com/Database` and database label filter. Request FULL points; sum DELTA values once across label series. Follow at most 20 pages per metric, with a 10-second total refresh budget and an abortable fetch.
- [ ] Add GoogleAuth from google-auth-library with monitoring.read OAuth scope. Accept a server-only `GOOGLE_SERVICE_ACCOUNT_JSON` secret or application default credentials; require explicit `FIREBASE_USAGE_AUTH=adc` to opt into ADC. Validate service-account project against configured project. Missing configuration returns unconfigured.
- [ ] Write failing tests for simultaneous refresh coalescing, five-minute expiry, failed refresh with same-day prior data (stale), new-day failure (unavailable), API timeout, and pagination overflow. Errors must never turn into success or zero values.
- [ ] Implement cache and safe error states. No Firestore queries or writes; no mock values outside tests. Add auth dependency and lockfile, `npm test` using `node --test`, and Node 22 runtime support.
- [ ] Run `node --test tests/firebase-usage.test.js`; require all assertions pass.
- [ ] Review diff; commit only this task's files with `feat: add Firestore usage monitoring service`.

### Task 2: Vercel and local usage endpoint

**Interfaces:** `api/usage.js` exports `(req, res): Promise<void>`, backed by one module-scoped service.
`server.js` exports `createServer(): http.Server` and only starts listening when run directly.
GET responses expose only UsageResult. Unsupported methods return 405 with Allow GET.
An unconfigured or unavailable response returns 503; stale or available returns 200.

- [ ] Write failing `tests/usage-api.test.js` cases for GET success, 405, 503, stale response, and query parameters failing to alter project/database/time-range selection.
- [ ] Run `node --test tests/usage-api.test.js`; verify failure before implementation.
- [ ] Implement `api/usage.js` with JSON responses, no-store browser caching, fixed server configuration, and sanitized failures. Export an injectable `createUsageHandler(service)` for tests as a property on the handler.
- [ ] Add the local `/api/usage` route before `server.js` static handling, retaining current startup and port fallback behavior.
- [ ] Test malformed credential contents, upstream 403 containing a secret marker, and thrown auth errors. Assert marker, private_key, access tokens, and raw upstream bodies never occur in response or logged text.
- [ ] Add local HTTP tests on an ephemeral port for index page, CSS assets, usage route, and unsupported method. Close test servers after completion.
- [ ] Run `node --test tests/firebase-usage.test.js tests/usage-api.test.js`; require all pass.
- [ ] Review diff; commit only this task's files with `feat: expose safe usage endpoint locally and on Vercel`.

### Task 3: Shared usage panel and save outcomes

**Interfaces:** `window.SystemStatus` exposes `beginSave(key): token`,
`saveSucceeded(token): void`, and `saveFailed(token, error): void`.
Tokens contain an operation key and monotonically increasing revision.
The module mounts itself into `[data-system-status]` and fetches `/api/usage`.

- [ ] Write failing `tests/system-status.test.js` using node:vm and a small DOM/fetch fixture. Assert available totals, 80-percent warning, values above 100 percent with bounded bars, missing values, stale/unconfigured messages, and failed request preserving an explicitly stale same-day result only.
- [ ] Run `node --test tests/system-status.test.js`; verify missing-module failure.
- [ ] Implement `public/assets/js/system-status.js`: use textContent for dynamic values, one refresh on startup, refresh every 300000 ms while visible, and one refresh on returning to visible. Abort stalled requests and prevent overlap.
- [ ] Add `public/assets/css/system-status.css` with responsive rows, accessible status text, visible focus styling, warning/error colors, and print exclusion. Include the stylesheet, mount, and script in Property Cards and Inventory Tags before existing page scripts.
- [ ] Add tests for overlapping operations: card A fails and card B succeeds (A remains failed); older success for A cannot clear newer failed revision; failed save is never labelled Saved. Distinguish resource-exhausted, permission-denied, offline/unavailable, and unknown failures.
- [ ] Add hooks around main.js card writes, inventory.js edit writes, and inventory-number assignment. Capture edits as pending immediately rather than retaining a Saved label during debounce. Retain unsaved edit values and never infer daily quota failure solely from metrics or resource-exhausted.
- [ ] Verify older completion results cannot overwrite newer revisions; unrelated load/status calls cannot clear failures. UI explicitly warns unsaved values can be lost on reload.
- [ ] Run `npm test` and `node --check` on both changed page scripts and the shared status module; require pass.
- [ ] Review diff; commit only this task's files with `feat: show reported Firebase usage and unsaved changes`.

### Task 4: Deployment setup and end-to-end verification

**Interfaces:** Production endpoint remains same-origin `/api/usage`.
Server env: `FIREBASE_USAGE_PROJECT_ID=ucn-property-tag-b7e0a`,
`FIREBASE_USAGE_DATABASE_ID=(default)`, and the Task 1 auth configuration.
The browser receives no environment secrets.

- [ ] Check official Vercel documentation for current Node function plus public-directory deployment behavior before writing `vercel.json`. Configure routes so functions take precedence and ordinary pages/assets retain their existing URLs. Do not alter existing Firebase deploy workflows.
- [ ] Add `.env.example` containing names and empty secret placeholders only. Extend `.gitignore` for local env variants and clearly named service-account credential files, preserving `.env.example` tracking.
- [ ] Write `docs/FIREBASE-USAGE-SETUP.md` with Cloud Monitoring API enablement, dedicated Monitoring Viewer service-account setup, Vercel environment settings, local secret setup, quota reference maintenance, deployment checks, and reporting-delay limits. Do not request credentials pasted into chat.
- [ ] Document that the endpoint exposes only aggregate usage, is not protected by the client-side department gate, and must not expose arbitrary monitoring queries. Describe caching as per-instance rather than a global guarantee.
- [ ] Run `npm test` and syntax checks for server, endpoint, service, main.js, inventory.js, and shared status module. Inspect final diff for credentials and unexpected changes.
- [ ] Start the local server and confirm static pages/assets and honest unconfigured API output. If browser access is available, inspect desktop/mobile panel and print exclusion; otherwise report visual verification as unavailable.
- [ ] Review diff; commit only this task's files with `docs: configure Firebase usage monitoring on Vercel`.
- [ ] Request action-time approval before creating a service account, granting monitoring access, or adding credentials to the hosting environment. These actions remain dependent on authenticated console access.
- [ ] After authorized cloud setup and deployment, verify an authenticated API response, compare matching database/day with console allowing for lag, and verify live asset/API URLs. If cloud access remains unavailable, report the integration as locally verified and awaiting configuration, never live-connected.

## Self-review

The tasks cover spec requirements for metric scoping, Pacific dates, pagination,
missing data, caching, secret handling, Vercel/local routing, warnings, save
outcomes, and deployment documentation. Review-focus cases have explicit owning
tests. External setup is separated from local implementation and does not block
mocked tests or truthful unconfigured behavior.

## Execution handoff

Recommend native execution in this session: four sequential tasks share a small
number of interfaces and can be validated without production writes. The owner
must review this plan and select the execution approach before product code is
changed, as required by the planning workflow.
