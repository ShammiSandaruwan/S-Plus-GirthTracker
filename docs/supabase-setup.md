# Supabase Setup Guide for GirthTracker

## Overview
GirthTracker has migrated to a Supabase-first backend to resolve concurrency bugs and provide strong referential integrity for measurements. Google Apps Script is now retained strictly as a downstream bridge for writing to Google Sheets.

## Prerequisites
- A Supabase Project
- Supabase CLI installed locally

## 1. Schema Deployment
Deploy the schema using the Supabase CLI:
```bash
supabase db push
```
Or manually run the SQL scripts in `supabase/schema.sql` via the Supabase SQL editor.

## 2. Edge Functions
Deploy all required edge functions to your project:
```bash
supabase functions deploy fetch-config --no-verify-jwt
supabase functions deploy request-access --no-verify-jwt
supabase functions deploy check-access --no-verify-jwt
supabase functions deploy approve-device --no-verify-jwt
supabase functions deploy admin-config --no-verify-jwt
supabase functions deploy sync-measurements --no-verify-jwt
supabase functions deploy undo-measurement --no-verify-jwt
supabase functions deploy export-field --no-verify-jwt
supabase functions deploy admin-auth --no-verify-jwt
supabase functions deploy admin-fetch --no-verify-jwt
```

## 3. Environment Secrets
Configure the following secrets in your Supabase project (via CLI or dashboard):
- `GAS_URL`: The URL of your Google Apps Script deployment (used for the downstream export and device migration).
- `GAS_SHARED_SECRET`: The HMAC-SHA256 secret used to sign requests sent between Supabase and GAS (e.g. for Telegram approval callbacks). Must match the value in your GAS script properties.

```bash
supabase secrets set GAS_URL="https://script.google.com/macros/s/..."
supabase secrets set GAS_SHARED_SECRET="your-secure-random-secret"
```

## 4. Cron Jobs
To prevent replay attacks during telegram approvals, `request_nonces` are stored. You must schedule the cleanup function to clear expired nonces periodically.
Run this SQL command to schedule the cron job (using `pg_cron` extension):

```sql
SELECT cron.schedule('cleanup_nonces', '0 * * * *', $$ SELECT cleanup_expired_nonces(); $$);
```
