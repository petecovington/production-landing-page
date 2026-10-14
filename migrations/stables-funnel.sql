-- Additive only. No deletion or change to production-site analytics.
BEGIN;
ALTER TABLE public.stables_visits ADD COLUMN source text CHECK (source IN ('instagram_bio', 'instagram_story', 'other'));
CREATE TABLE public.stables_posts (
  id uuid PRIMARY KEY,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  url text NOT NULL,
  published_at timestamptz NOT NULL,
  views_48h bigint CHECK (views_48h >= 0),
  views_7d bigint CHECK (views_7d >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.stables_reporting (
  id integer PRIMARY KEY CHECK (id = 1),
  coverage_start timestamptz
);
-- Conservative known-good start is set after verifying the fixed acceptance tracker deployment.
-- Do not infer historical zeroes or reliability from the first recorded visit.
INSERT INTO public.stables_reporting (id, coverage_start) VALUES (1, now());
ALTER TABLE public.stables_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stables_reporting ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stables_posts, public.stables_reporting FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.stables_posts TO service_role;
GRANT SELECT ON public.stables_reporting TO service_role;
COMMIT;
