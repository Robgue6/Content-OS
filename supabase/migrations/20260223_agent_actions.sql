-- Agent action log (records every real action the AI agent takes in the app)
CREATE TABLE IF NOT EXISTS agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  action_type text NOT NULL,   -- 'add_post' | 'add_matrix_idea'
  item_id text NOT NULL,       -- ID of the created item
  item_title text NOT NULL,
  item_meta text NOT NULL DEFAULT '',   -- human-readable meta (date · theme · type)
  chat_context text NOT NULL DEFAULT '', -- first 150 chars of triggering user message
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own agent actions"
  ON agent_actions FOR ALL
  USING (user_id = auth.uid());
