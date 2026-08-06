-- Migration v8: Add Field Completion Tracking
-- Adds tracking for when a field census was completed to enforce cooldown periods

ALTER TABLE fields ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE fields ADD COLUMN IF NOT EXISTS completed_by TEXT;
