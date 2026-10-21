# SDD ledger — plan: docs/superpowers/plans/2026-10-21-firebase-usage.md

Execution: native, approved by owner. Base: 66dc4b1.
Pre-flight: Task 1 UsageResult matches Task 2 response and Task 3 consumer.
Pre-flight: Task 3 token revisions must begin on edit, before debounce.
Pre-flight: Task 4 fixed same-origin route matches Task 2.
Ruling: Use local feature branch feat/firebase-usage in the shared workspace;
Git metadata required sandbox approval, granted. No worktree relocation or
merge; cost is branch isolation without separate filesystem isolation.
Ruling: Use this Windows-readable ledger and native node test commands instead
of bundled Bash bookkeeping scripts, since Bash is not available. Record
verification here; cost is manual bookkeeping.

Task 1: complete. Watched missing-module RED, then 7/7 service tests GREEN.
Verified Pacific boundaries, pagination, missing/zero data, cache, failure,
secret redaction, and token/fetch timeout. npm dependency installed after
sandbox network approval. Added a one-minute failure cooldown to limit retries.

Task 2: complete. Watched missing API module RED, then service/API 12/12 GREEN,
including real local HTTP requests for pages, CSS, GET usage and POST rejection.
Malformed credentials and thrown upstream errors are sanitized.

Task 3: in progress.
Ruling: Use jsdom as a dev-only DOM test environment rather than a bespoke DOM
fixture; real DOM rendering tests catch more integration errors with less test
scaffolding. Cost is a dev dependency, not shipped client code.

Task 3: complete. UI tests failed first for missing component, then actual
main/inventory integration tests failed for missing pending state. Both are
GREEN after implementation; whole suite 20/20, syntax checks and diff check pass.
Task 4: in progress. Official Vercel configuration docs checked: root api/
functions coexist with public/ output; framework null disables autodetection.

Task 4: local implementation complete. npm test 20/20 GREEN, server/API/service
syntax and diff checks pass, local HTTP tests verify pages/assets/API, and
credential/environment filenames are ignored. Setup guide and Vercel config
are prepared. Live activation remains pending owner Google/Vercel access;
no live authenticated request or production deployment has been performed.
Browser layout and print inspection remain unavailable because no browser
surface is connected. Tests run on installed Node 24.13.1; Vercel targets 22.x.

Final review: independent read-only review of 66dc4b1..6210ac5 identified three
Important findings, no Critical or Minor findings. Accepted all three.
Final: fixed incomplete Monitoring response handling — first/later partial-page
and stale-refresh regression tests RED→GREEN, whole suite 24/24.
Final: fixed project scoping — explicit project-selector query assertion
RED→GREEN, whole suite 24/24.
Final: fixed inventory draft rollback loss — actual snapshot-driven DOM tests
for rejected drafts and old-success/new-draft ordering RED→GREEN, suite 24/24.
Final: Ruling: live Vercel routing and authenticated Google comparison remain
unverified because no account/browser connection exists — document as pending,
not success — cost if wrong is deployment/configuration adjustment on activation.
Final: Ruling: actual desktop/mobile/print appearance remains unverified because
no browser is connected; DOM tests cover behavior and CSS excludes printing —
cost if wrong is a layout correction after visual inspection.
Final: Ruling: billing/quota equivalence is not guaranteed; keep the documented
reported-activity labels and require live comparison — cost is approximate
visibility rather than an authoritative remaining-quota counter.

Final runtime verification: `npm exec --yes --package=node@22 -- node --test`
passed 24/24 with zero failures. The review's Node 22 execution gap is resolved.
No deferred minor findings. All three Important findings have RED→GREEN tests.
Code is ready on feat/firebase-usage; cloud activation and actual browser layout
inspection remain pending as described above. No push, merge, or deploy done.
