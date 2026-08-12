-- Migration: v10 Canonicalize Estate IDs for Devices and Requests
-- Purpose: Safely map legacy estate_code to canonical UUID estate_id.

-- 1. Ensure estate_id exists on access_requests
ALTER TABLE access_requests
  ADD COLUMN IF NOT EXISTS estate_id UUID REFERENCES estates(id);

-- 2. Indexes for fast lookups and scoped filtering
CREATE INDEX IF NOT EXISTS idx_approved_devices_estate_id ON approved_devices(estate_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_estate_id ON access_requests(estate_id);

-- 3. Safe Backfill Strategy

-- Update approved_devices
UPDATE approved_devices ad
SET estate_id = e.id
FROM estates e
WHERE ad.estate_id IS NULL
  AND LOWER(TRIM(ad.estate_code)) = LOWER(TRIM(e.code))
  -- Ensure unambiguous exact match exists
  AND (SELECT COUNT(*) FROM estates WHERE LOWER(TRIM(code)) = LOWER(TRIM(ad.estate_code))) = 1;

-- Update access_requests
UPDATE access_requests ar
SET estate_id = e.id
FROM estates e
WHERE ar.estate_id IS NULL
  AND LOWER(TRIM(ar.estate_code)) = LOWER(TRIM(e.code))
  -- Ensure unambiguous exact match exists
  AND (SELECT COUNT(*) FROM estates WHERE LOWER(TRIM(code)) = LOWER(TRIM(ar.estate_code))) = 1;

-- 4. Reporting Query for Unresolved / Conflicting Mappings
-- (This can be run by SuperAdmin to inspect any failures)
-- 
-- SELECT 'approved_device' as record_type, id, estate_code, estate_id, 
--        CASE WHEN estate_id IS NOT NULL THEN 'mapped' ELSE 'unmapped' END as mapping_status
-- FROM approved_devices 
-- WHERE estate_id IS NULL OR LOWER(TRIM(estate_code)) NOT IN (SELECT LOWER(TRIM(code)) FROM estates)
-- UNION ALL
-- SELECT 'access_request' as record_type, id, estate_code, estate_id,
--        CASE WHEN estate_id IS NOT NULL THEN 'mapped' ELSE 'unmapped' END as mapping_status
-- FROM access_requests
-- WHERE estate_id IS NULL OR LOWER(TRIM(estate_code)) NOT IN (SELECT LOWER(TRIM(code)) FROM estates);
