-- Migration v11: Add can_invite_users flag and last_login_at tracking
-- Only admin users with can_invite_users = true can invite new users.
-- last_login_at is updated on every dashboard load (whoami call).

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS can_invite_users BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Set this manually, once, for whichever superadmin should have it:
-- UPDATE admin_users SET can_invite_users = true WHERE email = 'your-email@...';
