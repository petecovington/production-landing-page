# Stables tracking setup

The dashboard adds a separate **The Stables** tab. Production analytics use their existing tables and calculations. The Stables client reads no form fields; emails continue to go directly to Kit through the existing native form POST.

## Counts

- Visits: anonymous per-tab visits, reused between page loads for up to 30 minutes of inactivity. No persistent person identifier, IP, email, query strings or full referring URL is stored.
- Email submissions: visits with a recent form attempt and its matching return token from Kit. Form 9485257 is PDF breakdowns; 9486070 is Workshops. Refreshing, direct confirmation-page visits, wrong tokens and expired attempts do not count. One visit counts once in the total, even if both forms are submitted.
- Submission rate: submitting visits divided by all tracked Stables visits in the selected start-date period.
- Confirmed subscribers: current active membership of PDF form 9485257 in Kit, all time, unique subscriber IDs. This includes already-confirmed subscribers and is separate from recent submissions. It is not a count of new confirmation clicks or an attributed funnel stage. Cancelled/bounced subscribers are excluded by Kit's active filter.

## Approved publication scope

1. Apply `migrations/stables.sql` to the existing analytics Supabase project. This creates only `public.stables_visits` and `public.stables_events`, their indexes and constraints; enables RLS with no public access; allows the existing service role to insert and read. No old table, row or function is altered.
2. Publish the scoped production-landing-page files: Stables endpoints, report/Kit modules, Dashboard and StablesDashboard, plus optional tests/review setup docs. Keep unrelated Viewerly/local edits out of the publish commit.
3. Publish the Stables `analytics.js` and six HTML script inclusions. Existing form actions and email inputs are unchanged. Script sets a same-origin thank-you URL with a random return token only during a valid native form submission.
4. Verify Kit preserves the `redirect_to` return token and returns to the same hostname. **This has only been simulated, not tested with a real signup.** Pete approved a test signup to hello@petecovington.com. Start it with `?analytics=test`; this retains test measurements in the Stables tables and excludes the whole test visit from ordinary dashboard counts. `?analytics=on` starts a separate ordinary visit. If Kit ignores the token, submissions safely remain uncounted. Do not claim production signup tracking is verified until this check passes.

The browser return is evidence of Kit's success redirect, not a signed server-to-server acceptance receipt. It can undercount when JavaScript/storage/network/redirect are blocked. No email or Kit subscriber identifier is needed for this measurement.

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
