import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { requestId, deviceId } = await req.json();

    if (!requestId || !deviceId) {
      return new Response(JSON.stringify({ error: 'Missing requestId or deviceId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Hash device ID
    const encoder = new TextEncoder();
    const deviceIdHash = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(deviceId)))
    ).map(b => b.toString(16).padStart(2, '0')).join('');

    // Look up request
    const { data: request, error } = await supabaseAdmin
      .from('access_requests')
      .select('*')
      .eq('request_id', requestId)
      .eq('device_id_hash', deviceIdHash)
      .single();

    if (error || !request) {
      return new Response(JSON.stringify({ success: false, error: 'Request not found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (request.status === 'pending') {
      return new Response(JSON.stringify({ success: true, status: 'pending' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (request.status === 'denied') {
      return new Response(JSON.stringify({
        success: true, status: 'denied', message: 'Access request denied.'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (request.status === 'approved') {
      // Look up approved device to get token
      // Token is returned via a one-time read from approved_devices
      // The raw token was generated during approval and stored temporarily
      const { data: device } = await supabaseAdmin
        .from('approved_devices')
        .select('estate_code, operator_name')
        .eq('device_id_hash', deviceIdHash)
        .single();

      if (!device) {
        return new Response(JSON.stringify({
          success: false, error: 'Approved device record not found.'
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // The raw device token was delivered through approval and cached client-side.
      // For the transition period, we also check GAS cache.
      // On new approvals, the token is embedded in the approval response.
      return new Response(JSON.stringify({
        success: true,
        status: 'approved',
        estate: device.estate_code || request.estate_code,
        operatorName: device.operator_name || request.operator_name,
        approvedAt: request.approved_at,
        expiresAt: '',
        // deviceToken is NOT returned here — it was delivered once during approval.
        // Client must have saved it locally. If lost, admin must re-approve.
        needsTokenFromApproval: true,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: false, error: 'Unknown status.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
