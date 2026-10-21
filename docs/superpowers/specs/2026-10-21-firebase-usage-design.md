# Firebase usage visibility

## Purpose and agreed context

Users need to see whether Firebase usage is approaching a limit and know when
their changes have not been stored. The owner confirmed Vercel hosting and
provided a screenshot identifying the Firebase Spark plan, project
`ucn-property-tag-b7e0a`, database `(default)`.

The current app is static browser JavaScript with direct Firestore access.
The Node server serves local files. There is no monitoring API or trusted
server-side user authentication in the repository.

## Selected approach

Add a Vercel Node function at `/api/usage` with a shared monitoring module
also called by the local Node server. Keep Firestore on Spark. This avoids
requiring Firebase Cloud Functions or upgrading the Firebase plan.

The alternative is a console link with save-error notices only. It needs
no monitoring credentials but cannot show usage inside the app. A browser
counter is unsuitable because it misses other users and external activity.

## Monitoring data and limits

Fetch the project's default database metrics from Cloud Monitoring using
`projects.timeSeries.list`. Use `firestore.googleapis.com/document/` metrics
`read_ops_count`, `write_ops_count`, and `delete_ops_count`, scoped to the
database resource. Sum all relevant label series and follow pagination.
Do not combine legacy metric families with these metrics.

Use the quota day in `America/Los_Angeles`, including daylight-saving changes.
The reviewed Spark reference limits are 50,000 reads, 20,000 writes, and
20,000 deletes per day. Return these as configured Spark reference limits;
do not claim automatic discovery of the project's billing plan or limits.
Document that configuration must be reviewed if the plan changes.

Values are reported monitoring activity, not authoritative remaining quota.
Firestore metrics are sampled and delayed; billing figures can differ.
Return retrieval time, metric sample time, and quota-period start. Never
show missing samples, access failures, or configuration failures as zero.
Missing metric series display as unavailable, conservatively, until live
validation establishes whether a genuine inactive period is involved.

## Server access and response

Use server-only service account credentials for this project, with Monitoring
Viewer access. Prefer platform-supported short-lived credentials when
available; otherwise use an environment secret, never a file under `public`.
Use Google's maintained authentication library. No credentials or upstream
error bodies are returned to the browser or printed in routine logs.

Accept GET only. Project, database, metrics, and time range are fixed by
server configuration, not request parameters. Return aggregate usage only,
without property records, user data, tokens, or service account identity.
Cache successful data for five minutes and coalesce simultaneous requests
per function instance. Apply upstream timeouts and bounded pagination.

The aggregate response is deliberately readable by users of the application;
the existing department gate cannot enforce server authentication. The route
must not accept arbitrary monitoring queries. This scope excludes adding a
new authentication system.

Use explicit response states for available, stale, unconfigured, and
unavailable. Previous valid values may remain visible only with their
timestamp and a stale label. Never carry a previous day's values into the
new quota day. Deployment or credentials that are not configured must yield
an honest unavailable state with a console link.

## User interface and saving

Add a compact shared usage panel to Property Cards and Inventory Tags,
showing reported reads, writes, deletes, configured limits, progress bars,
and last update. Use a warning at 80 percent and a strong warning at or
above the reference limit. Show percentages above 100 without overflowing
bars. Include a brief delayed-data explanation and a Firebase Console link.
Refresh every five minutes while visible. Exclude the panel from printing.

Monitoring percentages do not disable editing or saving. Actual Firestore
write failures determine whether a save failed. Show a persistent notice
when Firebase reports resource exhaustion, and distinguish permission,
network, and unknown failures without asserting every exhaustion error is
the daily quota. Only a confirmed successful write can show Saved.
Do not discard edited values after failure or promise recovery after reload.

Cover property-card saves, inventory edits, and inventory-number assignment
errors. Keep failure notices from being cleared by unrelated successes.
Archive and analytics redesign, Hosting metrics, storage-size estimates,
and automatic retry of failed writes are outside this first change.

## Validation and live acceptance

Use isolated mocked API tests for database filtering, pagination, multiple
label series, missing metrics, API failure, timeout, caching, secret
redaction, and Pacific quota-day boundaries including daylight saving.
Verify frontend available, warning, stale, unconfigured, and save-failure
states without writing test data to production. Run JavaScript syntax checks
and the project's relevant checks.

After configuration, compare the same project/database/period against the
console while allowing for reporting delay. Do not claim live integration
works until a successful authenticated monitoring request has been observed.

## Deployment requirements

Configure Vercel to serve the existing `public` site and the new Node API;
verify both assets and `/api/usage` work under the actual deployment setup.
Enable Cloud Monitoring API and grant the dedicated service account read-only
monitoring access. Put its credentials in Vercel's server environment settings.
Ignore local environment variants and credential files in version control.

No cloud permissions, service accounts, billing settings, or deployment have
been changed. Security-sensitive access changes require action-time approval.
The design can be implemented and tested locally before that setup is done.

## References

- https://firebase.google.com/docs/firestore/quotas
- https://firebase.google.com/docs/firestore/monitor-usage
- https://docs.cloud.google.com/monitoring/api/metrics_gcp_d_h
- https://docs.cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.timeSeries/list
- https://docs.cloud.google.com/monitoring/access-control

## Review status

Owner approved the design on 2026-10-21. Implementation plan prepared at
`docs/superpowers/plans/2026-10-21-firebase-usage.md` for the required plan review.
Implementation has not started.
