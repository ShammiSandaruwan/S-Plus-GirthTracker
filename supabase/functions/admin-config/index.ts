import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveAdminAuth } from "../_shared/adminAuth.ts";

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    let supabaseAdmin;
    try {
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    } catch (err: any) {
      return respond({ error: 'Failed to create Supabase client: ' + (err.message || JSON.stringify(err)) }, 500);
    }

    // Validate JWT + resolve role and estate assignments via shared helper
    const auth = await resolveAdminAuth(supabaseAdmin, adminToken);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const callerRole = auth.role!;
    const callerEstateIds = auth.estateIds!;
    const callerEstateCodes = auth.estateCodes!;
    const callerEstateNames = auth.estateNames!;

    const body = await req.json();
    const { action } = body;

    // Default-deny allowlist for non-superadmin roles.
    // Any new action is automatically SuperAdmin-only unless explicitly added here.
    const SCOPED_READ_ACTIONS = new Set([
      'list_estates', 'list_divisions', 'list_fields', 'get_summary', 'field_tree_report', 'whoami',
      'list_devices', 'list_pending_requests'
    ]);

    if (callerRole !== 'superadmin' && !SCOPED_READ_ACTIONS.has(action)) {
      return respond({ error: 'Forbidden: insufficient role for this action' }, 403);
    }

    switch (action) {
      // === WHOAMI ===
      case 'whoami': {
        // Stamp last_login_at on every dashboard load (fire-and-forget)
        supabaseAdmin.from('admin_users').update({ last_login_at: new Date().toISOString() })
          .eq('id', auth.adminUserId).then(() => {});

        const { data: superAdmins } = await supabaseAdmin
          .from('admin_users')
          .select('name')
          .eq('role', 'superadmin')
          .eq('active', true)
          .order('created_at', { ascending: true });

        return respond({
          success: true,
          role: callerRole,
          canInviteUsers: auth.canInviteUsers === true,
          estateIds: callerEstateIds,
          estateNames: auth.estateNames,
          superAdmins: superAdmins?.map((sa: any) => sa.name).filter(Boolean) || []
        });
      }
      // === ESTATES ===
      case 'list_estates':
        return await listEstates(supabaseAdmin, body, callerRole, callerEstateIds);
      case 'create_estate':
        return await createEstate(supabaseAdmin, body);
      case 'update_estate':
        return await updateEstate(supabaseAdmin, body);

      // === DIVISIONS ===
      case 'list_divisions':
        return await listDivisions(supabaseAdmin, body, callerRole, callerEstateIds);
      case 'create_division':
        return await createDivision(supabaseAdmin, body);
      case 'update_division':
        return await updateDivision(supabaseAdmin, body);

      // === FIELDS ===
      case 'list_fields':
        return await listFields(supabaseAdmin, body, callerRole, callerEstateIds);
      case 'create_field':
        return await createField(supabaseAdmin, body);
      case 'update_field':
        return await updateField(supabaseAdmin, body);
      case 'delete_field':
        return await deleteField(supabaseAdmin, body);
      case 'mark_field_completed':
        return await markFieldCompleted(supabaseAdmin, body);
      case 'clear_field_completion':
        return await clearFieldCompletion(supabaseAdmin, body);

      // === SHEET MAPPINGS ===
      case 'list_sheet_mappings':
        return await listSheetMappings(supabaseAdmin);
      case 'upsert_sheet_mapping':
        return await upsertSheetMapping(supabaseAdmin, body);
      case 'validate_sheet_mapping':
        return await validateSheetMapping(supabaseAdmin, body);

      // === DEVICES ===
      case 'list_devices':
        return await listDevices(supabaseAdmin, callerRole, callerEstateIds, callerEstateCodes, callerEstateNames);
      case 'revoke_device':
        return await revokeDevice(supabaseAdmin, body);
      case 'delete_device':
        return await deleteDevice(supabaseAdmin, body);

      // === SUMMARY ===
      case 'get_summary':
        return await getSummary(supabaseAdmin, body, callerRole, callerEstateIds);

      // === PENDING REQUESTS ===
      case 'list_pending_requests':
        return await listPendingRequests(supabaseAdmin, callerRole, callerEstateIds, callerEstateCodes, callerEstateNames);

      // === MIGRATION ===
      case 'migrate_devices':
        return await migrateDevices(supabaseAdmin, body);
      case 'backfill_field_ids':
        return await backfillFieldIds(supabaseAdmin, body);

      // === FIELD TREE REPORT ===
      case 'field_tree_report':
        return await getFieldTreeReport(supabaseAdmin, body, callerRole, callerEstateIds);

      // === USER MANAGEMENT (SuperAdmin only — not in SCOPED_READ_ACTIONS) ===
      case 'list_admin_users':
        return await listAdminUsers(supabaseAdmin);
      case 'invite_admin_user':
        if (!auth.canInviteUsers) {
          return respond({ error: 'Forbidden: only the designated admin can invite users' }, 403);
        }
        return await inviteAdminUser(supabaseAdmin, body);
      case 'update_admin_user':
        return await updateAdminUser(supabaseAdmin, body);

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

async function listEstates(db: any, body: any, callerRole: string, callerEstateIds: string[]) {
  let query = db.from('estates').select('*').order('name');
  if (!body.includeInactive) query = query.eq('active', true);
  if (callerRole !== 'superadmin') query = query.in('id', callerEstateIds);
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

async function listDivisions(db: any, body: any, callerRole: string, callerEstateIds: string[]) {
  let query = db.from('divisions').select('*, estates(code, name)').order('name');
  if (body.estateId) query = query.eq('estate_id', body.estateId);
  if (!body.includeInactive) query = query.eq('active', true);
  if (callerRole !== 'superadmin') query = query.in('estate_id', callerEstateIds);
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

async function listFields(db: any, body: any, callerRole: string, callerEstateIds: string[]) {
  let query = db.from('fields')
    .select('*, estates(code, name), divisions(code, name)')
    .order('field_code');
  const divisionId = body.divisionId || body.division_id;
  const estateId = body.estateId || body.estate_id;
  if (divisionId) query = query.eq('division_id', divisionId);
  if (estateId) query = query.eq('estate_id', estateId);
  if (!body.includeInactive) query = query.eq('active', true);
  if (callerRole !== 'superadmin') query = query.in('estate_id', callerEstateIds);
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

  const yopVal = body.yop !== undefined && body.yop !== null && body.yop !== '' ? parseInt(body.yop) : null;

  const { data, error } = await db.from('fields').insert({
    estate_id: estateId, division_id: divisionId,
    field_code: fieldCode, extent_ha: extentHa, display_name: displayName || null,
    yop: yopVal
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

  if (updates.yop !== undefined) {
    updates.yop = updates.yop !== null && updates.yop !== '' ? parseInt(updates.yop) : null;
  }

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

async function deleteField(db: any, body: any) {
  const { id } = body;
  if (!id) return respond({ error: 'id required' }, 400);

  const { count } = await db.from('census_measurements')
    .select('id', { count: 'exact', head: true })
    .eq('field_id', id);

  if (count && count > 0 && !body.confirmDelete) {
    return respond({
      warning: true,
      message: `This field has ${count} associated measurements. Are you sure you want to delete it?`,
      measurementCount: count,
    });
  }

  const { error } = await db.from('fields').delete().eq('id', id);
  if (error) throw error;
  return respond({ success: true, message: 'Field deleted successfully' });
}

async function markFieldCompleted(db: any, body: any) {
  const { field_id, admin_name } = body;
  if (!field_id) return respond({ error: 'field_id is required' }, 400);
  const { data, error } = await db
    .from('fields')
    .update({ completed_at: new Date().toISOString(), completed_by: admin_name || null })
    .eq('id', field_id)
    .select()
    .single();
  if (error) throw error;
  return respond({ success: true, field: data });
}

async function clearFieldCompletion(db: any, body: any) {
  const { field_id } = body;
  if (!field_id) return respond({ error: 'field_id is required' }, 400);
  const { data, error } = await db
    .from('fields')
    .update({ completed_at: null, completed_by: null })
    .eq('id', field_id)
    .select()
    .single();
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

async function listDevices(db: any, callerRole: string, callerEstateIds: string[], callerEstateCodes: string[], callerEstateNames: string[]) {
  if (callerRole !== 'superadmin' && callerEstateCodes.length === 0 && callerEstateNames.length === 0) {
    return respond({ success: true, devices: [] });
  }

  let query = db.from('approved_devices')
    .select('id, device_id_hash, operator_name, estate_id, estate_code, approved_at, last_seen_at, last_sync_at, revoked, revoked_at')
    .order('approved_at', { ascending: false });

  if (callerRole !== 'superadmin') {
    const allValidCodes = Array.from(new Set([...callerEstateCodes, ...callerEstateNames]));
    query = query.in('estate_code', allValidCodes);
  }

  const { data, error } = await query;
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

async function deleteDevice(db: any, body: any) {
  const { deviceIdHash } = body;
  if (!deviceIdHash) return respond({ error: 'deviceIdHash required' }, 400);

  const { error } = await db.from('approved_devices')
    .delete()
    .eq('device_id_hash', deviceIdHash);
  if (error) throw error;

  await db.from('approval_events').insert({
    event_type: 'delete',
    device_id_hash: deviceIdHash,
    performed_by: 'mod_admin',
    event_data: { deleted_at: new Date().toISOString() },
  });

  return respond({ success: true, message: 'Device deleted.' });
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

async function getSummary(db: any, body: any, callerRole: string, callerEstateIds: string[]) {
  // 1. Get all estates, divisions, fields (extent_ha column)
  const { data: rawEstates, error: estErr } = await db.from('estates').select('id, code, name, active').order('name');
  const { data: rawDivisions, error: divErr } = await db.from('divisions').select('id, code, name, active, estate_id').order('name');
  const { data: rawFields, error: fldErr } = await db.from('fields').select('id, field_code, active, division_id, estate_id, extent_ha, completed_at').order('field_code');

  if (!rawEstates || !rawDivisions || !rawFields) {
    return respond({ error: 'Failed to load configuration data', details: { estErr, divErr, fldErr } }, 500);
  }

  // Scope to caller's assigned estates
  let allEstates = rawEstates;
  let allDivisions = rawDivisions;
  let allFields = rawFields;
  if (callerRole !== 'superadmin') {
    const estateIdSet = new Set(callerEstateIds);
    allEstates = rawEstates.filter((e: any) => estateIdSet.has(e.id));
    allDivisions = rawDivisions.filter((d: any) => estateIdSet.has(d.estate_id));
    allFields = rawFields.filter((f: any) => estateIdSet.has(f.estate_id));
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
        completed_at: field.completed_at,
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

  // Collect all field IDs that have census records (for dropdown filtering)
  const fieldsWithCensusIds = fieldDetails.map((f: any) => f.field_id);

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
    fields_with_census_ids: fieldsWithCensusIds,
  });
}

// ======================== PENDING REQUESTS ========================

async function listPendingRequests(db: any, callerRole: string, callerEstateIds: string[], callerEstateCodes: string[], callerEstateNames: string[]) {
  if (callerRole !== 'superadmin' && callerEstateCodes.length === 0 && callerEstateNames.length === 0) {
    return respond({ success: true, requests: [] });
  }

  let query = db
    .from('access_requests')
    .select('id, request_id, device_id_hash, operator_name, estate_id, estate_code, requested_at, status, user_agent, app_version')
    .eq('status', 'pending')
    .order('requested_at', { ascending: false });

  if (callerRole !== 'superadmin') {
    const allValidCodes = Array.from(new Set([...callerEstateCodes, ...callerEstateNames]));
    query = query.in('estate_code', allValidCodes);
  }

  const { data, error } = await query;
  if (error) throw error;

  return respond({
    success: true,
    requests: (data || []).map((r: any) => ({
      id: r.id,
      request_id: r.request_id,
      estate_id: r.estate_id,
      estate_code: r.estate_code,
      operator_name: r.operator_name,
      device_id_hash: r.device_id_hash,
      requested_at: r.requested_at,
      status: r.status,
      user_agent: r.user_agent,
      app_version: r.app_version,
    })),
  });
}

// ======================== FIELD TREE REPORT ========================

async function getFieldTreeReport(db: any, body: any, callerRole: string, callerEstateIds: string[]) {
  const { field_id, estate, division, fieldNo, field_code } = body;
  const targetFieldCode = fieldNo || field_code;

  if (!field_id && (!estate || !division || !targetFieldCode)) {
    return respond({ error: 'field_id or (estate, division, fieldNo) is required' }, 400);
  }

  let fieldRow: any = null;
  if (field_id) {
    const { data: fData } = await db
      .from('fields')
      .select('id, field_code, extent_ha, estate_id, estates(code, name), divisions(code, name)')
      .eq('id', field_id)
      .maybeSingle();
    if (fData) fieldRow = fData;
  }

  // Fallback: search configured field by code if fieldRow not resolved by ID
  if (!fieldRow && targetFieldCode) {
    const { data: candidates } = await db
      .from('fields')
      .select('id, field_code, extent_ha, estate_id, estates(code, name), divisions(code, name)')
      .ilike('field_code', targetFieldCode.trim());

    if (candidates && candidates.length > 0) {
      const eLower = (estate || '').toLowerCase().trim();
      const dLower = (division || '').toLowerCase().trim();
      fieldRow = candidates.find((f: any) => {
        const eCode = (f.estates?.code || '').toLowerCase();
        const eName = (f.estates?.name || '').toLowerCase();
        const dCode = (f.divisions?.code || '').toLowerCase();
        const dName = (f.divisions?.name || '').toLowerCase();
        const eMatch = !eLower || eCode === eLower || eName === eLower;
        const dMatch = !dLower || dCode === dLower || dName === dLower;
        return eMatch && dMatch;
      }) || candidates[0];
    }
  }

  // Estate scope check — block access to fields outside caller's assigned estates
  if (fieldRow && callerRole !== 'superadmin' && !callerEstateIds.includes(fieldRow.estate_id)) {
    return respond({ error: 'Forbidden: field is outside your assigned estates' }, 403);
  }

  const PAGE_SIZE = 1000;

  let linkedRows: any[] = [];
  if (fieldRow?.id) {
    let page = 0;
    let hasMore = true;
    while (hasMore) {
      const fromIndex = page * PAGE_SIZE;
      const toIndex = (page + 1) * PAGE_SIZE - 1;
      const { data, error: linkedErr } = await db
        .from('census_measurements')
        .select('tree_no, girth, tree_condition, condition_note, operator_name')
        .eq('field_id', fieldRow.id)
        .range(fromIndex, toIndex);

      if (linkedErr) throw linkedErr;
      if (data && data.length > 0) {
        linkedRows.push(...data);
      }
      if (!data || data.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  let legacyRows: any[] = [];
  const searchCode = (fieldRow?.field_code || targetFieldCode || '').toLowerCase().trim();
  const searchEstate = (fieldRow?.estates?.name || fieldRow?.estates?.code || estate || '').toLowerCase().trim();
  const searchDivision = (fieldRow?.divisions?.name || fieldRow?.divisions?.code || division || '').toLowerCase().trim();

  if (searchCode) {
    let candidateRows: any[] = [];
    let page = 0;
    let hasMore = true;
    while (hasMore) {
      const fromIndex = page * PAGE_SIZE;
      const toIndex = (page + 1) * PAGE_SIZE - 1;
      const { data, error: legacyErr } = await db
        .from('census_measurements')
        .select('tree_no, girth, tree_condition, condition_note, operator_name, estate, division, field_no, field_id')
        .ilike('field_no', searchCode)
        .range(fromIndex, toIndex);

      if (legacyErr) throw legacyErr;
      if (data && data.length > 0) {
        candidateRows.push(...data);
      }
      if (!data || data.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
    }

    legacyRows = candidateRows.filter((r: any) => {
      if (fieldRow?.id && r.field_id === fieldRow.id) return false; // Already included
      const rEstate = (r.estate || '').toLowerCase().trim();
      const rDiv = (r.division || '').toLowerCase().trim();
      const eMatch = !searchEstate || rEstate === searchEstate || searchEstate.includes(rEstate) || rEstate.includes(searchEstate);
      const dMatch = !searchDivision || rDiv === searchDivision || searchDivision.includes(rDiv) || rDiv.includes(searchDivision);
      return eMatch && dMatch;
    });
  }

  const rows = [...(linkedRows || []), ...legacyRows]
    .sort((a, b) => (a.tree_no ?? 0) - (b.tree_no ?? 0));

  // 1. Data Quality: Missing & Duplicates
  const treeCounts: Record<number, number> = {};
  rows.forEach(r => {
    if (r.tree_no != null) treeCounts[r.tree_no] = (treeCounts[r.tree_no] || 0) + 1;
  });

  const uniqueTreeNumbers = Object.keys(treeCounts).map(Number).sort((a, b) => a - b);
  const duplicates = Object.keys(treeCounts).filter(k => treeCounts[Number(k)] > 1).map(Number);

  let min = null, max = null, missing: number[] = [];
  if (uniqueTreeNumbers.length > 0) {
    min = uniqueTreeNumbers[0];
    max = uniqueTreeNumbers[uniqueTreeNumbers.length - 1];
    const present = new Set(uniqueTreeNumbers);
    for (let n = min; n <= max; n++) {
      if (!present.has(n)) missing.push(n);
    }
  }

  // 2. Tree Health — real domain values: healthy / runt / dead / damaged / animal_attack
  const healthStats = { healthy: 0, runt: 0, dead: 0, damaged: 0 };
  rows.forEach(r => {
    const cond = r.tree_condition || 'healthy';
    if (cond === 'runt') healthStats.runt++;
    else if (cond === 'dead') healthStats.dead++;
    else if (cond === 'damaged' || cond === 'animal_attack') healthStats.damaged++;
    else healthStats.healthy++;
  });

  // 3. Girth Distribution (girth column is inches)
  const girthDist = {
    lessThan4: 0, band4to7_9: 0, band8to9_9: 0, band10to11_9: 0,
    band12to13_9: 0, band14to15_9: 0, band16to17_9: 0, band18to19_9: 0, over20: 0
  };
  rows.forEach(r => {
    const g = parseFloat(r.girth);
    if (isNaN(g)) return;
    if (g < 4) girthDist.lessThan4++;
    else if (g < 8) girthDist.band4to7_9++;
    else if (g < 10) girthDist.band8to9_9++;
    else if (g < 12) girthDist.band10to11_9++;
    else if (g < 14) girthDist.band12to13_9++;
    else if (g < 16) girthDist.band14to15_9++;
    else if (g < 18) girthDist.band16to17_9++;
    else if (g < 20) girthDist.band18to19_9++;
    else girthDist.over20++;
  });

  // Extract unique operator names
  const operatorSet = new Set<string>();
  rows.forEach(r => {
    if (r.operator_name) operatorSet.add(r.operator_name.trim());
  });
  const operators = [...operatorSet].sort();
  const operatorDisplay = operators.length > 0 ? operators.join(' | ') : '-';

  const treeRows = rows.map((r: any) => ({
    treeNo: r.tree_no,
    girth: r.girth,
    treeCondition: r.tree_condition,
    conditionNote: r.condition_note || null,
    operatorName: r.operator_name || null
  }));

  return respond({
    success: true,
    fieldId: field_id,
    missingTreeNumbers: missing,
    gapCount: missing.length,
    duplicateTrees: duplicates,
    duplicateCount: duplicates.length,
    healthStats,
    girthDist,
    treeRows,
    operators,
    operatorDisplay,
    totalRecords: rows.length
  });
}

// ======================== USER MANAGEMENT ========================

async function listAdminUsers(db: any) {
  const { data, error } = await db
    .from('admin_users')
    .select('id, email, name, role, active, created_at, last_login_at, can_invite_users, admin_user_estates(estate_id, expires_at, estates(code, name))')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return respond({ success: true, users: data });
}

async function inviteAdminUser(db: any, body: any) {
  const { email, name, role, estateAssignments } = body;
  if (!email || !role) return respond({ error: 'email and role are required' }, 400);
  if (!['superadmin', 'admin', 'manager'].includes(role)) return respond({ error: 'Invalid role' }, 400);
  if (role === 'manager' && (!estateAssignments || estateAssignments.length === 0)) {
    return respond({ error: 'Managers must be assigned at least one estate' }, 400);
  }
  if (role === 'admin' && (!estateAssignments || estateAssignments.length === 0)) {
    return respond({ error: 'Admins must be assigned at least one estate' }, 400);
  }
  const badExpiry = (estateAssignments || []).find((a: any) => a.expiresAt && new Date(a.expiresAt) <= new Date());
  if (badExpiry) return respond({ error: 'Expiry date must be in the future' }, 400);

  const { data: inviteData, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo: 'https://girth.splussolutions.com/complete-invite'
  });
  if (inviteError) {
    if (inviteError.message?.toLowerCase().includes('already registered')) {
      return respond({ error: 'A user with this email already exists' }, 409);
    }
    return respond({ error: `Failed to send invite: ${inviteError.message}` }, 500);
  }

  const { data: newAdminUser, error: insertError } = await db
    .from('admin_users')
    .insert({ auth_uid: inviteData.user.id, email, name: name || null, role, active: true })
    .select()
    .single();
  if (insertError) throw insertError;

  if (role !== 'superadmin' && estateAssignments?.length) {
    const rows = estateAssignments.map((a: any) => ({
      admin_user_id: newAdminUser.id,
      estate_id: a.estateId,
      expires_at: a.expiresAt || null
    }));
    const { error: assignError } = await db.from('admin_user_estates').insert(rows);
    if (assignError) throw assignError;
  }

  return respond({ success: true, user: newAdminUser });
}

async function updateAdminUser(db: any, body: any) {
  const { id, role, estateAssignments, active } = body;
  if (!id) return respond({ error: 'id is required' }, 400);

  const updates: any = {};
  if (role !== undefined) updates.role = role;
  if (active !== undefined) updates.active = active;

  if (role === 'manager' && (!estateAssignments || estateAssignments.length === 0)) {
    return respond({ error: 'Managers must be assigned at least one estate' }, 400);
  }
  if (role === 'admin' && (!estateAssignments || estateAssignments.length === 0)) {
    return respond({ error: 'Admins must be assigned at least one estate' }, 400);
  }
  const badExpiry = (estateAssignments || []).find((a: any) => a.expiresAt && new Date(a.expiresAt) <= new Date());
  if (badExpiry) return respond({ error: 'Expiry date must be in the future' }, 400);

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await db.from('admin_users').update(updates).eq('id', id);
    if (updateError) throw updateError;
  }

  if (estateAssignments !== undefined) {
    // Replace-all pattern — simplest to reason about for a small assignment list
    await db.from('admin_user_estates').delete().eq('admin_user_id', id);
    if (estateAssignments.length > 0) {
      const rows = estateAssignments.map((a: any) => ({
        admin_user_id: id,
        estate_id: a.estateId,
        expires_at: a.expiresAt || null
      }));
      const { error: assignError } = await db.from('admin_user_estates').insert(rows);
      if (assignError) throw assignError;
    }
  }

  return respond({ success: true });
}
