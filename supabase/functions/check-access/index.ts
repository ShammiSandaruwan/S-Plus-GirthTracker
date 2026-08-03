import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const fetchedAt = new Date().toISOString();

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const { requestId, deviceId } = await req.json();

    if (!requestId || !deviceId) {
      return new Response(JSON.stringify({ error: 'Missing requestId or deviceId', fetched_at: fetchedAt }), {
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
      .maybeSingle();

    if (error || !request) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Request not found.',
        errorType: 'request_not_found',
        fetched_at: fetchedAt
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (request.status === 'pending') {
      return new Response(JSON.stringify({ success: true, status: 'pending', fetched_at: fetchedAt }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (request.status === 'denied') {
      return new Response(JSON.stringify({
        success: true, status: 'denied', message: 'Access request denied.', fetched_at: fetchedAt
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (request.status === 'approved') {
      const { data: device } = await supabaseAdmin
        .from('approved_devices')
        .select('estate_code, operator_name, revoked')
        .eq('device_id_hash', deviceIdHash)
        .maybeSingle();

      if (!device || device.revoked) {
        return new Response(JSON.stringify({
          success: false,
          error: device?.revoked ? 'Device revoked.' : 'Approved device record not found.',
          errorType: device?.revoked ? 'device_revoked' : 'device_not_found',
          fetched_at: fetchedAt
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let deviceToken = null;
      if (request.pending_token) {
        deviceToken = request.pending_token;
        await supabaseAdmin
          .from('access_requests')
          .update({ pending_token: null, token_claimed_at: new Date().toISOString() })
          .eq('request_id', requestId);
      }

      return new Response(JSON.stringify({
        success: true,
        status: 'approved',
        estate: device.estate_code || request.estate_code,
        operatorName: device.operator_name || request.operator_name,
        approvedAt: request.approved_at,
        expiresAt: '',
        deviceToken,
        needsTokenFromApproval: !deviceToken,
        fetched_at: fetchedAt,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: false, error: 'Unknown status.', fetched_at: fetchedAt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message, fetched_at: fetchedAt }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

