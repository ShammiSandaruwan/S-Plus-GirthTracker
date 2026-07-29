import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyGasHmac } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-gas-signature, x-gas-timestamp, x-gas-nonce, x-admin-token',
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

    const bodyText = await req.text();
    const body = JSON.parse(bodyText);
    const { action, requestId } = body;

    // Determine auth method: HMAC (from GAS Telegram callback) or admin token (from /mod)
    const hasHmac = req.headers.get('x-gas-signature');
    const adminToken = req.headers.get('x-admin-token');

    if (hasHmac) {
      // HMAC verification for GAS → Edge Function calls
      const hmacResult = await verifyGasHmac(req, bodyText, supabaseAdmin);
      if (!hmacResult.valid) {
        return new Response(JSON.stringify({ error: hmacResult.error }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else if (adminToken) {
      // Admin session token validation via GAS
      const gasUrl = Deno.env.get('GAS_URL') || '';
      if (gasUrl) {
        const valRes = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'validate_admin_session', adminSessionToken: adminToken }),
        });
        const valResult = await valRes.json();
        if (!valResult.success) {
          return new Response(JSON.stringify({ error: 'Invalid admin session' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    } else {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'approve') {
      return await handleApprove(requestId, body, supabaseAdmin);
    } else if (action === 'deny') {
      return await handleDeny(requestId, body, supabaseAdmin);
    } else if (action === 'revoke') {
      return await handleRevoke(body, supabaseAdmin);
    } else {
      return new Response(JSON.stringify({ error: 'Unknown action' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function handleApprove(
  requestId: string,
  body: any,
  supabaseAdmin: ReturnType<typeof createClient>
) {
  if (!requestId) {
    return new Response(JSON.stringify({ error: 'requestId is required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Fetch request — must be pending
  const { data: request, error } = await supabaseAdmin
    .from('access_requests')
    .select('*')
    .eq('request_id', requestId)
    .single();

  if (error || !request) {
    return new Response(JSON.stringify({ error: 'Request not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (request.status !== 'pending') {
    return new Response(JSON.stringify({
      error: `Request already ${request.status}`,
      status: request.status
    }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Generate device token — raw token returned once, only hash stored
  const rawToken = `TOK-${crypto.randomUUID()}`;
  const encoder = new TextEncoder();
  const tokenHash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(rawToken)))
  ).map(b => b.toString(16).padStart(2, '0')).join('');

  const approvedAt = new Date().toISOString();
  const performedBy = body.performedBy || 'telegram_admin';

  // Update access request
  await supabaseAdmin
    .from('access_requests')
    .update({
      status: 'approved',
      approved_at: approvedAt,
      approved_by: performedBy,
    })
    .eq('request_id', requestId);

  // Upsert approved device
  const { error: deviceError } = await supabaseAdmin
    .from('approved_devices')
    .upsert({
      device_id_hash: request.device_id_hash,
      token_hash: tokenHash,
      estate_code: request.estate_code,
      operator_name: request.operator_name,
      approved_at: approvedAt,
      revoked: false,
      revoked_at: null,
    }, { onConflict: 'device_id_hash' });

  if (deviceError) {
    throw new Error(`Failed to create approved device: ${deviceError.message}`);
  }

  // Create audit event (token hash only, never raw token)
  await supabaseAdmin.from('approval_events').insert({
    event_type: 'approve',
    request_id: requestId,
    device_id_hash: request.device_id_hash,
    estate_code: request.estate_code,
    operator_name: request.operator_name,
    performed_by: performedBy,
    event_data: { approved_at: approvedAt }
  });

  // Return raw token — this is the ONLY time it is ever transmitted.
  // The Edge Function does NOT log or store the raw token.
  return new Response(JSON.stringify({
    success: true,
    deviceToken: rawToken,
    message: 'Device approved.',
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleDeny(
  requestId: string,
  body: any,
  supabaseAdmin: ReturnType<typeof createClient>
) {
  if (!requestId) {
    return new Response(JSON.stringify({ error: 'requestId is required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { data: request, error } = await supabaseAdmin
    .from('access_requests')
    .select('*')
    .eq('request_id', requestId)
    .single();

  if (error || !request) {
    return new Response(JSON.stringify({ error: 'Request not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (request.status !== 'pending') {
    return new Response(JSON.stringify({
      error: `Request already ${request.status}`
    }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const deniedAt = new Date().toISOString();
  const performedBy = body.performedBy || 'telegram_admin';

  await supabaseAdmin
    .from('access_requests')
    .update({ status: 'denied', denied_at: deniedAt, denied_by: performedBy })
    .eq('request_id', requestId);

  await supabaseAdmin.from('approval_events').insert({
    event_type: 'deny',
    request_id: requestId,
    device_id_hash: request.device_id_hash,
    estate_code: request.estate_code,
    operator_name: request.operator_name,
    performed_by: performedBy,
  });

  return new Response(JSON.stringify({ success: true, message: 'Request denied.' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleRevoke(
  body: any,
  supabaseAdmin: ReturnType<typeof createClient>
) {
  const { deviceIdHash } = body;
  if (!deviceIdHash) {
    return new Response(JSON.stringify({ error: 'deviceIdHash required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const revokedAt = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from('approved_devices')
    .update({ revoked: true, revoked_at: revokedAt })
    .eq('device_id_hash', deviceIdHash);

  if (error) {
    throw new Error(`Revocation failed: ${error.message}`);
  }

  await supabaseAdmin.from('approval_events').insert({
    event_type: 'revoke',
    device_id_hash: deviceIdHash,
    performed_by: body.performedBy || 'mod_admin',
    event_data: { revoked_at: revokedAt },
  });

  return new Response(JSON.stringify({ success: true, message: 'Device revoked.' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
