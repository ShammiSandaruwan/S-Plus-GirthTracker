-- ============================================================
-- Fix: Enforce strict uniqueness of tree numbers per field
-- ============================================================

-- Add the unique constraint to census_measurements if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'uq_field_tree'
    ) THEN
        ALTER TABLE public.census_measurements 
        ADD CONSTRAINT uq_field_tree UNIQUE (field_id, tree_no);
    END IF;
END $$;
