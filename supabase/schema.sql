-- ============================================================
-- GirthTracker Supabase Schema — Phase 1.5
-- Branch: feat/canonical-sync-supabase
-- All tables additive. No destructive changes to existing data.
-- ============================================================

-- ============================================================
-- SHARED UTILITY: updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. MASTER DATA: ESTATES
-- ============================================================
CREATE TABLE estates (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL UNIQUE,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE estates ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_updated_at_estates BEFORE UPDATE ON estates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. MASTER DATA: DIVISIONS
-- ============================================================
CREATE TABLE divisions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estate_id  UUID NOT NULL REFERENCES estates(id),
  code       TEXT NOT NULL,
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (estate_id, code)
);

ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_updated_at_divisions BEFORE UPDATE ON divisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. MASTER DATA: FIELDS
-- ============================================================
CREATE TABLE fields (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estate_id    UUID NOT NULL REFERENCES estates(id),
  division_id  UUID NOT NULL REFERENCES divisions(id),
  field_code   TEXT NOT NULL,
  display_name TEXT,
  extent_ha    NUMERIC(8,2) NOT NULL CHECK (extent_ha > 0),
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (division_id, field_code)
);

ALTER TABLE fields ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_updated_at_fields BEFORE UPDATE ON fields
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enforce estate/division consistency
CREATE OR REPLACE FUNCTION check_field_division_estate()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT estate_id FROM divisions WHERE id = NEW.division_id) != NEW.estate_id THEN
    RAISE EXCEPTION 'Field estate_id must match division estate_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER field_division_estate_check
  BEFORE INSERT OR UPDATE ON fields
  FOR EACH ROW EXECUTE FUNCTION check_field_division_estate();

-- Audit extent changes
CREATE OR REPLACE FUNCTION audit_field_extent_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.extent_ha IS DISTINCT FROM NEW.extent_ha THEN
    INSERT INTO approval_events (event_type, event_data, performed_by)
    VALUES ('field_extent_change', jsonb_build_object(
      'field_id', NEW.id,
      'field_code', NEW.field_code,
      'old_extent', OLD.extent_ha,
      'new_extent', NEW.extent_ha,
      'division_id', NEW.division_id
    ), 'admin');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- NOTE: trigger created after approval_events table exists (see below)

-- ============================================================
-- 4. CONFIG VERSION TRACKING
-- ============================================================
CREATE TABLE config_metadata (
  id         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version    BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO config_metadata (id, version, updated_at) VALUES (1, 1, now());

ALTER TABLE config_metadata ENABLE ROW LEVEL SECURITY;

-- Auto-bump version on any master data change
CREATE OR REPLACE FUNCTION bump_config_version()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE config_metadata SET version = version + 1, updated_at = now() WHERE id = 1;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER estates_config_bump AFTER INSERT OR UPDATE OR DELETE ON estates
  FOR EACH ROW EXECUTE FUNCTION bump_config_version();
CREATE TRIGGER divisions_config_bump AFTER INSERT OR UPDATE OR DELETE ON divisions
  FOR EACH ROW EXECUTE FUNCTION bump_config_version();
CREATE TRIGGER fields_config_bump AFTER INSERT OR UPDATE OR DELETE ON fields
  FOR EACH ROW EXECUTE FUNCTION bump_config_version();

-- ============================================================
-- 5. ACCESS REQUESTS
-- ============================================================
CREATE TABLE access_requests (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id      TEXT NOT NULL UNIQUE,
  estate_code     TEXT NOT NULL,
  operator_name   TEXT NOT NULL,
  device_id_hash  TEXT NOT NULL,
  user_agent      TEXT,
  app_version     TEXT,
  latitude        NUMERIC(12,8),
  longitude       NUMERIC(12,8),
  gps_accuracy    NUMERIC(8,2),
  gps_status      TEXT,
  google_map_link TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','denied','revoked','expired')),
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at     TIMESTAMPTZ,
  denied_at       TIMESTAMPTZ,
  approved_by     TEXT,
  denied_by       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ar_device ON access_requests (device_id_hash);
CREATE INDEX idx_ar_status ON access_requests (status);
CREATE INDEX idx_ar_request_id ON access_requests (request_id);

ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_updated_at_access_requests BEFORE UPDATE ON access_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. APPROVED DEVICES
-- ============================================================
CREATE TABLE approved_devices (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id_hash   TEXT NOT NULL UNIQUE,
  token_hash       TEXT NOT NULL,
  estate_code      TEXT NOT NULL,
  operator_name    TEXT NOT NULL,
  approved_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ,
  revoked          BOOLEAN NOT NULL DEFAULT false,
  revoked_at       TIMESTAMPTZ,
  last_seen_at     TIMESTAMPTZ,
  last_sync_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_estate ON approved_devices (estate_code);
CREATE INDEX idx_ad_revoked ON approved_devices (revoked);

ALTER TABLE approved_devices ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_updated_at_approved_devices BEFORE UPDATE ON approved_devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7. APPROVAL EVENTS (audit log)
-- ============================================================
CREATE TABLE approval_events (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type      TEXT NOT NULL,
  request_id      TEXT,
  device_id_hash  TEXT,
  estate_code     TEXT,
  operator_name   TEXT,
  performed_by    TEXT,
  event_data      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ae_device ON approval_events (device_id_hash);
CREATE INDEX idx_ae_type ON approval_events (event_type);
CREATE INDEX idx_ae_created ON approval_events (created_at);

ALTER TABLE approval_events ENABLE ROW LEVEL SECURITY;

-- Now create the field extent audit trigger (approval_events exists)
CREATE TRIGGER field_extent_audit
  AFTER UPDATE ON fields
  FOR EACH ROW EXECUTE FUNCTION audit_field_extent_change();

-- ============================================================
-- 8. REPLAY-PROTECTION NONCES (persistent)
-- ============================================================
CREATE TABLE request_nonces (
  nonce      TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nonces_expires ON request_nonces (expires_at);

ALTER TABLE request_nonces ENABLE ROW LEVEL SECURITY;

-- Cleanup function (call via pg_cron or scheduled Edge Function)
CREATE OR REPLACE FUNCTION cleanup_expired_nonces()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM request_nonces WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 9. ESTATE SHEET EXPORTS (mapping)
-- ============================================================
CREATE TABLE estate_sheet_exports (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estate_id        UUID NOT NULL REFERENCES estates(id),
  spreadsheet_id   TEXT NOT NULL,
  tab_name         TEXT DEFAULT 'Sheet1',
  active           BOOLEAN NOT NULL DEFAULT true,
  export_mode      TEXT DEFAULT 'field_replace',
  validated        BOOLEAN NOT NULL DEFAULT false,
  validated_at     TIMESTAMPTZ,
  last_exported_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (estate_id)
);

ALTER TABLE estate_sheet_exports ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_updated_at_estate_sheet_exports BEFORE UPDATE ON estate_sheet_exports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 10. CENSUS MEASUREMENTS (original + Phase 1.5 additions)
-- ============================================================
CREATE TABLE census_measurements (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Uniqueness composite key (legacy — kept until field_id backfill)
  estate          TEXT NOT NULL,
  division        TEXT NOT NULL,
  field_no        TEXT NOT NULL,
  extent          NUMERIC(8,2) NOT NULL,
  tree_no         INTEGER NOT NULL,

  -- NEW: managed field reference (nullable until backfill)
  field_id        UUID REFERENCES fields(id),
  extent_at_measurement NUMERIC(8,2),

  -- Measurement data
  caliper_reading NUMERIC(8,4) NOT NULL,
  girth           NUMERIC(8,2) NOT NULL,
  girth_cm        NUMERIC(8,2),

  -- Recommendation & analysis
  recommendation_status TEXT,
  recommendation_text   TEXT,
  abnormal_flag         BOOLEAN DEFAULT false,
  abnormal_reason       TEXT,

  -- GPS
  latitude        NUMERIC(12,8),
  longitude       NUMERIC(12,8),
  gps_accuracy    NUMERIC(8,2),
  gps_status      TEXT,
  google_map_link TEXT,

  -- Operator & session
  operator_name   TEXT NOT NULL,
  session_id      TEXT,
  device_id_hash  TEXT,

  -- Timestamps
  measured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Export tracking
  exported_at     TIMESTAMPTZ,
  export_batch_id TEXT,

  -- Dexie local ID for idempotent sync
  local_dexie_id  INTEGER,

  -- Legacy uniqueness constraint (kept until field_id backfill complete)
  CONSTRAINT uq_tree_in_field
    UNIQUE (estate, division, field_no, extent, tree_no)

  -- NOTE: After successful field_id backfill, apply:
  -- ALTER TABLE census_measurements ALTER COLUMN field_id SET NOT NULL;
  -- ALTER TABLE census_measurements ADD CONSTRAINT uq_field_tree UNIQUE (field_id, tree_no);
);

CREATE INDEX idx_cm_estate_field ON census_measurements (estate, field_no);
CREATE INDEX idx_cm_session ON census_measurements (session_id);
CREATE INDEX idx_cm_exported ON census_measurements (exported_at) WHERE exported_at IS NULL;
CREATE INDEX idx_cm_measured_at ON census_measurements (measured_at);
CREATE INDEX idx_cm_device ON census_measurements (device_id_hash);
CREATE INDEX idx_cm_field_id ON census_measurements (field_id);

ALTER TABLE census_measurements ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_updated_at_cm BEFORE UPDATE ON census_measurements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 11. MEASUREMENT EVENTS (audit log)
-- ============================================================
CREATE TABLE measurement_events (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  measurement_id  UUID REFERENCES census_measurements(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL,

  estate          TEXT,
  division        TEXT,
  field_no        TEXT,
  extent          NUMERIC(8,2),
  tree_no         INTEGER,
  caliper_reading NUMERIC(8,4),
  girth           NUMERIC(8,2),
  girth_cm        NUMERIC(8,2),
  operator_name   TEXT,
  session_id      TEXT,
  device_id_hash  TEXT,

  event_source    TEXT,
  local_dexie_id  INTEGER,
  event_data      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_me_measurement ON measurement_events (measurement_id);
CREATE INDEX idx_me_session ON measurement_events (session_id);
CREATE INDEX idx_me_created ON measurement_events (created_at);

ALTER TABLE measurement_events ENABLE ROW LEVEL SECURITY;

-- Automatic audit log trigger for measurements
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
      OLD.id, 'delete', OLD.estate, OLD.division, OLD.field_no, OLD.extent,
      OLD.tree_no, OLD.caliper_reading, OLD.girth, OLD.girth_cm, OLD.operator_name,
      OLD.session_id, OLD.device_id_hash, OLD.local_dexie_id, 'undo'
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER measurement_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON census_measurements
  FOR EACH ROW
  EXECUTE FUNCTION log_measurement_event();
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
