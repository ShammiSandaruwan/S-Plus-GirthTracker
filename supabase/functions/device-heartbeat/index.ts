import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateDeviceFromSupabase } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, x-device-id, x-device-token',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const deviceId = req.headers.get('x-device-id');
    const deviceToken = req.headers.get('x-device-token');

    if (!deviceId || !deviceToken) {
      return new Response(JSON.stringify({ error: 'Missing device credentials' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authResult = await validateDeviceFromSupabase(deviceId, deviceToken, supabaseAdmin);

    if (!authResult.valid) {
      return new Response(JSON.stringify({
        success: false,
        error: authResult.error,
        errorCode: authResult.errorCode,
      }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
