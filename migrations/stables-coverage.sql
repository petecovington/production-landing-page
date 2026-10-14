-- Use the successful Vercel deployment time of the verified acceptance tracker.
-- Commit 276babd0652baa0cecd04773676d183e3a253d28, success 2026-10-14T21:44:13Z.
-- Deployment: https://vercel.com/pete-covingtons-projects/the-stables/DPyGzVeqSwiranUyqfsizXADvqUk
-- This is deployment evidence, not the time of the first measured visitor.
UPDATE public.stables_reporting SET coverage_start = '2026-10-14T21:44:13Z'::timestamptz WHERE id = 1;
