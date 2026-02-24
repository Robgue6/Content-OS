-- ── A/B Content Testing ────────────────────────────────────────────────────

-- Feature flag on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ab_testing_enabled boolean DEFAULT false;

-- ab_tests: one row per experiment
CREATE TABLE IF NOT EXISTS ab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  hypothesis text NOT NULL DEFAULT '',
  variable text NOT NULL,          -- hook | cta | type | theme | script
  variant_a jsonb NOT NULL,        -- { title, content }
  variant_b jsonb NOT NULL,        -- { title, content }
  post_id uuid REFERENCES posts ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planning',  -- planning | live | completed
  winner text,                     -- 'A' | 'B' | null
  winner_reason text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user owns ab_tests" ON ab_tests FOR ALL USING (user_id = auth.uid());

-- ab_test_results: one row per variant per test (deep metrics)
CREATE TABLE IF NOT EXISTS ab_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  test_id uuid REFERENCES ab_tests ON DELETE CASCADE NOT NULL,
  variant text NOT NULL,           -- 'A' | 'B'
  posted_at date NOT NULL,
  views integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  saves integer NOT NULL DEFAULT 0,
  profile_visits integer NOT NULL DEFAULT 0,
  watch_time_seconds integer NOT NULL DEFAULT 0,
  follows integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ab_test_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user owns ab_test_results" ON ab_test_results FOR ALL USING (user_id = auth.uid());
