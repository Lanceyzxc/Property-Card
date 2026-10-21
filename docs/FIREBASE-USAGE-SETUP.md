# Connect the Firebase usage panel

The Vercel site includes a read-only `/api/usage` endpoint and a usage panel on
Property Cards and Inventory Tags. Click **System usage** in the sidebar
to open the app's own dialog. It uses the same gray/maroon controls as the rest
of the system, supports Close/Escape/backdrop dismissal, and has its own Refresh
button. It requests usage only while open.
All departments read the same server-provided aggregate metrics. App users do
not need a Google account, Firebase Console access, or their own Monitoring
permissions. The UI makes no external Console redirect and omits browser
credentials when requesting `/api/usage`.
Until credentials are configured, the panel
shows **Not connected**. Existing Firestore saves do not depend on this endpoint.
Save failures and pending changes remain visible in the sidebar even when the
usage dialog is closed.
Pending and rejected inventory field edits are retained in memory across live
snapshot refreshes; only confirmation of the matching write clears that draft.
Leaving or reloading the page can still lose those unsaved edits.

## What it reports

- Monitoring-reported document reads, writes, and deletes for project
  `ucn-property-tag-b7e0a`, database `(default)`.
- Spark **reference limits**: 50,000 reads, 20,000 writes, 20,000 deletes per day.
- The quota period follows midnight in `America/Los_Angeles`, including DST.
- The panel checks every five minutes while visible. It shows last retrieval
  and metric sample time. Monitoring can lag by several minutes, and usage
  reporting can differ from final billing/quota accounting.
- Missing data is **Unknown**, never an invented zero. Failed refreshes may show
  labelled stale data from the same quota day. Previous-day data is discarded.
- 80% triggers a warning; 100% triggers a stronger reference-limit warning.
  These percentages do not disable saves. Firebase confirms each actual save.

The panel does not automatically discover a plan change. If the project leaves
Spark, review `LIMITS` in `lib/firebase-usage.js` and the panel's plan wording
before showing reference percentages. Hosting, bandwidth, and database storage
sizes are outside this panel's scope.

## 1. Grant read-only monitoring access

Use the Google Cloud console for the SAME project as Firebase:

1. Open [APIs & Services](https://console.cloud.google.com/apis/library/monitoring.googleapis.com?project=ucn-property-tag-b7e0a)
   and enable **Cloud Monitoring API** if it is not enabled.
2. Open [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=ucn-property-tag-b7e0a).
   Create a dedicated account named `property-usage-reader`.
3. Grant that account **Monitoring Viewer** (`roles/monitoring.viewer`) on this
   project. It does not need Editor, Owner, or Firestore write permissions.
4. Choose credential delivery. A platform-supported workload identity setup
   with application default credentials is preferable when available. The
   alternative supported by this implementation is a service-account JSON key
   stored as a Vercel server secret. If using that alternative, create a JSON
   key under the dedicated account's **Keys** tab and keep it private.

These are account-owner setup actions. No account, key, role, API setting,
billing setting, or deployment was created or changed by the local code work.
If organization policy blocks JSON keys, do not bypass it; use workload identity.
Do not enable billing or upgrade Firebase merely to configure this integration.
If the account or project rejects monitoring access, the panel remains
unavailable until that access issue is resolved.

## 2. Configure Vercel

In the Vercel project's **Settings → Environment Variables**, add:

| Name | Value |
| --- | --- |
| `FIREBASE_USAGE_PROJECT_ID` | `ucn-property-tag-b7e0a` |
| `FIREBASE_USAGE_DATABASE_ID` | `(default)` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The dedicated account's complete JSON credential, as a secret |

Select the intended environments (Production and, if needed, Preview). For the
JSON value, paste valid JSON including its escaped newline sequences inside
the `private_key` string. Do not wrap the entire JSON object in shell quotes in
the Vercel UI. The credential's `project_id` must match the configured project.

If using preconfigured ADC/workload identity instead, omit the JSON variable and
set `FIREBASE_USAGE_AUTH=adc`. This is an explicit opt-in: the app does not silently
use a developer's unrelated Google login. A Firebase CLI login alone does not
configure ADC for this service.

Keep credentials out of browser JavaScript, source control, screenshots, and
chat. Do not put a credential file anywhere under `public/`, even if Git ignores
it: static hosting would still expose it. Remove/revoke keys that are leaked.

Changes are committed and deployed through `main`, per the owner's preference.
Redeploy after changing environment
variables so the function receives them. `vercel.json` selects the static
`public` output and root `api/usage.js` Node function. The repository must be the
Vercel Root Directory, not `public`, and the Node version is 22.x. Existing
Firebase Hosting workflows only publish static files; they do not provide this
API. The usage panel is intended for the Vercel deployment.

## 3. Validate the live connection

1. Open `https://YOUR-VERCEL-DOMAIN/api/usage`.
2. Confirm `projectId`, `databaseId`, and `periodStart` match the intended
   database/day. A working response uses `status: "available"`; metric `used`
   values are numeric where Google returned samples.
3. Open both the normal home page and `/inventory.html`. Open **System usage**
   using a browser with no Google account signed in. Check the panel and
   existing images, CSS, navigation, and print layout.
4. Compare with Firebase Console for the same database and Pacific day. Allow
   for metric reporting delay and five-minute function-instance caching.
   Reported usage is not a guarantee that an individual save will succeed.

No live-success claim should be made until an authenticated response is observed.
The local test suite uses fixtures and never sends test writes to Firestore.

The production endpoint was checked on 2026-10-21 and returned `unconfigured`.
A read-only check using the locally signed-in Firebase CLI account returned
Google Monitoring HTTP 403: `Permission denied (or the resource may not exist).`
That account cannot currently supply the monitoring data. No Google permission
was granted, no service-account key was created, and no Vercel secret was set.
The owner must configure the dedicated read-only server credentials above;
removing the Console link alone does not enable real metrics.

## Local development

Install packages with `npm ci`. Copy `.env.example` to `.env.local` and configure
server credentials there. For a JSON key in a local dotenv file, wrap the full
single-line JSON object in single quotes so its `\n` escapes are preserved:

```dotenv
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"your-project","private_key":"...","client_email":"..."}'
```

The example above is a format illustration, not a usable key. Never use actual
credentials in documentation. Then run:

```powershell
node --env-file=.env.local server.js
```

`npm start` still works without credentials and shows Not connected. `npm test`
runs service, HTTP, and DOM integration checks. Tests expect no real monitoring
credentials and require no cloud access. Browser layout/print inspection and
Vercel routing need separate verification in their actual environments.

## Response and operational limits

The endpoint permits only GET and ignores user-supplied project or metric query
parameters. It exposes only database-wide aggregate usage, configured reference
limits, and timestamps. The department login is client-side and is not server
authentication; anyone who can reach this endpoint can read those aggregates.
Do not add private records or arbitrary monitoring query parameters to it.

The service caches for five minutes, merges concurrent refreshes within one
function instance, and backs off failed refreshes for one minute. Caches are
per instance, not global; serverless scale-out or cold starts can issue more
Monitoring requests. The request has a ten-second budget and bounded pagination.

| State | Meaning |
| --- | --- |
| `available` | Google returned samples; a metric without samples stays unknown |
| `stale` | Refresh failed; previous same-day values are shown with their old timestamps |
| `unconfigured` | No JSON secret or explicit ADC configuration is present |
| `unavailable` | Auth/API access failed, timeout occurred, pagination exceeded its bound, or no samples are available |

No raw Google error body, access token, or private key is sent to the browser.
For unavailable data, check API enablement, project selection, IAM role,
environment-variable formatting, and deployment environment. A newly inactive
database can have no samples; that is conservatively unknown, not a zero claim.

## Official references

- [Monitor Firestore](https://firebase.google.com/docs/firestore/monitor-usage)
- [Firestore quotas](https://firebase.google.com/docs/firestore/quotas)
- [Monitoring IAM](https://docs.cloud.google.com/monitoring/access-control)
- [Monitoring time-series API](https://docs.cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.timeSeries/list)
- [Firestore metrics](https://docs.cloud.google.com/monitoring/api/metrics_gcp_d_h)
- [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json)
