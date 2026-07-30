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
      console.warn(`[UNDO-DEBUG] [Req:${requestId}] Auth failed: missing device credentials. cause: invalid device | errorCode: AUTH_FAILED`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing device credentials',
        errorCode: 'AUTH_FAILED'
      }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const body = await req.json();
    const {
      estate,
      division,
      fieldNo,
      extent,
      treeNo,
      operatorName,
      sessionId,
      timestamp,
      localDexieId,
      measurementId
    } = body;

    // Log the input shape and verify frontend hookup
    const frontendPayloadInfo = {
      hasSessionId: sessionId !== undefined,
      sessionIdValue: sessionId || null,
      hasTimestamp: timestamp !== undefined,
      timestampValue: timestamp || null,
      hasLocalDexieId: localDexieId !== undefined,
      localDexieIdValue: localDexieId || null,
      hasMeasurementId: measurementId !== undefined,
      measurementIdValue: measurementId || null,
      hasEstate: estate !== undefined,
      hasDivision: division !== undefined,
      hasFieldNo: fieldNo !== undefined,
      hasExtent: extent !== undefined,
      hasTreeNo: treeNo !== undefined,
    };

    if (!estate || !division || !fieldNo || !extent || !treeNo) {
      console.warn(
        `[UNDO-DEBUG] [Req:${requestId}] Validation failed: missing required identifiers.` +
        ` Received: estate='${estate}', division='${division}', fieldNo='${fieldNo}', extent='${extent}', treeNo='${treeNo}'.` +
        ` Payload structure info: ${JSON.stringify(frontendPayloadInfo)}. cause: missing field | errorCode: VALIDATION_ERROR`
      );
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required measurement identifiers',
        errorCode: 'VALIDATION_ERROR'
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate device credentials against Supabase approved_devices
    const authResult = await validateDeviceFromSupabase(deviceId, deviceToken, estate, supabaseAdmin);
    if (!authResult.valid || !authResult.device) {
      const cause = authResult.errorCode === 'DEVICE_REVOKED'
        ? 'revoked device'
        : (authResult.errorCode === 'DEVICE_INVALID' ? 'invalid device' : 'auth failed');
      console.warn(`[UNDO-DEBUG] [Req:${requestId}] Device auth rejected for deviceIdHash:${authResult.deviceIdHash?.substring(0, 10) || 'unknown'}. cause: ${cause} | errorCode: ${authResult.errorCode || 'AUTH_FAILED'} | error: ${authResult.error}`);
      return new Response(JSON.stringify({
        success: false,
        error: authResult.error || 'Device not approved.',
        errorCode: authResult.errorCode || 'AUTH_FAILED'
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Resolve approved device's canonical estate identity
    const approvedEstate = await resolveCanonicalEstate(authResult.device.estate_code, supabaseAdmin);
    if (!approvedEstate) {
      console.warn(`[UNDO-DEBUG] [Req:${requestId}] Estate resolution failed for deviceIdHash:${authResult.deviceIdHash?.substring(0, 10)} | estate_code:'${authResult.device.estate_code}'. cause: stale config | errorCode: AUTH_FAILED`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Approved device estate could not be resolved.',
        errorCode: 'AUTH_FAILED'
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const approvedEstateId = approvedEstate.id;
    const deviceIdHash = authResult.deviceIdHash;

    // Resolve incoming estate to canonical representation
    const incomingEstate = await resolveCanonicalEstate(estate, supabaseAdmin);
    const targetEstateCode = incomingEstate?.code || approvedEstate.code;

    // Resolve division to canonical representation
    let targetDivisionCode = division;
    let resolvedDivisionId = null;
    const { data: divByCode } = await supabaseAdmin
      .from('divisions')
      .select('id, code')
      .eq('estate_id', approvedEstateId)
      .ilike('code', division.trim())
      .maybeSingle();

    if (divByCode) {
      targetDivisionCode = divByCode.code;
      resolvedDivisionId = divByCode.id;
    } else {
      const { data: divByName } = await supabaseAdmin
        .from('divisions')
        .select('id, code')
        .eq('estate_id', approvedEstateId)
        .ilike('name', division.trim())
        .maybeSingle();
      if (divByName) {
        targetDivisionCode = divByName.code;
        resolvedDivisionId = divByName.id;
      }
    }

    // Resolve fieldNo to canonical representation
    let targetFieldCode = fieldNo;
    if (resolvedDivisionId) {
      const { data: fieldByCode } = await supabaseAdmin
        .from('fields')
        .select('field_code')
        .eq('division_id', resolvedDivisionId)
        .ilike('field_code', fieldNo.trim())
        .maybeSingle();

      if (fieldByCode) {
        targetFieldCode = fieldByCode.field_code;
      } else {
        const { data: fieldByName } = await supabaseAdmin
          .from('fields')
          .select('field_code')
          .eq('division_id', resolvedDivisionId)
          .ilike('display_name', fieldNo.trim())
          .maybeSingle();
        if (fieldByName) {
          targetFieldCode = fieldByName.field_code;
        }
      }
    }

    // Check if the target row exists in Supabase before attempting delete
    const { data: exactMatchRows, error: findError } = await supabaseAdmin
      .from('census_measurements')
      .select('id, estate, division, field_no, extent, tree_no, local_dexie_id, session_id, device_id_hash')
      .match({
        estate: targetEstateCode,
        division: targetDivisionCode,
        field_no: targetFieldCode,
        extent: extent,
        tree_no: treeNo
      });

    let rowFoundBeforeDelete = false;
    let foundRowDetails = '';
    let rejectionReason = 'row not found';
    let broadLookupDetails = '';
    let dependentRowsExist = false;
    let dependentRowsCount = 0;

    if (findError) {
      console.error(`[UNDO-DEBUG] [Req:${requestId}] Error searching for row before delete: ${findError.message}`);
      rejectionReason = 'delete query mismatch';
    } else if (exactMatchRows && exactMatchRows.length > 0) {
      rowFoundBeforeDelete = true;
      const matchedRow = exactMatchRows[0];
      foundRowDetails = `Row ID: ${matchedRow.id}, local_dexie_id: ${matchedRow.local_dexie_id}, session_id: ${matchedRow.session_id}, device_id_hash: ${matchedRow.device_id_hash?.substring(0, 10)}`;
      
      // Authorization check (estate level): Ensure the measurement estate matches the device estate code
      if (incomingEstate && incomingEstate.id !== approvedEstateId) {
        rejectionReason = 'estate mismatch';
      } else {
        rejectionReason = '';

        // Query dependent audit rows from measurement_events
        const { data: eventRows, error: eventFindError } = await supabaseAdmin
          .from('measurement_events')
          .select('id')
          .eq('measurement_id', matchedRow.id);
        
        if (eventRows) {
          dependentRowsExist = eventRows.length > 0;
          dependentRowsCount = eventRows.length;
        } else if (eventFindError) {
          console.error(`[UNDO-DEBUG] [Req:${requestId}] Error searching for dependent rows: ${eventFindError.message}`);
        }
      }
    } else {
      // Diagnostic broad lookup: ignore extent to check if it's an extent float/numeric mismatch
      const { data: broadMatchRows } = await supabaseAdmin
        .from('census_measurements')
        .select('id, estate, division, field_no, extent, tree_no')
        .match({
          estate: targetEstateCode,
          division: targetDivisionCode,
          field_no: targetFieldCode,
          tree_no: treeNo
        });

      if (broadMatchRows && broadMatchRows.length > 0) {
        broadLookupDetails = `Broad match (ignoring extent) found matching row(s) with different extent: ` +
          broadMatchRows.map(r => `(DB extent: ${r.extent} vs received: ${extent}, rowId: ${r.id})`).join(', ');
      } else {
        broadLookupDetails = `Broad match also returned 0 rows. No measurements exist for estate='${targetEstateCode}' (received='${estate}'), division='${targetDivisionCode}' (received='${division}'), fieldNo='${targetFieldCode}' (received='${fieldNo}'), treeNo=${treeNo}.`;
      }
    }

    // Log the analysis details
    console.log(
      `[UNDO-DEBUG] [Req:${requestId}] BEFORE-DELETE ANALYSIS` +
      ` | deviceIdHash:${deviceIdHash?.substring(0, 10)}` +
      ` | approvedEstate: { id:'${approvedEstateId}', code:'${approvedEstate.code}', name:'${approvedEstate.name}' }` +
      ` | receivedIdentifiers: { estate:'${estate}', division:'${division}', fieldNo:'${fieldNo}', extent:${extent}, treeNo:${treeNo}, sessionId:'${sessionId || 'undefined'}', timestamp:'${timestamp || 'undefined'}', localDexieId:'${localDexieId || 'undefined'}', measurementId:'${measurementId || 'undefined'}' }` +
      ` | resolvedIdentifiers: { estate:'${targetEstateCode}', division:'${targetDivisionCode}', fieldNo:'${targetFieldCode}' }` +
      ` | rowFoundBeforeDelete:${rowFoundBeforeDelete}` +
      ` | foundRowDetails:[${foundRowDetails}]` +
      ` | dependentAuditRowsExist:${dependentRowsExist} (count:${dependentRowsCount})` +
      ` | broadLookupDetails:[${broadLookupDetails}]` +
      ` | deleteCriteria: { estate:'${targetEstateCode}', division:'${targetDivisionCode}', field_no:'${targetFieldCode}', extent:${extent}, tree_no:${treeNo} }` +
      ` | note: delete query uses service_role key (bypasses RLS)`
    );

    if (!rowFoundBeforeDelete) {
      console.warn(`[UNDO-DEBUG] [Req:${requestId}] Delete aborted: row not found. cause: row not found | errorCode: NOT_FOUND`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Measurement row not found in Supabase.',
        errorCode: 'NOT_FOUND',
        debugMetadata: { broadLookupDetails }
      }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (rejectionReason === 'estate mismatch') {
      console.warn(`[UNDO-DEBUG] [Req:${requestId}] Delete aborted: estate mismatch. cause: estate mismatch | errorCode: AUTH_FAILED`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Measurement estate does not match approved device estate.',
        errorCode: 'AUTH_FAILED'
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Trace the delete path details
    console.log(
      `[UNDO-DEBUG] [Req:${requestId}] TRACE DELETE PATH` +
      ` | targetIdentifiers: { estate: '${targetEstateCode}', division: '${targetDivisionCode}', field_no: '${targetFieldCode}', extent: ${extent}, tree_no: ${treeNo} }` +
      ` | targetTables: public.measurement_events (child) -> public.census_measurements (parent)` +
      ` | deletePath: calling transactional RPC 'undo_measurement'` +
      ` | measurementEventsCleanupAttemptedFirst: true` +
      ` | triggerExpectation: RPC executes standard transaction; trigger 'measurement_audit_trigger' will fire AFTER DELETE on census_measurements, but trigger function has been fixed to set measurement_id to NULL, preventing FK violations` +
      ` | fallbackLookupChoice: none (using exact composite key matches)`
    );

    // Call transactional RPC to delete parent and child rows safely
    const { data: rpcResult, error: deleteError } = await supabaseAdmin
      .rpc('undo_measurement', {
        p_estate: targetEstateCode,
        p_division: targetDivisionCode,
        p_field_no: targetFieldCode,
        p_extent: extent,
        p_tree_no: treeNo
      });

    if (deleteError) {
      console.error(`[UNDO-DEBUG] [Req:${requestId}] Delete operation error: ${deleteError.message}. cause: RPC execution failure | errorCode: DELETE_FAILED`);
      return new Response(JSON.stringify({
        success: false,
        error: `Delete failed: ${deleteError.message}`,
        errorCode: 'DELETE_FAILED'
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (rpcResult && !rpcResult.success) {
      console.warn(`[UNDO-DEBUG] [Req:${requestId}] RPC reported failure: ${rpcResult.error}. cause: ${rpcResult.errorCode} | errorCode: ${rpcResult.errorCode || 'DELETE_FAILED'}`);
      const status = rpcResult.errorCode === 'NOT_FOUND' ? 404 : 400;
      return new Response(JSON.stringify({
        success: false,
        error: rpcResult.error || 'Delete failed',
        errorCode: rpcResult.errorCode || 'DELETE_FAILED'
      }), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const deletedRowCount = rpcResult?.deletedRowCount || 0;
    const deletedId = rpcResult?.deletedId || null;

    console.log(
      `[UNDO-DEBUG] [Req:${requestId}] DELETE SUCCESS` +
      ` | deletedRowCount:${deletedRowCount}` +
      ` | deletedId:${deletedId}` +
      ` | finalState: success`
    );

    if (deletedRowCount === 0) {
      console.warn(`[UNDO-DEBUG] [Req:${requestId}] Delete query executed but 0 rows affected. cause: row not found | errorCode: NOT_FOUND`);
      return new Response(JSON.stringify({
        success: false,
        error: 'No matching row was deleted in Supabase.',
        errorCode: 'NOT_FOUND'
      }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update device last_sync_at (even for undo)
    await supabaseAdmin
      .from('approved_devices')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('device_id_hash', authResult.deviceIdHash);

    return new Response(JSON.stringify({
      success: true,
      message: 'Measurement deleted successfully',
      deletedRowCount,
      deletedId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error(`[UNDO-DEBUG] [Req:${requestId}] Fatal exception: ${err.message}. cause: delete query mismatch | errorCode: DELETE_FAILED`);
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
      errorCode: 'DELETE_FAILED'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
