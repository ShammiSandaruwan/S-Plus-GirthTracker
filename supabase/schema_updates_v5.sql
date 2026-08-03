-- Migration: Create admin_users table for Supabase Auth admin role gating

CREATE TABLE IF NOT EXISTS admin_users (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_uid   UUID NOT NULL UNIQUE,  -- references auth.users(id)
  email      TEXT NOT NULL,
  name       TEXT,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Note: You must insert records into this table mapping to existing Supabase Auth users 
-- in order for them to have access to the /mod admin dashboard.

-- Example:
-- INSERT INTO admin_users (auth_uid, email, name) 
-- VALUES ('<supabase-auth-user-id>', 'admin@example.com', 'Admin User');
