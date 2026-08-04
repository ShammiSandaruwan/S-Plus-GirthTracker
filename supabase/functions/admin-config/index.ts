import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-admin-token');
    const adminToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : null;
    if (!adminToken) {
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    let supabaseAdmin;
    try {
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    } catch (err: any) {
      return respond({ error: 'Failed to create Supabase client: ' + (err.message || JSON.stringify(err)) }, 500);
    }

    // 1. Validate JWT via Supabase Auth
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(adminToken);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired admin session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Check if user is in admin_users allowlist
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('auth_uid', user.id)
      .eq('active', true)
      .single();

    if (adminError || !adminUser) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized: User is not an active admin',
        details: adminError || 'User not found in admin_users table',
        uid: user.id
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      // === ESTATES ===
      case 'list_estates':
        return await listEstates(supabaseAdmin, body);
      case 'create_estate':
        return await createEstate(supabaseAdmin, body);
      case 'update_estate':
        return await updateEstate(supabaseAdmin, body);

      // === DIVISIONS ===
      case 'list_divisions':
        return await listDivisions(supabaseAdmin, body);
      case 'create_division':
        return await createDivision(supabaseAdmin, body);
      case 'update_division':
        return await updateDivision(supabaseAdmin, body);

      // === FIELDS ===
      case 'list_fields':
        return await listFields(supabaseAdmin, body);
      case 'create_field':
        return await createField(supabaseAdmin, body);
      case 'update_field':
        return await updateField(supabaseAdmin, body);

      // === SHEET MAPPINGS ===
      case 'list_sheet_mappings':
        return await listSheetMappings(supabaseAdmin);
      case 'upsert_sheet_mapping':
        return await upsertSheetMapping(supabaseAdmin, body);
      case 'validate_sheet_mapping':
        return await validateSheetMapping(supabaseAdmin, body);

      // === DEVICES ===
      case 'list_devices':
        return await listDevices(supabaseAdmin);
      case 'revoke_device':
        return await revokeDevice(supabaseAdmin, body);

      // === SUMMARY ===
      case 'get_summary':
        return await getSummary(supabaseAdmin, body);

      // === PENDING REQUESTS ===
      case 'list_pending_requests':
        return await listPendingRequests(supabaseAdmin);

      // === MIGRATION ===
      case 'migrate_devices':
        return await migrateDevices(supabaseAdmin, body);
      case 'backfill_field_ids':
        return await backfillFieldIds(supabaseAdmin, body);

      default:
        return respond({ error: 'Unknown action' }, 400);
    }

  } catch (err: any) {
    return respond({ 
      error: err.message || (typeof err === 'string' ? err : JSON.stringify(err)),
      fullError: err
    }, 500);
  }
});

function respond(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// ======================== ESTATES ========================

async function listEstates(db: any, body: any) {
  const query = db.from('estates').select('*').order('name');
  if (!body.includeInactive) query.eq('active', true);
  const { data, error } = await query;
  if (error) throw error;
  return respond({ success: true, estates: data });
}

async function createEstate(db: any, body: any) {
  const { code, name } = body;
  if (!code || !name) return respond({ error: 'code and name required' }, 400);

  const { data, error } = await db.from('estates').insert({ code, name }).select().single();
  if (error) {
    if (error.code === '23505') return respond({ error: 'Duplicate estate code or name' }, 409);
    throw error;
  }
  return respond({ success: true, estate: data });
}

async function updateEstate(db: any, body: any) {
  const { id, ...updates } = body;
  if (!id) return respond({ error: 'id required' }, 400);

  // Prevent deletion - use active flag
  delete updates.action;
  const { data, error } = await db.from('estates').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return respond({ success: true, estate: data });
}

// ======================== DIVISIONS ========================

async function listDivisions(db: any, body: any) {
  let query = db.from('divisions').select('*, estates(code, name)').order('name');
  if (body.estateId) query = query.eq('estate_id', body.estateId);
  if (!body.includeInactive) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw error;
  return respond({ success: true, divisions: data });
}

async function createDivision(db: any, body: any) {
  const estateId = body.estateId || body.estate_id;
  const code = body.code;
  const name = body.name;
  if (!estateId || !code || !name) return respond({ error: 'estateId, code, name required' }, 400);

  const { data, error } = await db.from('divisions')
    .insert({ estate_id: estateId, code, name }).select().single();
  if (error) {
    if (error.code === '23505') return respond({ error: 'Duplicate division code in estate' }, 409);
    throw error;
  }
  return respond({ success: true, division: data });
}

async function updateDivision(db: any, body: any) {
  const { id, ...updates } = body;
  if (!id) return respond({ error: 'id required' }, 400);
  delete updates.action;
  const { data, error } = await db.from('divisions').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return respond({ success: true, division: data });
}

// ======================== FIELDS ========================

async function listFields(db: any, body: any) {
  let query = db.from('fields')
    .select('*, estates(code, name), divisions(code, name)')
    .order('field_code');
  const divisionId = body.divisionId || body.division_id;
  const estateId = body.estateId || body.estate_id;
  if (divisionId) query = query.eq('division_id', divisionId);
  if (estateId) query = query.eq('estate_id', estateId);
  if (!body.includeInactive) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw error;
  return respond({ success: true, fields: data });
}

async function createField(db: any, body: any) {
  const estateId = body.estateId || body.estate_id;
  const divisionId = body.divisionId || body.division_id;
  const fieldCode = body.fieldCode || body.field_code;
  const extentHa = body.extentHa ?? body.extent_ha;
  const displayName = body.displayName ?? body.display_name;

  if (!estateId || !divisionId || !fieldCode || extentHa === undefined || extentHa === null || extentHa === '') {
    return respond({ error: 'estateId, divisionId, fieldCode, extentHa required' }, 400);
  }

  if (parseFloat(extentHa) <= 0) {
    return respond({ error: 'extentHa must be positive' }, 400);
  }

  const { data, error } = await db.from('fields').insert({
    estate_id: estateId, division_id: divisionId,
    field_code: fieldCode, extent_ha: extentHa, display_name: displayName || null
  }).select().single();

  if (error) {
    if (error.code === '23505') return respond({ error: 'Duplicate field code in division' }, 409);
    if (error.message.includes('estate_id must match')) return respond({ error: error.message }, 400);
    throw error;
  }
  return respond({ success: true, field: data });
}

async function updateField(db: any, body: any) {
  const { id, ...updates } = body;
  if (!id) return respond({ error: 'id required' }, 400);
  delete updates.action;

  // Warn if extent changes and measurements exist
  if (updates.extent_ha !== undefined) {
    const { count } = await db.from('census_measurements')
      .select('id', { count: 'exact', head: true })
      .eq('field_id', id);
    if (count && count > 0 && !body.confirmExtentChange) {
      return respond({
        warning: true,
        message: `This field has ${count} measurements. Changing extent will be audited. Send confirmExtentChange: true to proceed.`,
        measurementCount: count,
      });
    }
  }

  const { data, error } = await db.from('fields').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return respond({ success: true, field: data });
}

// ======================== SHEET MAPPINGS ========================

async function listSheetMappings(db: any) {
  const { data, error } = await db.from('estate_sheet_exports')
    .select('*, estates(code, name)')
    .order('created_at');
  if (error) throw error;
  return respond({ success: true, mappings: data });
}

async function upsertSheetMapping(db: any, body: any) {
  const { estateId, spreadsheetId, tabName, active } = body;
  if (!estateId || !spreadsheetId) {
    return respond({ error: 'estateId and spreadsheetId required' }, 400);
  }

  const { data, error } = await db.from('estate_sheet_exports')
    .upsert({
      estate_id: estateId,
      spreadsheet_id: spreadsheetId,
      tab_name: tabName || 'Sheet1',
      active: active !== false,
      validated: false, // reset on change
    }, { onConflict: 'estate_id' })
    .select().single();

  if (error) throw error;
  return respond({ success: true, mapping: data });
}

async function validateSheetMapping(db: any, body: any) {
  const { mappingId } = body;
  if (!mappingId) return respond({ error: 'mappingId required' }, 400);

  const { data: mapping } = await db.from('estate_sheet_exports')
    .select('*, estates(code)')
    .eq('id', mappingId)
    .single();

  if (!mapping) return respond({ error: 'Mapping not found' }, 404);

  // Call GAS to validate sheet access
  const gasUrl = Deno.env.get('GAS_URL') || '';
  if (!gasUrl) return respond({ error: 'GAS_URL not configured' }, 500);

  try {
    const valRes = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'validate_sheet_access',
        spreadsheetId: mapping.spreadsheet_id,
        tabName: mapping.tab_name,
      }),
    });
    const result = await valRes.json();

    if (result.success) {
      await db.from('estate_sheet_exports')
        .update({ validated: true, validated_at: new Date().toISOString() })
        .eq('id', mappingId);

      return respond({ success: true, validated: true, message: 'Sheet access confirmed.' });
    } else {
      return respond({ success: false, validated: false, error: result.error || 'Validation failed' });
    }
  } catch (err: any) {
    return respond({ success: false, error: `Validation request failed: ${err.message}` });
  }
}

// ======================== DEVICES ========================

async function listDevices(db: any) {
  const { data, error } = await db.from('approved_devices')
    .select('*')
    .order('approved_at', { ascending: false });
  if (error) throw error;
  return respond({ success: true, devices: data });
}

async function revokeDevice(db: any, body: any) {
  const { deviceIdHash } = body;
  if (!deviceIdHash) return respond({ error: 'deviceIdHash required' }, 400);

  const revokedAt = new Date().toISOString();
  const { error } = await db.from('approved_devices')
    .update({ revoked: true, revoked_at: revokedAt })
    .eq('device_id_hash', deviceIdHash);
  if (error) throw error;

  await db.from('approval_events').insert({
    event_type: 'revoke',
    device_id_hash: deviceIdHash,
    performed_by: 'mod_admin',
    event_data: { revoked_at: revokedAt },
  });

  return respond({ success: true, message: 'Device revoked.' });
}

// ======================== DEVICE MIGRATION (Idempotent) ========================

async function migrateDevices(db: any, body: any) {
  const { dryRun = true } = body;
  
  const gasUrl = Deno.env.get('GAS_URL') || '';
  if (!gasUrl) return respond({ error: 'GAS_URL not configured' }, 500);

  // Fetch devices from GAS
  const gasRes = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'admin_export_devices', adminSessionToken: body.adminToken }),
  });
  const gasResult = await gasRes.json();
  if (!gasResult.success || !gasResult.devices) {
    return respond({ error: gasResult.error || 'Failed to fetch devices from GAS' }, 500);
  }

  const sourceDevices = gasResult.devices;
  const report = { total_source: sourceDevices.length, inserted: 0, skipped: 0, conflicts: [] as any[], errors: [] as any[] };

  for (const src of sourceDevices) {
    try {
      // Check if device already exists
      const { data: existing } = await db.from('approved_devices')
        .select('*')
        .eq('device_id_hash', src.deviceIdHash)
        .single();

      if (!existing) {
        // INSERT
        if (!dryRun) {
          await db.from('approved_devices').insert({
            device_id_hash: src.deviceIdHash,
            token_hash: src.tokenHash,
            estate_code: src.estate,
            operator_name: src.operatorName,
            approved_at: src.approvedAt || new Date().toISOString(),
            expires_at: src.expiresAt || null,
            revoked: src.revoked === true || src.revoked === 'true',
            revoked_at: null,
            last_seen_at: src.lastSeenAt || null,
            last_sync_at: src.lastSyncAt || null,
          });

          // Audit event only for newly inserted
          await db.from('approval_events').insert({
            event_type: 'migrate_import',
            device_id_hash: src.deviceIdHash,
            estate_code: src.estate,
            operator_name: src.operatorName,
            performed_by: 'migration_script',
          });
        }
        report.inserted++;
      } else {
        // Compare for identical vs conflict
        const isIdentical =
          existing.token_hash === src.tokenHash &&
          existing.estate_code === src.estate &&
          existing.revoked === (src.revoked === true || src.revoked === 'true') &&
          (existing.expires_at || null) === (src.expiresAt || null);

        if (isIdentical) {
          report.skipped++;
        } else {
          // CONFLICT - do NOT overwrite
          const diffs: any[] = [];
          if (existing.token_hash !== src.tokenHash) diffs.push({ field: 'token_hash', source: '[redacted]', existing: '[redacted]' });
          if (existing.estate_code !== src.estate) diffs.push({ field: 'estate_code', source: src.estate, existing: existing.estate_code });
          if (existing.revoked !== (src.revoked === true || src.revoked === 'true')) diffs.push({ field: 'revoked', source: src.revoked, existing: existing.revoked });
          if ((existing.expires_at || null) !== (src.expiresAt || null)) diffs.push({ field: 'expires_at', source: src.expiresAt, existing: existing.expires_at });

          report.conflicts.push({ device_id_hash: src.deviceIdHash, diffs });
        }
      }
    } catch (err: any) {
      report.errors.push({ device_id_hash: src.deviceIdHash, error: err.message });
    }
  }

  return respond({ success: true, report, dryRun });
}

// ======================== FIELD ID BACKFILL ========================

async function backfillFieldIds(db: any, body: any) {
  const { dryRun = true } = body;
  // Find measurements without field_id
  const { data: unmatched, error: fetchErr } = await db
    .from('census_measurements')
    .select('id, estate, division, field_no')
    .is('field_id', null)
    .limit(5000);

  if (fetchErr) throw fetchErr;
  if (!unmatched || unmatched.length === 0) {
    return respond({ success: true, matched: 0, unmatched: [], message: 'No measurements need backfill.' });
  }

  // Get all fields with joins
  const { data: allFields } = await db
    .from('fields')
    .select('id, field_code, extent_ha, division_id, estate_id, divisions(code, estate_id), estates(code)');

  if (!allFields) return respond({ error: 'Failed to load fields' }, 500);

  // Build lookup: estate_code + division_code + field_code → field
  const lookup = new Map<string, any>();
  for (const f of allFields) {
    const estateCode = f.estates?.code || '';
    const divisionCode = f.divisions?.code || '';
    const key = `${estateCode}|${divisionCode}|${f.field_code}`.toLowerCase();
    lookup.set(key, f);
  }

  let matched = 0;
  const unmatchedReport: any[] = [];

  for (const m of unmatched) {
    const key = `${m.estate}|${m.division}|${m.field_no}`.toLowerCase();
    const field = lookup.get(key);

    if (field) {
      if (!dryRun) {
        await db.from('census_measurements')
          .update({ field_id: field.id, extent_at_measurement: m.extent || field.extent_ha })
          .eq('id', m.id);
      }
      matched++;
    } else {
      // Track unmatched for report
      const existing = unmatchedReport.find(
        u => u.estate === m.estate && u.division === m.division && u.field_no === m.field_no
      );
      if (existing) {
        existing.count++;
      } else {
        unmatchedReport.push({ estate: m.estate, division: m.division, field_no: m.field_no, count: 1 });
      }
    }
  }

  return respond({
    success: true,
    matched,
    unmatched: unmatchedReport,
    total_processed: unmatched.length,
    message: unmatchedReport.length > 0
      ? 'Some measurements could not be matched. Create the missing fields and re-run.'
      : 'All measurements backfilled successfully.',
    dryRun
  });
}

// ======================== SUMMARY ========================

async function getSummary(db: any, body: any) {
  // 1. Get all estates, divisions, fields (extent_ha column)
  const { data: allEstates, error: estErr } = await db.from('estates').select('id, code, name, active').order('name');
  const { data: allDivisions, error: divErr } = await db.from('divisions').select('id, code, name, active, estate_id').order('name');
  const { data: allFields, error: fldErr } = await db.from('fields').select('id, field_code, active, division_id, estate_id, extent_ha').order('field_code');

  if (!allEstates || !allDivisions || !allFields) {
    return respond({ error: 'Failed to load configuration data', details: { estErr, divErr, fldErr } }, 500);
  }

  // 2. Get aggregate counts from census_measurements using the new v2 RPC
  const { data: fieldCounts, error: countErr } = await db.rpc('get_field_summary_v2');

  let fieldCountMap: Record<string, any> = {};
  if (!countErr && fieldCounts) {
    for (const row of fieldCounts) {
      fieldCountMap[row.field_id] = row;
    }
  }

  // 3. Build summary response
  let totalRecords = 0;
  let fieldsWithRecords = 0;
  let fieldsWithoutRecords = 0;

  const fieldDetails: any[] = [];

  for (const field of allFields) {
    const counts = fieldCountMap[field.id];
    const division = allDivisions.find((d: any) => d.id === field.division_id);
    const estate = allEstates.find((e: any) => e.id === field.estate_id);

    if (counts && counts.total_recorded > 0) {
      fieldsWithRecords++;
      totalRecords += Number(counts.total_recorded);

      fieldDetails.push({
        field_id: field.id,
        field_code: field.field_code,
        field_active: field.active,
        extent: field.extent_ha,
        division_id: field.division_id,
        division_name: division?.name || '-',
        estate_id: field.estate_id,
        estate_name: estate?.name || '-',
        total: Number(counts.total_recorded),
        last_tree_no: counts.last_tree_no || '-',
        last_recorded: counts.last_recorded_date || null,
      });
    } else {
      fieldsWithoutRecords++;
      // Do not push to fieldDetails since we only want fields with data
    }
  }

  // Optional: filter by estate_id
  let filtered = fieldDetails;
  if (body.estate_id) {
    filtered = filtered.filter((f: any) => f.estate_id === body.estate_id);
  }
  if (body.division_id) {
    filtered = filtered.filter((f: any) => f.division_id === body.division_id);
  }

  return respond({
    success: true,
    summary: {
      total_records: totalRecords,
      fields_with_records: fieldsWithRecords,
      fields_without_records: fieldsWithoutRecords,
      total_fields: allFields.length,
      estates: allEstates,
      divisions: allDivisions,
    },
    field_details: filtered,
  });
}

// ======================== PENDING REQUESTS ========================

async function listPendingRequests(db: any) {
  const { data, error } = await db
    .from('access_requests')
    .select('*')
    .eq('status', 'pending')
    .order('requested_at', { ascending: false });

  if (error) throw error;

  return respond({
    success: true,
    requests: (data || []).map((r: any) => ({
      request_id: r.request_id,
      estate_code: r.estate_code,
      operator_name: r.operator_name,
      device_id_hash: r.device_id_hash,
      latitude: r.latitude,
      longitude: r.longitude,
      gps_accuracy: r.gps_accuracy,
      google_map_link: r.google_map_link,
      requested_at: r.requested_at,
      user_agent: r.user_agent,
      app_version: r.app_version,
    })),
  });
}
