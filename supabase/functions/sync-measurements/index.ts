import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateDeviceFromSupabase, resolveCanonicalEstate } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id, x-device-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  try {
    const deviceId = req.headers.get('x-device-id');
    const deviceToken = req.headers.get('x-device-token');

    if (!deviceId || !deviceToken) {
      console.warn(`[SYNC-DEBUG] [Req:${requestId}] Auth failed: missing device credentials. cause: invalid device | errorCode: AUTH_FAILED`);
      return new Response(JSON.stringify({ error: 'Missing device credentials', errorCode: 'AUTH_FAILED' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const { operatorName, measurements } = await req.json();

    // Validate device credentials against Supabase approved_devices
    const authResult = await validateDeviceFromSupabase(deviceId, deviceToken, supabaseAdmin);
    if (!authResult.valid || !authResult.device) {
      const cause = authResult.errorCode === 'DEVICE_REVOKED'
        ? 'revoked device'
        : (authResult.errorCode === 'DEVICE_INVALID' ? 'invalid device' : 'auth failed');
      console.warn(`[SYNC-DEBUG] [Req:${requestId}] Auth rejected for deviceIdHash:${authResult.deviceIdHash?.substring(0, 10) || 'unknown'}. cause: ${cause} | errorCode: ${authResult.errorCode || 'AUTH_FAILED'} | error: ${authResult.error}`);
      return new Response(JSON.stringify({
        error: authResult.error || 'Device not approved.',
        errorType: authResult.errorType || 'auth_failed',
        errorCode: authResult.errorCode || 'AUTH_FAILED'
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Resolve approved device's canonical estate identity
    const approvedEstate = await resolveCanonicalEstate(authResult.device.estate_code, supabaseAdmin);
    if (!approvedEstate) {
      console.warn(`[SYNC-DEBUG] [Req:${requestId}] Estate resolution failed for deviceIdHash:${authResult.deviceIdHash?.substring(0, 10)} | estate_code:'${authResult.device.estate_code}'. cause: stale config | errorCode: AUTH_FAILED`);
      return new Response(JSON.stringify({
        error: 'Approved device estate could not be resolved.',
        errorCode: 'AUTH_FAILED'
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const approvedEstateId = approvedEstate.id;
    console.log(`[SYNC-DEBUG] [Req:${requestId}] Authenticated deviceIdHash:${authResult.deviceIdHash?.substring(0, 10)} | ApprovedEstate: { id:'${approvedEstateId}', code:'${approvedEstate.code}', name:'${approvedEstate.name}' }`);

    if (!Array.isArray(measurements) || measurements.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Empty batch', syncedIds: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const syncedIds: number[] = [];
    const errors: any[] = [];

    for (const m of measurements) {
      try {
        const localId = m.id;
        let fieldId = m.fieldId || null;
        let fieldRow: any = null;
        const usedCanonicalPath = !!m.fieldId;
        const usedLegacyFallback = !m.fieldId && !!(m.division && m.fieldNo);
        const lookupPath = usedCanonicalPath ? 'canonical' : (usedLegacyFallback ? 'legacy_fallback' : 'none');

        if (fieldId) {
          // Validate fieldId exists
          const { data: field, error: fieldErr } = await supabaseAdmin
            .from('fields')
            .select('id, estate_id, division_id, field_code, extent_ha, active, estates!inner(id, code, name), divisions!inner(id, code, name)')
            .eq('id', fieldId)
            .maybeSingle();

          if (fieldErr || !field) {
            console.warn(
              `[SYNC-DEBUG] [Req:${requestId}] FIELD LOOKUP FAILED | localId:${localId} | deviceIdHash:${authResult.deviceIdHash?.substring(0, 10)}` +
              ` | approvedEstate: { id:'${approvedEstateId}', code:'${approvedEstate.code}', name:'${approvedEstate.name}' }` +
              ` | incomingFieldId:'${m.fieldId}' | usedCanonicalPath:${usedCanonicalPath} | usedLegacyFallback:${usedLegacyFallback} | lookupPath:'${lookupPath}'` +
              ` | fieldLookupSuccess:false` +
              ` | resolvedField: null` +
              ` | cause: missing field | errorCode: FIELD_NOT_FOUND` +
              ` | dbError: ${fieldErr?.message || 'Field not found by fieldId'}`
            );
            errors.push({
              localId,
              errorCode: 'FIELD_NOT_FOUND',
              error: fieldErr ? `Field lookup error: ${fieldErr.message}` : 'Invalid or non-existent field_id'
            });
            continue;
          }
          fieldRow = field;
        } else if (m.division && m.fieldNo) {
          // Legacy fallback: attempt to lookup field in approved estate by division code & field_code
          const { data: fallbackField, error: fallbackErr } = await supabaseAdmin
            .from('fields')
            .select('id, estate_id, division_id, field_code, extent_ha, active, estates!inner(id, code, name), divisions!inner(id, code, name)')
            .eq('estate_id', approvedEstateId)
            .eq('divisions.code', m.division)
            .eq('field_code', m.fieldNo)
            .maybeSingle();

          if (fallbackErr || !fallbackField) {
            console.warn(
              `[SYNC-DEBUG] [Req:${requestId}] FALLBACK LOOKUP FAILED | localId:${localId} | deviceIdHash:${authResult.deviceIdHash?.substring(0, 10)}` +
              ` | approvedEstate: { id:'${approvedEstateId}', code:'${approvedEstate.code}', name:'${approvedEstate.name}' }` +
              ` | incomingFieldId:null (division:'${m.division}', fieldNo:'${m.fieldNo}')` +
              ` | usedCanonicalPath:${usedCanonicalPath} | usedLegacyFallback:${usedLegacyFallback} | lookupPath:'${lookupPath}'` +
              ` | fieldLookupSuccess:false` +
              ` | resolvedField: null` +
              ` | cause: legacy fallback mismatch | errorCode: FIELD_NOT_FOUND` +
              ` | dbError: ${fallbackErr?.message || 'Field not found in approved estate'}`
            );
            errors.push({
              localId,
              errorCode: 'FIELD_NOT_FOUND',
              error: 'Field not found in approved estate for division/field_code'
            });
            continue;
          }
          fieldRow = fallbackField;
          fieldId = fallbackField.id;
        }

        if (!fieldRow) {
          console.warn(
            `[SYNC-DEBUG] [Req:${requestId}] MISSING FIELD SELECTION | localId:${localId} | deviceIdHash:${authResult.deviceIdHash?.substring(0, 10)}` +
            ` | approvedEstate: { id:'${approvedEstateId}', code:'${approvedEstate.code}', name:'${approvedEstate.name}' }` +
            ` | incomingFieldId:'${m.fieldId}' | usedCanonicalPath:${usedCanonicalPath} | usedLegacyFallback:${usedLegacyFallback} | lookupPath:'${lookupPath}'` +
            ` | fieldLookupSuccess:false` +
            ` | resolvedField: null` +
            ` | cause: missing field | errorCode: VALIDATION_ERROR`
          );
          errors.push({
            localId,
            errorCode: 'VALIDATION_ERROR',
            error: 'Missing fieldId or valid field selection'
          });
          continue;
        }

        if (!fieldRow.active) {
          console.warn(
            `[SYNC-DEBUG] [Req:${requestId}] INACTIVE FIELD REJECTION | localId:${localId} | deviceIdHash:${authResult.deviceIdHash?.substring(0, 10)}` +
            ` | approvedEstate: { id:'${approvedEstateId}', code:'${approvedEstate.code}', name:'${approvedEstate.name}' }` +
            ` | incomingFieldId:'${m.fieldId}' | usedCanonicalPath:${usedCanonicalPath} | usedLegacyFallback:${usedLegacyFallback} | lookupPath:'${lookupPath}'` +
            ` | fieldLookupSuccess:true` +
            ` | resolvedField: { id:'${fieldRow.id}', estate_id:'${fieldRow.estate_id}', estateCode:'${fieldRow.estates?.code}', estateName:'${fieldRow.estates?.name}' }` +
            ` | comparison: fieldRow.active is false` +
            ` | cause: inactive field | errorCode: FIELD_INACTIVE`
          );
          errors.push({
            localId,
            errorCode: 'FIELD_INACTIVE',
            error: 'Field is inactive'
          });
          continue;
        }

        // Canonical Estate Comparison (UUID matching)
        const estateMatch = fieldRow.estate_id === approvedEstateId;
        if (!estateMatch) {
          console.warn(
            `[SYNC-DEBUG] [Req:${requestId}] ESTATE MISMATCH REJECTION | localId:${localId} | deviceIdHash:${authResult.deviceIdHash?.substring(0, 10)}` +
            ` | approvedEstate: { id:'${approvedEstateId}', code:'${approvedEstate.code}', name:'${approvedEstate.name}' }` +
            ` | incomingFieldId:'${m.fieldId}' | usedCanonicalPath:${usedCanonicalPath} | usedLegacyFallback:${usedLegacyFallback} | lookupPath:'${lookupPath}'` +
            ` | fieldLookupSuccess:true` +
            ` | resolvedField: { id:'${fieldRow.id}', estate_id:'${fieldRow.estate_id}', estateCode:'${fieldRow.estates?.code}', estateName:'${fieldRow.estates?.name}' }` +
            ` | comparisonOutcome: field.estate_id ('${fieldRow.estate_id}') === approvedEstateId ('${approvedEstateId}') => ${estateMatch}` +
            ` | cause: estate mismatch | errorCode: ESTATE_MISMATCH`
          );
          errors.push({
            localId,
            errorCode: 'ESTATE_MISMATCH',
            error: 'Field does not belong to this estate'
          });
          continue;
        }

        // Derive authoritative location details from DB record only
        const resolvedEstate = fieldRow.estates?.code || approvedEstate.code;
        const resolvedDivision = fieldRow.divisions?.code || m.division;
        const resolvedFieldNo = fieldRow.field_code;
        const resolvedExtent = fieldRow.extent_ha;

        const treeCondition = m.treeCondition || 'healthy';
        const conditionNote = m.conditionNote ? String(m.conditionNote).trim() : null;

        if (treeCondition === 'healthy' || treeCondition === 'runt') {
          if (m.girth == null || Number(m.girth) <= 0 || isNaN(Number(m.girth))) {
            console.warn(`[SYNC-DEBUG] [Req:${requestId}] REJECTED: Healthy/runt tree missing positive girth | localId:${localId} | girth:${m.girth}`);
            errors.push({
              localId,
              errorCode: 'VALIDATION_ERROR',
              error: 'Positive girth measurement is required for healthy and runt trees.'
            });
            continue;
          }
        } else if (treeCondition === 'dead' || treeCondition === 'damaged') {
          if (m.girth != null) {
            console.warn(`[SYNC-DEBUG] [Req:${requestId}] REJECTED: Dead/damaged tree has non-null girth | localId:${localId} | girth:${m.girth}`);
            errors.push({
              localId,
              errorCode: 'VALIDATION_ERROR',
              error: 'Dead or damaged trees must not have a girth value recorded.'
            });
            continue;
          }
          if (!conditionNote) {
            console.warn(`[SYNC-DEBUG] [Req:${requestId}] REJECTED: Dead/damaged tree missing condition note | localId:${localId}`);
            errors.push({
              localId,
              errorCode: 'VALIDATION_ERROR',
              error: 'A condition note is required for dead or damaged trees.'
            });
            continue;
          }
        } else {
          errors.push({
            localId,
            errorCode: 'VALIDATION_ERROR',
            error: 'Invalid tree condition specified.'
          });
          continue;
        }

        const isMeasurable = (treeCondition === 'healthy' || treeCondition === 'runt');

        const row = {
          estate: resolvedEstate,
          division: resolvedDivision,
          field_no: resolvedFieldNo,
          extent: resolvedExtent,
          tree_no: m.treeNo,
          field_id: fieldRow.id,
          extent_at_measurement: resolvedExtent,
          caliper_reading: isMeasurable ? m.caliperReading : null,
          girth: isMeasurable ? m.girth : null,
          girth_cm: isMeasurable ? (m.girthCm || null) : null,
          tree_condition: treeCondition,
          condition_note: conditionNote,
          recommendation_status: isMeasurable ? (m.recommendationStatus || null) : treeCondition,
          recommendation_text: isMeasurable ? (m.recommendationText || null) : (treeCondition === 'dead' ? 'Dead Tree' : 'Damaged Tree'),
          abnormal_flag: treeCondition === 'runt' ? true : (m.abnormalFlag || false),
          abnormal_reason: treeCondition === 'runt' ? 'Runt Tree' : (m.abnormalReason || null),
          latitude: m.latitude || null,
          longitude: m.longitude || null,
          gps_accuracy: m.gpsAccuracy || null,
          gps_status: m.gpsStatus || null,
          google_map_link: m.googleMapLink || null,
          operator_name: operatorName || m.operatorName || authResult.device.operator_name,
          session_id: m.sessionId || null,
          device_id_hash: authResult.deviceIdHash,
          measured_at: m.timestamp || new Date().toISOString(),
          local_dexie_id: m.id || null,
        };

        // Check if a row with the same field_id and tree_no already exists
        const { data: existingRow, error: checkError } = await supabaseAdmin
          .from('census_measurements')
          .select('id, device_id_hash, local_dexie_id')
          .eq('field_id', fieldRow.id)
          .eq('tree_no', m.treeNo)
          .maybeSingle();

        if (checkError) {
          console.error(`[SYNC-DEBUG] [Req:${requestId}] Error checking duplicates: ${checkError.message}`);
        }

        if (existingRow) {
          // Idempotency check: is this the same device retrying/updating the same local Dexie record?
          const isSameDeviceAndRecord = 
            existingRow.device_id_hash === authResult.deviceIdHash && 
            existingRow.local_dexie_id === m.id;
          
          if (!isSameDeviceAndRecord) {
            console.warn(
              `[SYNC-DEBUG] [Req:${requestId}] DUPLICATE REJECTION | localId:${localId} | fieldId:${fieldRow.id} | treeNo:${m.treeNo}` +
              ` | existingRow: { id:'${existingRow.id}', device:'${existingRow.device_id_hash?.substring(0, 10)}', localId:${existingRow.local_dexie_id} }` +
              ` | incoming: { device:'${authResult.deviceIdHash?.substring(0, 10)}', localId:${m.id} }`
            );
            errors.push({
              localId,
              errorCode: 'DUPLICATE_TREE_NUMBER',
              error: `Tree #${m.treeNo} has already been measured in this field by another device or session.`
            });
            continue;
          }
        }

        const { error: upsertError } = await supabaseAdmin
          .from('census_measurements')
          .upsert(row, { onConflict: 'field_id, tree_no' });

        if (upsertError) {
          const isDuplicate = upsertError.code === '23505';
          const errorCode = isDuplicate ? 'DUPLICATE_TREE_NUMBER' : 'VALIDATION_ERROR';
          const errorMessage = isDuplicate ? `Tree #${m.treeNo} has already been measured in this field.` : upsertError.message;
          console.error(
            `[SYNC-DEBUG] [Req:${requestId}] DB UPSERT ERROR | localId:${localId} | deviceIdHash:${authResult.deviceIdHash?.substring(0, 10)}` +
            ` | cause: database upsert failure | errorCode: ${errorCode}` +
            ` | error: ${upsertError.message}`
          );
          errors.push({
            localId,
            errorCode,
            error: errorMessage
          });
        } else {
          console.log(`[SYNC-DEBUG] [Req:${requestId}] SYNC SUCCESS | localId:${localId} | fieldId:${fieldRow.id} | lookupPath:'${lookupPath}'`);
          syncedIds.push(localId);
        }
      } catch (mErr: any) {
        console.error(`[SYNC-DEBUG] [Req:${requestId}] EXCEPTION | localId:${m.id} | error: ${mErr.message}`);
        errors.push({
          localId: m.id,
          errorCode: 'VALIDATION_ERROR',
          error: mErr.message || 'Unexpected sync error'
        });
      }
    }

    // Update device last_sync_at
    await supabaseAdmin
      .from('approved_devices')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('device_id_hash', authResult.deviceIdHash);

    return new Response(JSON.stringify({
      success: true,
      syncedIds,
      errors: errors.length > 0 ? errors : undefined,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error(`[SYNC-DEBUG] [Req:${requestId}] FATAL HANDLER ERROR | error: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message, errorCode: 'SERVER_ERROR' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});


