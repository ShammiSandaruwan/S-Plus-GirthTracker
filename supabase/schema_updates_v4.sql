-- GirthTracker Schema Updates - Phase 4 (Tree Condition Support)
-- Adds tree_condition (healthy, runt, dead, damaged) and condition_note
-- Makes caliper_reading, girth, and girth_cm nullable for non-measurable trees

ALTER TABLE census_measurements ALTER COLUMN caliper_reading DROP NOT NULL;
ALTER TABLE census_measurements ALTER COLUMN girth DROP NOT NULL;

ALTER TABLE census_measurements 
  ADD COLUMN IF NOT EXISTS tree_condition TEXT NOT NULL DEFAULT 'healthy',
  ADD COLUMN IF NOT EXISTS condition_note TEXT NULL;

-- Add check constraint for valid tree condition values
ALTER TABLE census_measurements DROP CONSTRAINT IF EXISTS chk_tree_condition;
ALTER TABLE census_measurements ADD CONSTRAINT chk_tree_condition 
  CHECK (tree_condition IN ('healthy', 'runt', 'dead', 'damaged'));

-- Add check constraint for condition girth and note rules
ALTER TABLE census_measurements DROP CONSTRAINT IF EXISTS chk_condition_girth_note;
ALTER TABLE census_measurements ADD CONSTRAINT chk_condition_girth_note
  CHECK (
    (tree_condition IN ('healthy', 'runt') AND girth IS NOT NULL AND girth > 0)
    OR
    (tree_condition IN ('dead', 'damaged') AND girth IS NULL AND condition_note IS NOT NULL AND trim(condition_note) != '')
  );
