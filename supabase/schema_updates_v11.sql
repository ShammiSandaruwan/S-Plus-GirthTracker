-- Migration v11: Add can_invite_users flag for invite-gate
-- Only admin users with this flag set to true can invite new users.

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS can_invite_users BOOLEAN NOT NULL DEFAULT false;

-- Set this manually, once, for whichever superadmin should have it:
-- UPDATE admin_users SET can_invite_users = true WHERE email = 'your-email@...';
