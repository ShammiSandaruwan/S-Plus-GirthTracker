-- ============================================================
-- 1. ADMIN SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_sessions (
  sid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_identifier TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_sid ON admin_sessions(sid);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_revoked ON admin_sessions(revoked_at);

ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
-- No policies because this is strictly accessed by Edge Functions using Service Role Key

-- ============================================================
-- 2. TOTP RATE LIMITS
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_rate_limits (
  ip_address TEXT NOT NULL,
  admin_identifier TEXT NOT NULL,
  failed_attempts INT NOT NULL DEFAULT 1,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ip_address, admin_identifier)
);

ALTER TABLE admin_rate_limits ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. ATOMIC TELEGRAM CALLBACK RPC
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
  v_device_id UUID;
BEGIN
  -- 1. Lookup and lock the pending request
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

  -- 2. Update request status
  UPDATE access_requests 
  SET status = CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'denied' END,
      updated_at = now()
  WHERE request_id = p_request_id;

  -- 3. If approved, generate tokens and insert into approved_devices
  IF p_action = 'approve' THEN
    -- In PostgreSQL, we can generate a random UUID to act as the RAW token.
    v_token_raw := gen_random_uuid()::text;
    
    -- We hash it using pgcrypto for storage.
    v_token_hash := encode(digest(v_token_raw, 'sha256'), 'hex');

    -- Insert/Update device
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

    -- Create audit event
    INSERT INTO approval_events (event_type, device_id_hash, estate_code, operator_name, performed_by, event_data)
    VALUES ('device_approved', v_request.device_id_hash, v_request.estate_code, v_request.operator_name, p_admin_identifier, jsonb_build_object('request_id', p_request_id));

    RETURN jsonb_build_object('success', true, 'status', 'approved', 'raw_token', v_token_raw);
  ELSE
    -- Create audit event for denial
    INSERT INTO approval_events (event_type, device_id_hash, estate_code, operator_name, performed_by, event_data)
    VALUES ('device_denied', v_request.device_id_hash, v_request.estate_code, v_request.operator_name, p_admin_identifier, jsonb_build_object('request_id', p_request_id));

    RETURN jsonb_build_object('success', true, 'status', 'denied');
  END IF;
END;
$$;
