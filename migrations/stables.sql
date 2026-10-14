-- Proposed migration only. Apply after approval, before publishing tracking.
-- Existing public.events and public.sessions are untouched.
BEGIN;
CREATE TABLE public.stables_visits (
  id uuid PRIMARY KEY,
  is_test boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.stables_events (
  id uuid PRIMARY KEY,
  visit_id uuid NOT NULL REFERENCES public.stables_visits(id),
  kind text NOT NULL CHECK (kind IN ('page', 'attempt', 'submission')),
  page text NOT NULL CHECK (page IN ('/', '/breakdowns.html', '/workshops.html', '/confirmation.html', '/workshops-confirmation.html', '/the-archive.html')),
  form_id text CHECK (form_id IN ('9485257', '9486070')),
  attempt_id uuid REFERENCES public.stables_events(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'page' AND form_id IS NULL AND attempt_id IS NULL)
      OR (kind = 'attempt' AND form_id IS NOT NULL AND attempt_id IS NULL)
      OR (kind = 'submission' AND form_id IS NOT NULL AND attempt_id IS NOT NULL))
);
CREATE INDEX ON public.stables_visits(started_at);
CREATE INDEX ON public.stables_events(visit_id);
CREATE UNIQUE INDEX ON public.stables_events(attempt_id) WHERE kind = 'submission';
ALTER TABLE public.stables_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stables_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stables_visits, public.stables_events FROM anon, authenticated;
GRANT SELECT, INSERT ON public.stables_visits, public.stables_events TO service_role;
COMMIT;
