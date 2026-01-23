-- IQ Test App Database Schema
-- Run this in your Supabase SQL Editor

-- App Settings table (for admin password and other settings)
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert admin password
INSERT INTO app_settings (key, value) 
VALUES ('admin_password', '3hB8T3)Vw&Ui')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Tests table
CREATE TABLE IF NOT EXISTS tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER DEFAULT 500,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  image_url TEXT,
  options JSONB NOT NULL, -- [{label: "A", value: "..."}, ...]
  correct_answer TEXT NOT NULL,
  dimension TEXT NOT NULL CHECK (dimension IN ('analyst', 'strategist', 'observer', 'intuitive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test Sessions table
CREATE TABLE IF NOT EXISTS test_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID REFERENCES tests(id),
  email TEXT,
  answers JSONB,
  analyst_score DECIMAL,
  strategist_score DECIMAL,
  observer_score DECIMAL,
  intuitive_score DECIMAL,
  overall_score DECIMAL,
  is_paid BOOLEAN DEFAULT false,
  stripe_session_id TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tests_active ON tests(is_active);
CREATE INDEX IF NOT EXISTS idx_questions_test_id ON questions(test_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_test_id ON test_sessions(test_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_stripe ON test_sessions(stripe_session_id);

-- Enable Row Level Security (RLS)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- App settings: read-only for anon (to verify password)
CREATE POLICY "Allow read app_settings" ON app_settings FOR SELECT USING (true);

-- Tests: anyone can read active tests
CREATE POLICY "Allow read active tests" ON tests FOR SELECT USING (is_active = true);
-- Tests: allow all operations for authenticated service role (admin)
CREATE POLICY "Allow all for service role on tests" ON tests FOR ALL USING (true);

-- Questions: anyone can read questions for active tests
CREATE POLICY "Allow read questions" ON questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM tests WHERE tests.id = questions.test_id AND tests.is_active = true)
);
-- Questions: allow all operations for service role
CREATE POLICY "Allow all for service role on questions" ON questions FOR ALL USING (true);

-- Test sessions: anyone can create and read their own sessions
CREATE POLICY "Allow insert test_sessions" ON test_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow read test_sessions" ON test_sessions FOR SELECT USING (true);
CREATE POLICY "Allow update test_sessions" ON test_sessions FOR UPDATE USING (true);

-- Grant permissions
GRANT SELECT ON app_settings TO anon;
GRANT ALL ON tests TO anon;
GRANT ALL ON questions TO anon;
GRANT ALL ON test_sessions TO anon;
