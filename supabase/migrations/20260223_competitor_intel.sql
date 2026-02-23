-- Add Apify API key to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS apify_api_key text;

-- Competitor intelligence reports
CREATE TABLE IF NOT EXISTS competitor_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  competitor_handle text NOT NULL,
  posts_analyzed integer NOT NULL DEFAULT 0,
  top_posts jsonb NOT NULL DEFAULT '[]',
  report jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE competitor_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own competitor reports"
  ON competitor_reports FOR ALL
  USING (user_id = auth.uid());
