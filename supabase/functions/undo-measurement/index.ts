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

    const { estate, division, fieldNo, extent, treeNo } = await req.json();

    if (!estate || !division || !fieldNo || !extent || !treeNo) {
      return new Response(JSON.stringify({ error: 'Missing required measurement identifiers' }), {
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

    // Delete the measurement
    const { error: deleteError } = await supabaseAdmin
      .from('census_measurements')
      .delete()
      .match({
        estate: estate,
        division: division,
        field_no: fieldNo,
        extent: extent,
        tree_no: treeNo
      });

    if (deleteError) {
      throw deleteError;
    }

    // Update device last_sync_at (even for undo)
    await supabaseAdmin
      .from('approved_devices')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('device_id_hash', authResult.deviceIdHash);

    return new Response(JSON.stringify({ success: true, message: 'Measurement deleted successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
