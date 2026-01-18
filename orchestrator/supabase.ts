import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Orchestrator Supabase client for AI agent monitoring
// This client is used by Fluxor to read behavior data and manage experiments
// Uses service role key for full database access (server-side only)

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;

// Create the orchestrator client with service role for full access
export const orchestratorClient: SupabaseClient | null = 
  supabaseUrl && supabaseServiceKey 
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })
    : null;

if (!orchestratorClient) {
  console.warn(
    '⚠️ Orchestrator Supabase client not configured.\n' +
    'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
  );
}

// ============================================
// Types
// ============================================

export type BehaviorEventType = 
  | 'click'
  | 'scroll'
  | 'page_view'
  | 'page_leave'
  | 'form_focus'
  | 'form_blur'
  | 'button_hover'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'checkout_start'
  | 'checkout_complete'
  | 'time_on_page'
  | 'rage_click';

export interface BehaviorEvent {
  id: string;
  session_id: string;
  event_type: BehaviorEventType;
  page_url: string;
  page_variant?: string;
  element_id?: string;
  element_class?: string;
  element_text?: string;
  scroll_depth?: number;
  time_on_page?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  user_agent?: string;
  screen_width?: number;
  screen_height?: number;
}

export type ExperimentStatus = 'active' | 'success' | 'reverted' | 'pending';

export interface Experiment {
  id: string;
  change_description: string;
  file_path: string;
  original_code?: string;
  new_code?: string;
  status: ExperimentStatus;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  baseline_metrics?: Record<string, unknown>;
  experiment_metrics?: Record<string, unknown>;
  result_summary?: string;
}

export interface AnomalyReport {
  anomaly_type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  affected_page: string;
  suggested_action: string;
  data_points: Record<string, unknown>;
}

// ============================================
// Data Fetching Functions
// ============================================

// Get recent behavior events
export async function getRecentEvents(limit: number = 100): Promise<BehaviorEvent[]> {
  if (!orchestratorClient) return [];
  
  const { data, error } = await orchestratorClient
    .from('behavior_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching events:', error);
    return [];
  }
  
  return data || [];
}

// Get events for a specific page variant
export async function getEventsByVariant(variant: string, since?: Date): Promise<BehaviorEvent[]> {
  if (!orchestratorClient) return [];
  
  let query = orchestratorClient
    .from('behavior_events')
    .select('*')
    .eq('page_variant', variant)
    .order('created_at', { ascending: false });
  
  if (since) {
    query = query.gte('created_at', since.toISOString());
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching events by variant:', error);
    return [];
  }
  
  return data || [];
}

// Get unique sessions since a timestamp
export async function getNewSessions(since: Date): Promise<string[]> {
  if (!orchestratorClient) return [];
  
  const { data, error } = await orchestratorClient
    .from('behavior_events')
    .select('session_id')
    .gte('created_at', since.toISOString());
  
  if (error) {
    console.error('Error fetching new sessions:', error);
    return [];
  }
  
  const uniqueSessions = [...new Set(data?.map(e => e.session_id) || [])];
  return uniqueSessions;
}

// Get behavior summary for analysis
export async function getBehaviorSummary(variant?: string): Promise<Record<string, unknown>[]> {
  if (!orchestratorClient) return [];
  
  let query = orchestratorClient
    .from('behavior_summary')
    .select('*');
  
  if (variant) {
    query = query.eq('page_variant', variant);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching behavior summary:', error);
    return [];
  }
  
  return data || [];
}

// ============================================
// Experiment Management
// ============================================

// Create a new experiment
export async function createExperiment(experiment: Omit<Experiment, 'id' | 'created_at'>): Promise<Experiment | null> {
  if (!orchestratorClient) return null;
  
  const { data, error } = await orchestratorClient
    .from('experiments')
    .insert([{
      ...experiment,
      status: 'pending'
    }])
    .select()
    .single();
  
  if (error) {
    console.error('Error creating experiment:', error);
    return null;
  }
  
  return data;
}

// Update experiment status
export async function updateExperiment(
  id: string, 
  updates: Partial<Experiment>
): Promise<Experiment | null> {
  if (!orchestratorClient) return null;
  
  const { data, error } = await orchestratorClient
    .from('experiments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating experiment:', error);
    return null;
  }
  
  return data;
}

// Get active experiments
export async function getActiveExperiments(): Promise<Experiment[]> {
  if (!orchestratorClient) return [];
  
  const { data, error } = await orchestratorClient
    .from('experiments')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching active experiments:', error);
    return [];
  }
  
  return data || [];
}

// Get all experiments
export async function getAllExperiments(): Promise<Experiment[]> {
  if (!orchestratorClient) return [];
  
  const { data, error } = await orchestratorClient
    .from('experiments')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching experiments:', error);
    return [];
  }
  
  return data || [];
}

// ============================================
// Analytics Helpers
// ============================================

// Detect rage clicks (multiple rapid clicks on same element)
export async function detectRageClicks(sessionId: string): Promise<boolean> {
  if (!orchestratorClient) return false;
  
  const { data, error } = await orchestratorClient
    .from('behavior_events')
    .select('*')
    .eq('session_id', sessionId)
    .eq('event_type', 'click')
    .order('created_at', { ascending: true });
  
  if (error || !data) return false;
  
  // Check for 3+ clicks within 2 seconds on similar elements
  for (let i = 0; i < data.length - 2; i++) {
    const click1 = new Date(data[i].created_at).getTime();
    const click3 = new Date(data[i + 2].created_at).getTime();
    
    if (click3 - click1 < 2000) {
      // Check if same element
      if (data[i].element_id === data[i + 2].element_id || 
          data[i].element_class === data[i + 2].element_class) {
        return true;
      }
    }
  }
  
  return false;
}

// Calculate conversion rate for a variant
export async function getConversionRate(variant: string): Promise<number> {
  if (!orchestratorClient) return 0;
  
  const { data: views } = await orchestratorClient
    .from('behavior_events')
    .select('session_id')
    .eq('page_variant', variant)
    .eq('event_type', 'page_view');
  
  const { data: completions } = await orchestratorClient
    .from('behavior_events')
    .select('session_id')
    .eq('page_variant', variant)
    .eq('event_type', 'checkout_complete');
  
  const uniqueViews = new Set(views?.map(v => v.session_id) || []).size;
  const uniqueCompletions = new Set(completions?.map(c => c.session_id) || []).size;
  
  if (uniqueViews === 0) return 0;
  return (uniqueCompletions / uniqueViews) * 100;
}

// Get average time on page for a variant
export async function getAverageTimeOnPage(variant: string): Promise<number> {
  if (!orchestratorClient) return 0;
  
  const { data, error } = await orchestratorClient
    .from('behavior_events')
    .select('time_on_page')
    .eq('page_variant', variant)
    .eq('event_type', 'page_leave')
    .not('time_on_page', 'is', null);
  
  if (error || !data || data.length === 0) return 0;
  
  const total = data.reduce((sum, e) => sum + (e.time_on_page || 0), 0);
  return total / data.length;
}
