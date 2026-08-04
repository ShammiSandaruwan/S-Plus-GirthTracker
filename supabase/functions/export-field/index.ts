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

    const body = await req.json();
    const {
      estate: inputEstate,
      division: inputDivision,
      fieldNo: inputFieldNo,
      estate_id: inputEstateId,
      division_id: inputDivisionId,
      field_id: inputFieldId,
      dateFrom,
      dateTo,
      export_request_id: inputExportRequestId
    } = body;

    const exportRequestId = inputExportRequestId || `EXP-REQ-${crypto.randomUUID()}`;

    const gasUrl = Deno.env.get('GAS_URL') || '';
    const gasSharedSecret = Deno.env.get('GAS_SHARED_SECRET') || '';
    if (!gasUrl) {
      return new Response(JSON.stringify({ error: 'GAS_URL not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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
      return new Response(JSON.stringify({ error: 'Unauthorized: User is not an active admin' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Resolve canonical estate, division, and field identifiers
    let estateId = inputEstateId || null;
    let estateName = inputEstate || null;
    let estateCode = null;

    if (estateId) {
      const { data: estData } = await supabaseAdmin
        .from('estates')
        .select('id, name, code')
        .eq('id', estateId)
        .maybeSingle();
      if (estData) {
        estateName = estData.name;
        estateCode = estData.code;
      }
    } else if (inputEstate) {
      const { data: estData } = await supabaseAdmin
        .from('estates')
        .select('id, name, code')
        .or(`code.eq.${inputEstate},name.eq.${inputEstate}`)
        .maybeSingle();
      if (estData) {
        estateId = estData.id;
        estateName = estData.name;
        estateCode = estData.code;
      }
    }

    if (!estateId && !estateName) {
      return new Response(JSON.stringify({ error: 'Estate is required for export' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let fieldId = inputFieldId || null;
    let fieldCode = inputFieldNo || null;
    let fieldDivisionId = inputDivisionId || null;

    if (fieldId) {
      const { data: fldData } = await supabaseAdmin
        .from('fields')
        .select('id, field_code, division_id, estate_id')
        .eq('id', fieldId)
        .maybeSingle();
      if (fldData) {
        fieldCode = fldData.field_code;
        if (!estateId) estateId = fldData.estate_id;
        if (!fieldDivisionId) fieldDivisionId = fldData.division_id;
      }
    } else if (inputFieldNo && estateId) {
      const { data: fldData } = await supabaseAdmin
        .from('fields')
        .select('id, field_code, division_id, estate_id')
        .eq('estate_id', estateId)
        .eq('field_code', inputFieldNo)
        .maybeSingle();
      if (fldData) {
        fieldId = fldData.id;
        fieldCode = fldData.field_code;
        if (!fieldDivisionId) fieldDivisionId = fldData.division_id;
      }
    }

    if (!fieldCode) {
      return new Response(JSON.stringify({ error: 'Field No is required for export' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let divisionCode = inputDivision || null;
    if (fieldDivisionId) {
      const { data: divData } = await supabaseAdmin
        .from('divisions')
        .select('id, name, code')
        .eq('id', fieldDivisionId)
        .maybeSingle();
      if (divData) {
        divisionCode = divData.code || divData.name;
      }
    }

    // 3. Resolve spreadsheet mapping exclusively from estate_sheet_exports
    if (!estateId) {
      return new Response(JSON.stringify({ error: 'No active Google Sheet mapping exists for this estate.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: mapping } = await supabaseAdmin
      .from('estate_sheet_exports')
      .select('spreadsheet_id, tab_name, active')
      .eq('estate_id', estateId)
      .eq('active', true)
      .maybeSingle();

    if (!mapping || !mapping.spreadsheet_id) {
      return new Response(JSON.stringify({ error: 'No active Google Sheet mapping exists for this estate.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const spreadsheetId = mapping.spreadsheet_id;
    const tabName = mapping.tab_name || 'Sheet1';

    const PAGE_SIZE = 1000;

    const buildExportQuery = () => {
      let q = supabaseAdmin
        .from('census_measurements')
        .select('*');

      if (fieldId) {
        q = q.eq('field_id', fieldId);
      } else {
        if (estateCode || estateName) {
          const estateVals = Array.from(new Set([estateCode, estateName].filter(Boolean)));
          q = q.in('estate', estateVals);
        }
        if (fieldCode) {
          q = q.eq('field_no', fieldCode);
        }
        if (divisionCode) {
          q = q.eq('division', divisionCode);
        }
      }

      if (dateFrom) q = q.gte('measured_at', dateFrom);
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        q = q.lte('measured_at', toDate.toISOString());
      }

      return q.order('tree_no', { ascending: true });
    };

    let measurements: any[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const fromIndex = page * PAGE_SIZE;
      const toIndex = (page + 1) * PAGE_SIZE - 1;
      const { data, error: fetchErr } = await buildExportQuery().range(fromIndex, toIndex);

      if (fetchErr) throw fetchErr;

      if (data && data.length > 0) {
        measurements.push(...data);
      }

      if (!data || data.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
    }

    if (!measurements || measurements.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No measurements found for this field', rowCount: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Safe diagnostic logging (no credentials or tokens)
    console.log("Initiating export batch:", {
      fieldId,
      estateId,
      estateName,
      fieldCode,
      spreadsheetIdResolved: true,
      tabName,
      exportRequestId,
      rowCount: measurements.length
    });

    // 5. Send payload to Google Apps Script
    // Ensure estate is set to the name from estates table
    const formattedRows = measurements.map((m: any) => ({
      ...m,
      estate: estateName || estateCode || m.estate
    }));

    const exportPayload = JSON.stringify({
      action: 'export_to_sheet',
      gasSharedSecret,
      estate: estateName || estateCode,
      division: divisionCode || '',
      fieldNo: fieldCode,
      rows: formattedRows,
      spreadsheetId,
      tabName,
      export_request_id: exportRequestId,
    });

    const exportRes = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: exportPayload,
    });
    const exportResult = await exportRes.json();

    if (!exportResult.success) {
      throw new Error(`Export failed: ${exportResult.error}`);
    }

    // 6. Mark measurements as exported
    const batchId = `EXP-${crypto.randomUUID()}`;
    const exportedAt = new Date().toISOString();

    const ids = measurements.map(m => m.id);
    const { error: updateErr } = await supabaseAdmin
      .from('census_measurements')
      .update({ exported_at: exportedAt, export_batch_id: batchId })
      .in('id', ids);

    if (updateErr) {
       console.error("Failed to mark measurements as exported in Supabase:", updateErr);
    }
    
    // 7. Update mapping last_exported_at
    await supabaseAdmin
      .from('estate_sheet_exports')
      .update({ last_exported_at: exportedAt })
      .eq('estate_id', estateId);

    return new Response(JSON.stringify({ 
      success: true, 
      message: exportResult.isDuplicate 
        ? `Export request ${exportRequestId} was already processed.` 
        : `Exported ${measurements.length} records successfully to tab '${tabName}'.`,
      exportedCount: measurements.length,
      destinationTab: tabName,
      exportRequestId: exportRequestId,
      isDuplicate: !!exportResult.isDuplicate
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

