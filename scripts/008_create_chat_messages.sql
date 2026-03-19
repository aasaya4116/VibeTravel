-- Chat message persistence for Scout
CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trip_id     UUID        REFERENCES trips(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own chat messages"
  ON chat_messages FOR ALL
  USING (auth.uid() = user_id);

-- Fast lookup by user + trip scope
CREATE INDEX chat_messages_user_trip_idx
  ON chat_messages (user_id, trip_id, created_at);
