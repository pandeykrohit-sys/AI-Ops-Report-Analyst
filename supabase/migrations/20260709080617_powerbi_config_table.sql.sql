-- Power BI Configuration Table
CREATE TABLE powerbi_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  workspace_name TEXT,
  tenant_id TEXT,
  client_id TEXT NOT NULL,
  client_secret_encrypted TEXT,
  service_principal_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Published Datasets Table
CREATE TABLE powerbi_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  config_id UUID REFERENCES powerbi_config(id) ON DELETE CASCADE,
  dataset_id TEXT NOT NULL,
  dataset_name TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dataset_id, workspace_id)
);

-- Power BI Reports Table
CREATE TABLE powerbi_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  dataset_id UUID REFERENCES powerbi_datasets(id) ON DELETE CASCADE,
  report_id TEXT NOT NULL,
  report_name TEXT NOT NULL,
  embed_url TEXT,
  web_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE powerbi_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE powerbi_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE powerbi_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for powerbi_config
CREATE POLICY "select_own_config" ON powerbi_config FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_config" ON powerbi_config FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_config" ON powerbi_config FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_config" ON powerbi_config FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for powerbi_datasets
CREATE POLICY "select_own_datasets" ON powerbi_datasets FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_datasets" ON powerbi_datasets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_datasets" ON powerbi_datasets FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for powerbi_reports
CREATE POLICY "select_own_reports" ON powerbi_reports FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_reports" ON powerbi_reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_reports" ON powerbi_reports FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_powerbi_config_user ON powerbi_config(user_id);
CREATE INDEX idx_powerbi_datasets_user ON powerbi_datasets(user_id);
CREATE INDEX idx_powerbi_reports_user ON powerbi_reports(user_id);