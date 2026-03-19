-- Layer 1: Milestone pulse reactions at key journey steps
CREATE TABLE IF NOT EXISTS feedback_pulses (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trip_id     UUID        REFERENCES trips(id) ON DELETE SET NULL,
  step        TEXT        NOT NULL, -- 'vibe_saved' | 'trip_created' | 'itinerary_generated'
  reaction    TEXT        NOT NULL, -- 'great' | 'okay' | 'struggling'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedback_pulses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own pulse feedback"
  ON feedback_pulses FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX feedback_pulses_user_idx ON feedback_pulses (user_id, step, created_at);

-- Layer 2: Outcome check after itinerary generation
CREATE TABLE IF NOT EXISTS feedback_outcomes (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trip_id     UUID        REFERENCES trips(id) ON DELETE SET NULL,
  outcome     TEXT        NOT NULL, -- 'works_great' | 'needs_tweaks' | 'not_quite'
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedback_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own outcome feedback"
  ON feedback_outcomes FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX feedback_outcomes_user_idx ON feedback_outcomes (user_id, trip_id, created_at);

-- Layer 3: Scout feedback conversations
CREATE TABLE IF NOT EXISTS feedback_messages (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedback_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own feedback messages"
  ON feedback_messages FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX feedback_messages_user_idx ON feedback_messages (user_id, created_at);
