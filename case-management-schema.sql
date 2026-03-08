-- Case Management Schema

-- Create cases table
CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  pi_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  client_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  
  -- Case details
  case_number VARCHAR(50) UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  case_type VARCHAR(100),
  
  -- Status and progress
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
    'active',
    'investigating',
    'surveillance',
    'analysis',
    'report_writing',
    'completed',
    'archived',
    'on_hold'
  )),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  
  -- Dates
  start_date DATE,
  due_date DATE,
  completion_date DATE,
  
  -- Financial
  estimated_hours DECIMAL(10, 2),
  billable_hours DECIMAL(10, 2) DEFAULT 0,
  hourly_rate DECIMAL(10, 2),
  total_cost DECIMAL(10, 2),
  
  -- Location
  location TEXT,
  
  -- Metadata
  tags TEXT[],
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create case_notes table
CREATE TABLE IF NOT EXISTS case_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  
  -- Note content
  note_type VARCHAR(50) DEFAULT 'general' CHECK (note_type IN (
    'general',
    'observation',
    'interview',
    'evidence',
    'communication',
    'update'
  )),
  title VARCHAR(255),
  content TEXT NOT NULL,
  
  -- Metadata
  is_client_visible BOOLEAN DEFAULT false,
  attachments TEXT[],
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create case_files table
CREATE TABLE IF NOT EXISTS case_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  
  -- File details
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100),
  file_size BIGINT,
  storage_path TEXT NOT NULL,
  
  -- Categorization
  category VARCHAR(50) DEFAULT 'other' CHECK (category IN (
    'photo',
    'video',
    'document',
    'audio',
    'evidence',
    'report',
    'other'
  )),
  description TEXT,
  
  -- Access control
  is_client_visible BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create case_tasks table
CREATE TABLE IF NOT EXISTS case_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  
  -- Task details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Status
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  
  -- Assignment
  assigned_to UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  
  -- Priority
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  
  -- Due date
  due_date DATE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create case_timeline table (activity log)
CREATE TABLE IF NOT EXISTS case_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  
  -- Event details
  event_type VARCHAR(50) NOT NULL,
  event_description TEXT NOT NULL,
  metadata JSONB,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cases_pi ON cases(pi_id);
CREATE INDEX IF NOT EXISTS idx_cases_client ON cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_created ON cases(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notes_case ON case_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_notes_created ON case_notes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_files_case ON case_files(case_id);
CREATE INDEX IF NOT EXISTS idx_files_created ON case_files(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_case ON case_tasks(case_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON case_tasks(completed);

CREATE INDEX IF NOT EXISTS idx_timeline_case ON case_timeline(case_id);
CREATE INDEX IF NOT EXISTS idx_timeline_created ON case_timeline(created_at DESC);

-- Enable RLS
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_timeline ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cases
CREATE POLICY cases_view_own ON cases
  FOR SELECT
  USING (
    auth.uid() = pi_id 
    OR auth.uid() = client_id
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY cases_insert_pi ON cases
  FOR INSERT
  WITH CHECK (auth.uid() = pi_id);

CREATE POLICY cases_update_pi ON cases
  FOR UPDATE
  USING (auth.uid() = pi_id);

-- RLS Policies for case_notes
CREATE POLICY notes_view_case_members ON case_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cases 
      WHERE cases.id = case_notes.case_id 
        AND (
          cases.pi_id = auth.uid() 
          OR (cases.client_id = auth.uid() AND case_notes.is_client_visible = true)
        )
    )
  );

CREATE POLICY notes_insert_case_pi ON case_notes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cases 
      WHERE cases.id = case_notes.case_id 
        AND cases.pi_id = auth.uid()
    )
  );

-- RLS Policies for case_files
CREATE POLICY files_view_case_members ON case_files
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cases 
      WHERE cases.id = case_files.case_id 
        AND (
          cases.pi_id = auth.uid() 
          OR (cases.client_id = auth.uid() AND case_files.is_client_visible = true)
        )
    )
  );

CREATE POLICY files_insert_case_pi ON case_files
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cases 
      WHERE cases.id = case_files.case_id 
        AND cases.pi_id = auth.uid()
    )
  );

-- RLS Policies for case_tasks
CREATE POLICY tasks_view_case_members ON case_tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cases 
      WHERE cases.id = case_tasks.case_id 
        AND (cases.pi_id = auth.uid() OR cases.client_id = auth.uid())
    )
  );

CREATE POLICY tasks_manage_case_pi ON case_tasks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM cases 
      WHERE cases.id = case_tasks.case_id 
        AND cases.pi_id = auth.uid()
    )
  );

-- RLS Policies for case_timeline
CREATE POLICY timeline_view_case_members ON case_timeline
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cases 
      WHERE cases.id = case_timeline.case_id 
        AND (cases.pi_id = auth.uid() OR cases.client_id = auth.uid())
    )
  );

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION update_cases_updated_at();

CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON case_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_cases_updated_at();

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON case_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_cases_updated_at();

-- Function to generate case numbers
CREATE OR REPLACE FUNCTION generate_case_number()
RETURNS TEXT AS $$
DECLARE
  year_code TEXT;
  sequence_num INTEGER;
  case_num TEXT;
BEGIN
  year_code := TO_CHAR(NOW(), 'YY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(case_number FROM 6) AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM cases
  WHERE case_number LIKE 'CASE-' || year_code || '%';
  
  case_num := 'CASE-' || year_code || '-' || LPAD(sequence_num::TEXT, 4, '0');
  
  RETURN case_num;
END;
$$ LANGUAGE plpgsql;

-- Function to log timeline events
CREATE OR REPLACE FUNCTION log_case_event(
  p_case_id UUID,
  p_user_id UUID,
  p_event_type VARCHAR,
  p_event_description TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO case_timeline (case_id, user_id, event_type, event_description, metadata)
  VALUES (p_case_id, p_user_id, p_event_type, p_event_description, p_metadata)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE cases IS 'Cases/investigations managed by PIs';
COMMENT ON TABLE case_notes IS 'Notes and observations for each case';
COMMENT ON TABLE case_files IS 'Files and evidence uploaded to cases';
COMMENT ON TABLE case_tasks IS 'Tasks and checklists for case management';
COMMENT ON TABLE case_timeline IS 'Activity timeline for each case';
