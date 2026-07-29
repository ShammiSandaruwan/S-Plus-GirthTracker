# Migration Runbook: GAS to Supabase

This document outlines the operational steps required to transition the GirthTracker production environment from Google Apps Script (GAS) to Supabase.

## Phase 1: Database Seed
1. Access the Admin Dashboard at `/mod`.
2. Navigate to the **Config & Backfill** tab.
3. Verify that your estates, divisions, and fields are correctly loaded from the legacy system or manually inserted via the Supabase Dashboard if they were not automatically migrated.
4. **Action:** Click "Run Backfill". This will link all existing `census_measurements` with NULL `field_id` to the corresponding `fields` record based on the legacy text fields.
5. Review the backfill report. Any unmatched records must have their corresponding estate/division/field created in the Config tab, after which the Backfill should be run again.

## Phase 2: Schema Enforcement
1. Once backfill is 100% complete and no legacy records remain unmatched, run the following SQL snippet in the Supabase SQL Editor to enforce strict relational integrity going forward:
```sql
ALTER TABLE census_measurements ALTER COLUMN field_id SET NOT NULL;
ALTER TABLE census_measurements ADD CONSTRAINT uq_field_tree UNIQUE (field_id, tree_no);
```

## Phase 3: Device Migration
1. Go to the **Devices** tab in the Admin Dashboard.
2. Click **Migrate GAS Devices**.
3. This action idempotently imports all approved devices from the legacy GAS deployment into the Supabase `approved_devices` table.
4. A report will display indicating how many were inserted, skipped, or had conflicts.
5. Review conflicts manually.

## Phase 4: Verification
1. Open the GirthTracker PWA.
2. In the setup wizard, ensure that Estate, Division, and Field No are now presented as cascading dropdowns sourced from the Supabase configuration.
3. Validate that offline measurement recording functions properly.
4. Go online and sync, ensuring `sync-measurements` successfully updates the `census_measurements` table using the new `field_id`.
