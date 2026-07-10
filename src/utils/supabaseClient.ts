import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SavedDashboard {
  id?: string;
  name: string;
  description?: string;
  dashboard_config: any;
  brd_mapping?: any;
  share_token?: string;
  created_at?: string;
  updated_at?: string;
}

export async function saveDashboard(dashboard: SavedDashboard): Promise<{ data: SavedDashboard | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('saved_dashboards')
      .insert({
        name: dashboard.name,
        description: dashboard.description || '',
        dashboard_config: dashboard.dashboard_config,
        brd_mapping: dashboard.brd_mapping || {}
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to save dashboard' };
  }
}

export async function listSavedDashboards(): Promise<{ data: SavedDashboard[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('saved_dashboards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to list dashboards' };
  }
}

export async function loadDashboard(id: string): Promise<{ data: SavedDashboard | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('saved_dashboards')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to load dashboard' };
  }
}

export async function loadDashboardByToken(token: string): Promise<{ data: SavedDashboard | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('saved_dashboards')
      .select('*')
      .eq('share_token', token)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to load shared dashboard' };
  }
}

export async function deleteDashboard(id: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('saved_dashboards')
      .delete()
      .eq('id', id);

    if (error) return { error: error.message };
    return { error: null };
  } catch (err: any) {
    return { error: err.message || 'Failed to delete dashboard' };
  }
}

export function generateShareLink(shareToken: string): string {
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?shared=${shareToken}`;
}
