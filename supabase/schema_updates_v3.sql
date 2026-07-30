-- ============================================================
-- Fix: deliver the raw device token to the client exactly once.
-- process_telegram_approval() previously generated a raw token that
-- was discarded by its caller (approve-device's Telegram webhook
-- handler) and never reached the requesting device. This adds a
-- short-lived holding column that check-access can read and clear
-- on first read, giving the client its one and only chance to save it.
-- ============================================================

ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS pending_token TEXT;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS token_claimed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION process_telegram_approval(
  p_request_id TEXT,
  p_action TEXT, -- 'approve' or 'deny'
  p_admin_identifier TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_token_raw TEXT;
  v_token_hash TEXT;
BEGIN
  SELECT * INTO v_request
  FROM access_requests
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already processed');
  END IF;

  UPDATE access_requests
  SET status = CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'denied' END,
      updated_at = now()
  WHERE request_id = p_request_id;

  IF p_action = 'approve' THEN
    v_token_raw := gen_random_uuid()::text;
    v_token_hash := encode(digest(v_token_raw, 'sha256'), 'hex');

    INSERT INTO approved_devices (
      device_id_hash, estate_code, operator_name, token_hash, approved_at, revoked
    ) VALUES (
      v_request.device_id_hash, v_request.estate_code, v_request.operator_name, v_token_hash, now(), false
    )
    ON CONFLICT (device_id_hash) DO UPDATE SET
      token_hash = EXCLUDED.token_hash,
      estate_code = EXCLUDED.estate_code,
      operator_name = EXCLUDED.operator_name,
      approved_at = now(),
      revoked = false,
      revoked_at = null;

    -- NEW: stash the raw token so check-access can deliver it once.
    UPDATE access_requests
    SET pending_token = v_token_raw
    WHERE request_id = p_request_id;

    INSERT INTO approval_events (event_type, device_id_hash, estate_code, operator_name, performed_by, event_data)
    VALUES ('device_approved', v_request.device_id_hash, v_request.estate_code, v_request.operator_name, p_admin_identifier, jsonb_build_object('request_id', p_request_id));

    RETURN jsonb_build_object('success', true, 'status', 'approved', 'raw_token', v_token_raw);
  ELSE
    INSERT INTO approval_events (event_type, device_id_hash, estate_code, operator_name, performed_by, event_data)
    VALUES ('device_denied', v_request.device_id_hash, v_request.estate_code, v_request.operator_name, p_admin_identifier, jsonb_build_object('request_id', p_request_id));

    RETURN jsonb_build_object('success', true, 'status', 'denied');
  END IF;
END;
$$;
