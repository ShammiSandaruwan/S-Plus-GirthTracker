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

  try {
    const deviceId = req.headers.get('x-device-id');
    const deviceToken = req.headers.get('x-device-token');

    if (!deviceId || !deviceToken) {
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
      console.warn('[sync-measurements] Could not resolve device estate code:', authResult.device.estate_code);
      return new Response(JSON.stringify({
        error: 'Approved device estate could not be resolved.',
        errorCode: 'AUTH_FAILED'
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const approvedEstateId = approvedEstate.id;
    console.log('[sync-measurements] Authenticated device:', authResult.deviceIdHash?.substring(0, 10), 'Approved Estate:', approvedEstate.code, '(', approvedEstateId, ')');

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

        if (fieldId) {
          // Validate fieldId exists
          const { data: field, error: fieldErr } = await supabaseAdmin
            .from('fields')
            .select('id, estate_id, division_id, field_code, extent_ha, active, estates!inner(id, code, name), divisions!inner(id, code, name)')
            .eq('id', fieldId)
            .maybeSingle();

          if (fieldErr || !field) {
            console.warn('[sync-measurements] Field lookup failed for fieldId:', fieldId, fieldErr?.message);
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
            console.warn('[sync-measurements] Fallback lookup failed for division:', m.division, 'fieldNo:', m.fieldNo);
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
          errors.push({
            localId,
            errorCode: 'VALIDATION_ERROR',
            error: 'Missing fieldId or valid field selection'
          });
          continue;
        }

        if (!fieldRow.active) {
          console.warn('[sync-measurements] Inactive field selected for localId:', localId, fieldRow.id);
          errors.push({
            localId,
            errorCode: 'FIELD_INACTIVE',
            error: 'Field is inactive'
          });
          continue;
        }

        // Canonical Estate Comparison (UUID matching)
        if (fieldRow.estate_id !== approvedEstateId) {
          console.warn('[sync-measurements] Estate mismatch for localId:', localId, 'Field Estate:', fieldRow.estate_id, 'Device Estate:', approvedEstateId);
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

        const row = {
          estate: resolvedEstate,
          division: resolvedDivision,
          field_no: resolvedFieldNo,
          extent: resolvedExtent,
          tree_no: m.treeNo,
          field_id: fieldRow.id,
          extent_at_measurement: resolvedExtent,
          caliper_reading: m.caliperReading,
          girth: m.girth,
          girth_cm: m.girthCm || null,
          recommendation_status: m.recommendationStatus || null,
          recommendation_text: m.recommendationText || null,
          abnormal_flag: m.abnormalFlag || false,
          abnormal_reason: m.abnormalReason || null,
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

        const { error: upsertError } = await supabaseAdmin
          .from('census_measurements')
          .upsert(row, { onConflict: 'estate,division,field_no,extent,tree_no' });

        if (upsertError) {
          console.error('[sync-measurements] Upsert failed for localId:', localId, upsertError.message);
          errors.push({
            localId,
            errorCode: 'VALIDATION_ERROR',
            error: `Database error: ${upsertError.message}`
          });
        } else {
          console.log('[sync-measurements] Synced localId:', localId, 'fieldId:', fieldRow.id);
          syncedIds.push(localId);
        }
      } catch (mErr: any) {
        console.error('[sync-measurements] Exception processing localId:', m.id, mErr.message);
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
    console.error('[sync-measurements] Fatal handler error:', err.message);
    return new Response(JSON.stringify({ error: err.message, errorCode: 'SERVER_ERROR' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

