-- Migration: Add RPC to get field record aggregates to bypass 1,000 row API limit

CREATE OR REPLACE FUNCTION get_field_summary_v2()
RETURNS TABLE (
  field_id UUID,
  total_recorded BIGINT,
  last_tree_no INT,
  last_recorded_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.field_id,
    COUNT(*) as total_recorded,
    MAX(cm.tree_no) as last_tree_no,
    MAX(cm.measured_at) as last_recorded_date
  FROM census_measurements cm
  WHERE cm.field_id IS NOT NULL
  GROUP BY cm.field_id;
END;
$$;
