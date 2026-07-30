import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateDeviceFromSupabase } from "../_shared/auth.ts";

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
      return new Response(JSON.stringify({ error: 'Missing device credentials' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const { estate, operatorName, measurements } = await req.json();

    if (!estate) {
      return new Response(JSON.stringify({ error: 'Estate is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate device directly against Supabase approved_devices
    const authResult = await validateDeviceFromSupabase(deviceId, deviceToken, estate, supabaseAdmin);
    if (!authResult.valid) {
      return new Response(JSON.stringify({
        error: authResult.error, errorType: authResult.errorType
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!Array.isArray(measurements) || measurements.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Empty batch' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const syncedIds: number[] = [];
    const errors: any[] = [];

    for (const m of measurements) {
      try {
        // Resolve field_id if provided
        let fieldId = m.fieldId || null;
        let resolvedExtent = m.extent;
        let resolvedEstate = estate;
        let resolvedDivision = m.division;
        let resolvedFieldNo = m.fieldNo;

        if (!fieldId && estate && m.division && m.fieldNo) {
          // Attempt to lookup fieldId
          const { data: foundField } = await supabaseAdmin
            .from('fields')
            .select('id, estate_id, division_id, field_code, extent_ha, active, estates!inner(code), divisions!inner(code)')
            .eq('estates.code', estate)
            .eq('divisions.code', m.division)
            .eq('field_code', m.fieldNo)
            .single();
            
          if (foundField && foundField.active) {
            fieldId = foundField.id;
          }
        }

        if (fieldId) {
          // Validate field_id exists and is active
          const { data: field, error: fieldErr } = await supabaseAdmin
            .from('fields')
            .select('id, estate_id, division_id, field_code, extent_ha, active, estates(code), divisions(code)')
            .eq('id', fieldId)
            .single();

          if (fieldErr || !field) {
            errors.push({ localId: m.id, error: fieldErr ? `Field lookup error: ${fieldErr.message}` : 'Invalid field_id' });
            continue;
          }

          if (!field.active) {
            errors.push({ localId: m.id, error: 'Field is inactive' });
            continue;
          }

          // Resolve canonical values from field config
          resolvedEstate = (field as any).estates?.code || estate;
          resolvedDivision = (field as any).divisions?.code || m.division;
          resolvedFieldNo = field.field_code;
          resolvedExtent = field.extent_ha;

          // Verify estate match
          if (resolvedEstate.toLowerCase() !== estate.toLowerCase()) {
            errors.push({ localId: m.id, error: 'Field does not belong to this estate' });
            continue;
          }
        }

        const row = {
          estate: resolvedEstate,
          division: resolvedDivision,
          field_no: resolvedFieldNo,
          extent: resolvedExtent,
          tree_no: m.treeNo,
          field_id: fieldId,
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
          operator_name: operatorName || m.operatorName,
          session_id: m.sessionId || null,
          device_id_hash: authResult.deviceIdHash,
          measured_at: m.timestamp || new Date().toISOString(),
          local_dexie_id: m.id || null,
        };

        const { error: upsertError } = await supabaseAdmin
          .from('census_measurements')
          .upsert(row, { onConflict: 'estate,division,field_no,extent,tree_no' });

        if (upsertError) {
          errors.push({ localId: m.id, error: upsertError.message });
        } else {
          syncedIds.push(m.id);
        }
      } catch (mErr: any) {
        errors.push({ localId: m.id, error: mErr.message });
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
