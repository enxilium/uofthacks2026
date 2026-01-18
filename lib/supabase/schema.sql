-- Supabase SQL Schema for Behavior Tracking & Experiments
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- ============================================
-- BEHAVIOR EVENTS TABLE
-- ============================================

-- Drop existing table if you want to recreate (CAUTION: loses data!)
-- DROP TABLE IF EXISTS behavior_events CASCADE;

-- Create the behavior_events table
CREATE TABLE behavior_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  page_url TEXT NOT NULL,
  page_variant TEXT,
  element_id TEXT,
  element_class TEXT,
  element_text TEXT,
  scroll_depth INTEGER,
  time_on_page INTEGER,
  x_position INTEGER,
  y_position INTEGER,
  metadata JSONB,
  user_agent TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  timestamp TIMESTAMPTZ(3) DEFAULT NOW(), -- Precise timestamp with milliseconds
  created_at TIMESTAMPTZ(3) DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_behavior_events_session_id ON behavior_events(session_id);
CREATE INDEX idx_behavior_events_event_type ON behavior_events(event_type);
CREATE INDEX idx_behavior_events_page_variant ON behavior_events(page_variant);
CREATE INDEX idx_behavior_events_created_at ON behavior_events(created_at);
CREATE INDEX idx_behavior_events_timestamp ON behavior_events(timestamp);

-- Enable Row Level Security (RLS)
ALTER TABLE behavior_events ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows anonymous inserts (for tracking)
CREATE POLICY "Allow anonymous inserts" ON behavior_events
  FOR INSERT
  WITH CHECK (true);

-- Create a policy that allows reading for authenticated users (for analytics)
CREATE POLICY "Allow authenticated reads" ON behavior_events
  FOR SELECT
  USING (true);

-- ============================================
-- EXPERIMENTS TABLE
-- ============================================

-- Create the experiments table for Fluxor AI agent
CREATE TABLE experiments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  change_description TEXT NOT NULL,
  file_path TEXT NOT NULL,
  original_code TEXT,
  new_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'success', 'reverted')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  baseline_metrics JSONB,
  experiment_metrics JSONB,
  result_summary TEXT
);

-- Create indexes for experiments
CREATE INDEX idx_experiments_status ON experiments(status);
CREATE INDEX idx_experiments_created_at ON experiments(created_at);

-- Enable RLS for experiments
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;

-- Allow service role full access to experiments
CREATE POLICY "Allow service role full access" ON experiments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- VIEWS FOR ANALYTICS
-- ============================================

-- Create a view for easier analytics (with precise timestamps)
CREATE VIEW behavior_summary AS
SELECT 
  page_variant,
  event_type,
  COUNT(*) as event_count,
  COUNT(DISTINCT session_id) as unique_sessions,
  AVG(time_on_page) as avg_time_on_page,
  AVG(scroll_depth) as avg_scroll_depth,
  MIN(timestamp) as first_event_at,
  MAX(timestamp) as last_event_at
FROM behavior_events
GROUP BY page_variant, event_type;

-- View for rage click detection (with precise timestamps)
CREATE VIEW rage_clicks AS
SELECT 
  session_id,
  page_variant,
  element_id,
  element_class,
  COUNT(*) as click_count,
  MIN(timestamp) as first_click,
  MAX(timestamp) as last_click,
  EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) * 1000 as duration_ms
FROM behavior_events
WHERE event_type = 'click'
GROUP BY session_id, page_variant, element_id, element_class
HAVING COUNT(*) >= 3 
  AND EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) < 3;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to get conversion funnel data
CREATE OR REPLACE FUNCTION get_checkout_funnel(variant TEXT)
RETURNS TABLE (
  step TEXT,
  session_count BIGINT,
  conversion_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH funnel AS (
    SELECT 
      session_id,
      MAX(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) as viewed,
      MAX(CASE WHEN event_type = 'form_focus' THEN 1 ELSE 0 END) as started_form,
      MAX(CASE WHEN event_type = 'checkout_complete' THEN 1 ELSE 0 END) as completed
    FROM behavior_events
    WHERE page_variant = variant
    GROUP BY session_id
  )
  SELECT 
    'Page Views'::TEXT as step,
    SUM(viewed)::BIGINT as session_count,
    100.0 as conversion_rate
  FROM funnel
  UNION ALL
  SELECT 
    'Started Form'::TEXT,
    SUM(started_form)::BIGINT,
    ROUND(SUM(started_form)::NUMERIC / NULLIF(SUM(viewed), 0) * 100, 2)
  FROM funnel
  UNION ALL
  SELECT 
    'Completed Checkout'::TEXT,
    SUM(completed)::BIGINT,
    ROUND(SUM(completed)::NUMERIC / NULLIF(SUM(viewed), 0) * 100, 2)
  FROM funnel;
END;
$$ LANGUAGE plpgsql;

-- Function to compare variants
CREATE OR REPLACE FUNCTION compare_variants()
RETURNS TABLE (
  variant TEXT,
  total_sessions BIGINT,
  page_views BIGINT,
  form_starts BIGINT,
  completions BIGINT,
  avg_time_seconds NUMERIC,
  rage_click_sessions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    be.page_variant as variant,
    COUNT(DISTINCT be.session_id)::BIGINT as total_sessions,
    COUNT(CASE WHEN be.event_type = 'page_view' THEN 1 END)::BIGINT as page_views,
    COUNT(CASE WHEN be.event_type = 'form_focus' THEN 1 END)::BIGINT as form_starts,
    COUNT(CASE WHEN be.event_type = 'checkout_complete' THEN 1 END)::BIGINT as completions,
    ROUND(AVG(CASE WHEN be.event_type = 'page_leave' THEN be.time_on_page END)::NUMERIC, 2) as avg_time_seconds,
    COUNT(DISTINCT CASE WHEN rc.session_id IS NOT NULL THEN be.session_id END)::BIGINT as rage_click_sessions
  FROM behavior_events be
  LEFT JOIN rage_clicks rc ON be.session_id = rc.session_id
  WHERE be.page_variant IS NOT NULL
  GROUP BY be.page_variant;
END;
$$ LANGUAGE plpgsql;

-- Example usage:
-- SELECT * FROM get_checkout_funnel('checkout');
-- SELECT * FROM get_checkout_funnel('checkout-v2');
-- SELECT * FROM compare_variants();
