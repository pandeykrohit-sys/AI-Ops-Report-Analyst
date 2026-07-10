/*
# Create saved_dashboards table (single-tenant, no auth)

1. New Tables
- `saved_dashboards`
  - `id` (uuid, primary key)
  - `name` (text, not null) - dashboard name
  - `description` (text) - optional description
  - `dashboard_config` (jsonb) - full dashboard configuration including KPIs, charts, filters, data snapshot
  - `brd_mapping` (jsonb) - BRD requirement-to-data mapping
  - `share_token` (text, unique) - token for generating shareable links
  - `created_at` (timestamptz, default now)
  - `updated_at` (timestamptz, default now)

2. Security
- Enable RLS on `saved_dashboards`.
- Allow anon + authenticated CRUD because the data is intentionally shared/public (no-auth app).
- Anyone can read via share_token; anyone can create/update/delete.

3. Indexes
- Index on `share_token` for fast share link lookups.
- Index on `created_at` for listing by date.
*/

CREATE TABLE IF NOT EXISTS saved_dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  dashboard_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  brd_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  share_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_dashboards_share_token ON saved_dashboards(share_token);
CREATE INDEX IF NOT EXISTS idx_saved_dashboards_created_at ON saved_dashboards(created_at DESC);

ALTER TABLE saved_dashboards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_dashboards" ON saved_dashboards;
CREATE POLICY "anon_select_dashboards" ON saved_dashboards FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_dashboards" ON saved_dashboards;
CREATE POLICY "anon_insert_dashboards" ON saved_dashboards FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_dashboards" ON saved_dashboards;
CREATE POLICY "anon_update_dashboards" ON saved_dashboards FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_dashboards" ON saved_dashboards;
CREATE POLICY "anon_delete_dashboards" ON saved_dashboards FOR DELETE
  TO anon, authenticated USING (true);
