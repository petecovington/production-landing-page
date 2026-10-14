# Analytics measurement repair — local review only

Prepared 14 October 2026. Nothing has been deployed, committed, pushed, or migrated. No historical rows were deleted. No production enquiries or events were sent in testing.

## Review safely

Use existing installed dependencies; no new packages are required.

```sh
npm test
npm run build
npm run review
```

Open http://127.0.0.1:4173/dashboard and use the **synthetic** preview password `preview-only`. This is not a production credential. The review server binds only to loopback, rejects all writes, serves mock analytics, and supplies a Content Security Policy that blocks external scripts, frames, fonts, media and requests. The landing page at `/` is also available for visual inspection. External review widgets/Spotify will be absent by design. Do not submit a real enquiry during review. Mocked tests cover the actual Formspree helper.

The existing uncommitted Viewerly additions in `index.html` and `src/App.jsx` are deliberately preserved. **They are not part of this proposed measurement change, and must not be deployed accidentally.** Their scripts are blocked by the isolated review server. Ordinary `npm run dev`/preview does not supply this isolation. A later decision to remove/disable the preserved Viewerly changes is still required; this patch does not cancel or alter any account.

## Changes

- Browser and server share an event/metadata allowlist. Name/email/music link/message values and arbitrary error text are never written by the new analytics. Cached legacy clients' `metadata.value` is stripped at the server. Report queries project only approved JSON metadata properties and never retrieve historical field contents. The form-entry panel is removed; historical contents remain in the database pending a separate retention decision.
- Formspree destination, method, headers and actual enquiry body are unchanged. New events distinguish Started, field Progress, Attempt, Accepted and Error. Each attempt has a random ID. The report sorts by per-visit sequence, matches outcomes to attempts, deduplicates visits, and treats optional field progress as independent rather than a required sequence. Acceptance is not verified delivery, spam filtering or lead qualification.
- Read queries use stable ID cursors until empty, even when the database imposes a smaller response cap. Database failures and query-budget exhaustion return errors instead of partial/zero totals. There is a 200-page budget per table (up to 100,000 rows with the requested 500-row page size); larger workloads need server aggregation later. The obsolete event-count RPC is no longer called; dashboard counts come from events, and the legacy `sessions.event_count` column is no longer maintained.
- New events carry `measurement_version: 2` and a monotonic sequence within one page visit. Foreground time requires a visible, focused document. Checkpoints occur every 15 seconds while foreground, on focus/visibility changes, section/media transitions and pagehide; requests use keepalive. Cumulative values and sequence ordering avoid double counting and out-of-order overwrites without a schema change. StrictMode setup/cleanup does not duplicate visit creation or listeners. A page reload starts a new visit, as before.
- V2 sessions start with unknown bounce status. Only a recorded final exit without engagement can be classified as bounced. Positive interaction or 30 seconds of foreground time can classify a non-bounce before exit. Missing observations are Unknown, not zero. Timing/scroll denominators and UTC reporting cutoffs are visible. Duration is sampled foreground presence, not proof of attention; lifecycle delivery remains best effort.
- Section reports count distinct visits and cumulative foreground visibility. Exposure events record which randomly selected example card actually entered view and its position. Actual media `playing` events distinguish demo/produced versions; playback duration excludes pauses, buffering and background windows. Rebuffer/resume can generate another play-start event. Spotify iframe focus is explicitly labelled focus, not playback. No A/B experiment or assignment logic was added.
- Session writes retain referral origin only and use existing Vercel country/city headers. The previous third-party IP lookup is removed; raw UA, exact location/ISP and language/timezone are no longer stored by new clients/API. Existing raw values are not deleted. Traffic attribution remains approximate; UTM identifiers must use the supported alphanumeric/space/underscore/dot/hyphen vocabulary.

## Internal testing exclusion

Visit the landing page with `?analytics=off` **before testing**. It sets a persistent browser-local exclusion for this origin; no custom analytics session/events are sent on that load or subsequent loads. Use `?analytics=on` on a later page load to re-enable. Repeat per browser/profile/origin; storage denial limits persistence. Localhost/127.0.0.1 and automated browsers are excluded automatically. These controls affect this custom collector only, not the separately preserved Viewerly code. Existing recent visitors are not retrospectively marked internal. No historical traffic was deleted.

## Historical and reporting limitations

V2 timing/audio/sections and ordered enquiry funnel are displayed separately from historical event counts. Old background time, merged recordings, duplicated blur counts and missing lifecycle events cannot be reconstructed. Query pagination can recover stored rows omitted by the old report, but cannot recover events that were never stored. Old raw form contents remain stored but are neither queried nor displayed by this report.

Reports include visits **starting** inside the rolling window and their events through a fixed cutoff. Events without a matching in-window session are excluded and counted diagnostically. A visit starting before the cutoff is not reassigned into the new period. Visitor IDs are browser identifiers, not people. Random example exposure is not experiment allocation. No traffic is automatically deemed internal, genuine, spam or qualified.

## Configuration / migration / later approval

No SQL migration is required: snapshots and version markers use existing `events.metadata` and the existing nullable `sessions.is_bounce`. Existing environment variable names remain `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ANALYTICS_PASSWORD`; no values were opened or changed. Real Vercel/Supabase schema permissions and production writes were not tested. Review actual schema compatibility, API/function packaging and auth in an approved staging environment before any production rollout.

Deploying backend and frontend together is important. Cached legacy pages remain accepted with privacy filtering, but cannot produce the new measurements. Keepalive cannot guarantee delivery after crashes, OS termination or network loss. Failed requests produce a generic browser warning without payloads; there is no persistent queue or third-party error tracker. Public ingestion remains unauthenticated as before; bot filtering is a heuristic, not abuse prevention. Stronger abuse controls/authentication and any historical-data retention/deletion are separate decisions.

## Validation

23 tests use injected clocks, browsers, requests and databases. Coverage includes content stripping, HTTP/network Formspree outcomes, analytics failure isolation, ordered/deduplicated funnels, incomplete legacy data, out-of-order cumulative checkpoints, hidden/background timing, bfcache lifecycle, internal exclusion, example exposure, audio versions, pagination beyond 1,000 rows, server error responses and JSON projection. Production build passes; the repository has no lint script/configuration. Existing Browserslist data emits an age warning; no dependencies were updated. Local synthetic dashboard and landing page are inspected using the user's Chrome browser under the blocking CSP.


## Spotify Hear more addition

Official documentation checked 14 October 2026: [iFrame API](https://developer.spotify.com/documentation/embeds/references/iframe-api) documents `playback_started` for tracks in playlists and albums; [setup guide](https://developer.spotify.com/documentation/embeds/tutorials/using-the-iframe-api) documents controller creation. The same existing playlist is rendered through that official controller, with the ordinary iframe as fallback when the SDK cannot load. There is no autoplay, OAuth, Web Playback SDK, account lookup, private API or undocumented message inspection.

Per visit, the collector sends at most one event for each of Exposed, Focus, Ready, Unavailable and Playback started. Focus remains an interaction proxy. Only an official `playback_started` callback produces an API-reported playback-start measurement. Player visibility is measured separately from the whole `listen` section. Anonymous visit summaries show observed signals, referral origin/device and whether an accepted enquiry occurred later in sequence. They do not reveal names, emails, Spotify account identity, playingURI or track history. Association with a later enquiry is not proof of causation.

SDK blocking, delayed readiness, browser restrictions and preview-only playback affect coverage. Ready and Unavailable can both occur if initial readiness times out before recovering. A missing API-start event means unobserved playback, not proof no listening happened. There is no claim of completed plays, exact Spotify listening duration or activity after leaving for Spotify. Runtime behaviour of the real Spotify service is not verified here; tests inject a mock official controller and local review blocks Spotify entirely. The production URL is unchanged until a separately approved deployment.
