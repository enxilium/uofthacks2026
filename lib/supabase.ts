import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

// Frontend Supabase client for logging user behavior events
// This client is used by the tracking library to insert events
export const supabase: SupabaseClient | null = 
  supabaseUrl && supabaseKey 
    ? createClient(supabaseUrl, supabaseKey)
    : null;

// Log warning in development if Supabase is not configured
if (!supabase && typeof window !== 'undefined') {
  console.warn(
    '⚠️ Supabase not configured. Behavior tracking is disabled.\n' +
    'To enable tracking, create a .env.local file with:\n' +
    'NEXT_PUBLIC_SUPABASE_URL=your-url\n' +
    'NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key'
  );
}

// Types for behavior tracking
export type BehaviorEventType = 
  | 'click'
  | 'scroll'
  | 'page_view'
  | 'page_leave'
  | 'form_focus'
  | 'form_blur'
  | 'button_hover'
  | 'element_hover'
  | 'text_select'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'checkout_start'
  | 'checkout_complete'
  | 'time_on_page'
  | 'rage_click'
  | 'mouse_move';

export interface BehaviorEvent {
  id?: string;
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
  timestamp?: string; // Precise timestamp with milliseconds
  created_at?: string;
  user_agent?: string;
  screen_width?: number;
  screen_height?: number;
  x_position?: number;
  y_position?: number;
}
