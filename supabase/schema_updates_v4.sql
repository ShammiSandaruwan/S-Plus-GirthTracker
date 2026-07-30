-- ============================================================
-- Fix: Prevent FK violation on measurement delete & add undo RPC
-- ============================================================

-- 1. Fix trigger function to use NULL for measurement_id on DELETE
CREATE OR REPLACE FUNCTION log_measurement_event()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO measurement_events (
      measurement_id, event_type, estate, division, field_no, extent,
      tree_no, caliper_reading, girth, girth_cm, operator_name,
      session_id, device_id_hash, local_dexie_id, event_source
    ) VALUES (
      NEW.id, 'insert', NEW.estate, NEW.division, NEW.field_no, NEW.extent,
      NEW.tree_no, NEW.caliper_reading, NEW.girth, NEW.girth_cm, NEW.operator_name,
      NEW.session_id, NEW.device_id_hash, NEW.local_dexie_id, 'device_sync'
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO measurement_events (
      measurement_id, event_type, estate, division, field_no, extent,
      tree_no, caliper_reading, girth, girth_cm, operator_name,
      session_id, device_id_hash, local_dexie_id, event_source
    ) VALUES (
      NEW.id, 'update', NEW.estate, NEW.division, NEW.field_no, NEW.extent,
      NEW.tree_no, NEW.caliper_reading, NEW.girth, NEW.girth_cm, NEW.operator_name,
      NEW.session_id, NEW.device_id_hash, NEW.local_dexie_id, 'device_sync'
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO measurement_events (
      measurement_id, event_type, estate, division, field_no, extent,
      tree_no, caliper_reading, girth, girth_cm, operator_name,
      session_id, device_id_hash, local_dexie_id, event_source
    ) VALUES (
      NULL, 'delete', OLD.estate, OLD.division, OLD.field_no, OLD.extent,
      OLD.tree_no, OLD.caliper_reading, OLD.girth, OLD.girth_cm, OLD.operator_name,
      OLD.session_id, OLD.device_id_hash, OLD.local_dexie_id, 'undo'
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 2. Transactional RPC for undoing a measurement
CREATE OR REPLACE FUNCTION undo_measurement(
  p_estate TEXT,
  p_division TEXT,
  p_field_no TEXT,
  p_extent NUMERIC,
  p_tree_no INT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_measurement_id UUID;
  v_deleted_count INT;
BEGIN
  -- 1. Find and lock the target row to ensure atomicity
  SELECT id INTO v_measurement_id
  FROM public.census_measurements
  WHERE estate = p_estate
    AND division = p_division
    AND field_no = p_field_no
    AND extent = p_extent
    AND tree_no = p_tree_no
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Measurement row not found in Supabase.', 'errorCode', 'NOT_FOUND');
  END IF;

  -- 2. Delete dependent audit rows from measurement_events first
  DELETE FROM public.measurement_events
  WHERE measurement_id = v_measurement_id;

  -- 3. Delete the parent census_measurements row
  DELETE FROM public.census_measurements
  WHERE id = v_measurement_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deletedRowCount', v_deleted_count,
    'deletedId', v_measurement_id
  );
END;
$$;
