# Stables tracking setup

The dashboard adds a separate **The Stables** tab. Production analytics use their existing tables and calculations. The Stables client reads no form fields; emails continue to go directly to Kit through the existing native form POST.

## Counts

- Visits: anonymous per-tab visits, reused between page loads for up to 30 minutes of inactivity. No persistent person identifier, IP, email, query strings or full referring URL is stored.
- Email submissions: visits with an explicit successful JSON response from Kit, matched to a recent anonymous attempt. Form 9485257 is PDF breakdowns; 9486070 is Workshops. Direct confirmation-page visits and refreshes never count. One visit counts once in the total, even if both forms are submitted.
- Submission rate: submitting visits divided by all tracked Stables visits in the selected start-date period.
- Confirmed subscribers: current active membership of PDF form 9485257 in Kit, all time, unique subscriber IDs. This includes already-confirmed subscribers and is separate from recent submissions. It is not a count of new confirmation clicks or an attributed funnel stage. Cancelled/bounced subscribers are excluded by Kit's active filter.

## Approved publication scope

1. Apply `migrations/stables.sql` to the existing analytics Supabase project. This creates only `public.stables_visits` and `public.stables_events`, their indexes and constraints; enables RLS with no public access; allows the existing service role to insert and read. No old table, row or function is altered.
2. Publish the scoped production-landing-page files: Stables endpoints, report/Kit modules, Dashboard and StablesDashboard, plus optional tests/review setup docs. Keep unrelated Viewerly/local edits out of the publish commit.
3. Publish Stables `analytics.js`, `signup.js`, and the HTML script inclusions. Email delivery uses Kit's existing public form endpoint and its JSON response contract, as used by Kit's published form client. Only HTTP success plus `status: success` permits counting; failures and verification steps do not. The native form remains available as a fallback. Form field values are used only for delivery directly to Kit; analytics never reads or receives them.
4. Pete approved the test signup to hello@petecovington.com. Test visits started with `?analytics=test` are retained but excluded from ordinary totals; `?analytics=on` starts a separate ordinary visit.

Live testing found Kit drops the native `redirect_to` token. The implementation now uses explicit Kit acceptance instead. Confirmation-page visits are page views only. The test confirmation email reached hello@petecovington.com and its link opened `/the-archive.html`.

These measurements rely on browser JavaScript and network access. Native fallback submissions remain uncounted. Current Kit subscriber totals remain separate and include existing subscribers; no browser-to-subscriber matching is claimed.

## Kit setup — secure user handoff required

The server endpoint is `GET /api/stables/kit`, behind the existing dashboard password. It uses:

`GET https://api.kit.com/v4/forms/9485257/subscribers?status=active&per_page=500&slim=true`

It follows `pagination.end_cursor` with `after` and counts unique active subscriber IDs. Only the total and check time leave the server. Personal response fields are neither logged nor stored. Errors return unavailable, not zero or partial counts. Cache lasts 60 seconds per running instance.

Needed: a **Kit V4 API key** belonging to Pete's account, with access to read form subscribers. A V3 key/secret is not compatible with this implementation. No OAuth app or webhook is required. The documentation does not establish a form-only/read-only key scope; the application performs GET requests only, but do not describe the credential itself as read-only.

After specific approval, Pete must enter an existing V4 key (or create one himself under Kit Settings → Developer) into the production-landing-page Vercel project's private server environment variable `KIT_API_KEY`. Never put it in a `VITE_` variable, source file, browser storage, screenshot or chat. Configure only approved deployment environments, then redeploy after publication approval. Do not replace/regenerate existing credentials. No key was generated, retrieved, copied, configured or transmitted during this build. Paid-plan eligibility has not been tested; do not upgrade automatically if Kit blocks API use.

Docs: https://developers.kit.com/api-reference/forms/list-subscribers-for-a-form and https://developers.kit.com/api-reference/authentication

## Local validation

`node --test tests/stables.test.mjs tests/analytics.test.mjs` (the sibling repo is `../the-stables`; use `STABLES_SOURCE` to override the client path).

`npm run build`

`npm run review` serves a synthetic preview at http://127.0.0.1:4175/dashboard with password `preview-only`. External services and form submissions are blocked in this preview. Sample numbers are not live measurements.

## Daily funnel and post log (October 2026)

The Stables panel now has Sydney-calendar daily visits and successful website signups, a manual Instagram post log, exact elapsed 48-hour/168-hour post windows, and bio/Story source totals. A signup is the first accepted website form submission in each anonymous visit. It is not an email confirmation or a unique person. Existing summary cards retain their rolling-period definitions.

Usual daily numbers average eligible full Sydney days in the 28 calendar days before publication. Days overlapping any logged post's first 168 hours are excluded; seven eligible days are required. Expected window counts are daily averages times 2 or 7. They are descriptive comparisons, not causal post conversions. Partial windows show counts so far without a completed comparison. Missing coverage shows unavailable, not zero. No pre-start values are backfilled. Record all relevant posts for a useful baseline.

Apply migrations/stables-funnel.sql once before deploying the dashboard, then migrations/stables-coverage.sql, then publish analytics.js on The Stables. The migration adds a nullable fixed source category to stables_visits plus private stables_posts and stables_reporting tables. No old records are deleted. Comparison coverage starts at 2026-10-14T21:44:13Z (15 October, 8:44 am Sydney), the recorded successful Vercel deployment of verified acceptance tracker commit 276babd. The second migration sets this evidenced start after the initial conservative default. Earlier counts remain in existing summary cards but do not establish this baseline. Tables remain inaccessible to anon/authenticated roles. Post writes require the dashboard password and guard against stale edits.

First-entry source is retained for the anonymous 30-minute tab visit. Only instagram_bio / instagram_story / other are accepted. Older visits retain an unknown source. Full URLs, referrers, arbitrary UTM text, emails and form contents are not stored. The source table uses visits beginning within the displayed Sydney days; accepted signups belong to those visits.

Bio link: https://www.thestables.music/breakdowns.html?utm_source=instagram&utm_medium=bio

Story link: https://www.thestables.music/breakdowns.html?utm_source=instagram&utm_medium=story

The Story link distinguishes Story traffic as a group; it does not claim which individual post caused a signup. No Instagram connection or automated Instagram editing is used.

### Kit confirmation timing

The form subscriber endpoint returns current state, subscriber created_at and form added_at. The latter dates describe record creation and form joining, not confirmation. Changes in the active total are net changes, not new confirmations. No confirmation series is produced from these fields.

Kit's current signed webhook docs offer subscriber.activated, emitted on transition to active, with an event created timestamp (occurrence time, not delivery time). Prospective activation measurement would require webhook availability, a signing secret, duplicate/re-activation handling, and a PDF-form membership check. Activation can include non-confirmation paths, so first double-opt-in confirmation semantics must be verified before labeling anything “new confirmations.” This account's webhook UI currently requests a paid upgrade. No upgrade, new credential, webhook or subscriber-data storage was performed.

Practical current option: use the accepted website signup series and the separately labeled current active form total. If a future confirmed trend is required without webhooks, periodic aggregate snapshots can show net active subscriber change only, with that explicit label; they cannot recover actual confirmation times.

Sources: https://developers.kit.com/api-reference/forms/list-subscribers-for-a-form ; https://developers.kit.com/webhooks/event-types ; https://developers.kit.com/webhooks/delivery-format

Validation: focused Node tests cover exact boundaries, partial/missing windows, baseline exclusions/minimum coverage, Sydney DST, duplicate/test exclusion, auth/stale edits, input validation and source minimization. Local review server uses synthetic data and keeps post edits in memory; it never sends them to Supabase or Kit.
