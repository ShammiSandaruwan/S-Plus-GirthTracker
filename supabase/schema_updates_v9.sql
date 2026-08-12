-- Migration v9: Role-Based Access Control (RBAC)
-- Adds three-tier roles (superadmin, admin, manager) and estate-scoped assignments
-- with optional time-bounded expiry per estate assignment.

-- 1. Add role column to admin_users
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'manager'
  CHECK (role IN ('superadmin', 'admin', 'manager'));

-- CRITICAL: Grandfather every existing admin as superadmin.
-- Without this, the DEFAULT above silently demotes every current admin
-- to 'manager' with zero estates assigned, locking them out of the dashboard.
-- Review this list before running and adjust individual rows afterward
-- if anyone should actually be admin/manager instead.
UPDATE admin_users SET role = 'superadmin';

-- 2. Junction table for estate assignments
-- Works uniformly for Admin's multiple estates and Manager's single estate
-- (Manager just has exactly one row).
CREATE TABLE IF NOT EXISTS admin_user_estates (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  estate_id     UUID NOT NULL REFERENCES estates(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ,  -- NULL = permanent assignment
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(admin_user_id, estate_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_user_estates_user ON admin_user_estates(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_user_estates_estate ON admin_user_estates(estate_id);

-- Partial index for expiry lookups — most rows will be NULL/permanent
CREATE INDEX IF NOT EXISTS idx_admin_user_estates_expires
  ON admin_user_estates(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE admin_user_estates ENABLE ROW LEVEL SECURITY;
-- No permissive policies — matches admin_sessions/admin_rate_limits precedent.
-- Accessed exclusively via Edge Functions using the Service Role Key.
