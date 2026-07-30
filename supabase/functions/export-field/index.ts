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
    const adminToken = req.headers.get('x-admin-token');
    if (!adminToken) {
      return new Response(JSON.stringify({ error: 'Missing admin token' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { estate, division, fieldNo } = await req.json();
    if (!estate || !fieldNo) {
      return new Response(JSON.stringify({ error: 'Estate and Field No are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const gasUrl = Deno.env.get('GAS_URL') || '';
    const gasSharedSecret = Deno.env.get('GAS_SHARED_SECRET') || '';
    if (!gasUrl) {
      return new Response(JSON.stringify({ error: 'GAS_URL not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    
    // 1. Validate admin session via admin-auth Edge Function
    if (supabaseUrl) {
      const valRes = await fetch(`${supabaseUrl}/functions/v1/admin-auth`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ action: 'validate_session' }),
      });
      const valResult = await valRes.json();
      if (!valResult.valid) {
        return new Response(JSON.stringify({ error: valResult.error || 'Invalid or expired admin session' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // 2. Look up spreadsheet mapping from estate_sheet_exports
    let spreadsheetId = null;
    let tabName = 'Sheet1';
    
    // First, resolve the estate_id
    const { data: estateData } = await supabaseAdmin
      .from('estates')
      .select('id')
      .eq('code', estate)
      .single();

    if (estateData) {
      const { data: mapping } = await supabaseAdmin
        .from('estate_sheet_exports')
        .select('spreadsheet_id, tab_name')
        .eq('estate_id', estateData.id)
        .eq('active', true)
        .single();
        
      if (mapping) {
        spreadsheetId = mapping.spreadsheet_id;
        tabName = mapping.tab_name;
      }
    }

    // 3. Fetch measurements
    const { data: measurements, error: fetchErr } = await supabaseAdmin
      .from('census_measurements')
      .select('*')
      .eq('estate', estate)
      .eq('division', division)
      .eq('field_no', fieldNo)
      .order('tree_no', { ascending: true });

    if (fetchErr) throw fetchErr;

    if (!measurements || measurements.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No measurements found for this field' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. Send to GAS for export
    // We pass spreadsheetId if we found it. GAS will fall back to its internal map if not provided.
    const exportPayload = JSON.stringify({
      action: 'export_to_sheet',
      gasSharedSecret, // Use shared secret instead of adminSessionToken for auth
      estate,
      division,
      fieldNo,
      rows: measurements,
      spreadsheetId, // Optional: if present, GAS uses it instead of hardcoded map
      tabName,       // Optional
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

    // 5. Mark as exported
    const batchId = `EXP-${crypto.randomUUID()}`;
    const exportedAt = new Date().toISOString();

    const ids = measurements.map(m => m.id);
    const { error: updateErr } = await supabaseAdmin
      .from('census_measurements')
      .update({ exported_at: exportedAt, export_batch_id: batchId })
      .in('id', ids);

    if (updateErr) {
       console.error("Failed to mark as exported in Supabase:", updateErr);
       // We still return success since the export itself succeeded, but log the error
    }
    
    // 6. Update mapping last_exported_at
    if (estateData) {
       await supabaseAdmin
         .from('estate_sheet_exports')
         .update({ last_exported_at: exportedAt })
         .eq('estate_id', estateData.id);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Exported ${measurements.length} records successfully.`,
      exportedCount: measurements.length,
      usedSupabaseMapping: !!spreadsheetId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
