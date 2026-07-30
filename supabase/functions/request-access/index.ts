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
    const gasUrl = Deno.env.get('GAS_URL') || '';

    const { estate, operatorName, deviceId, location, userAgent, appVersion } = await req.json();

    if (!estate || !operatorName || !deviceId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Hash device ID
    const encoder = new TextEncoder();
    const deviceIdHash = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(deviceId)))
    ).map(b => b.toString(16).padStart(2, '0')).join('');

    const requestId = `REQ-${crypto.randomUUID()}`;

    // Store in Supabase
    const { error: insertError } = await supabaseAdmin
      .from('access_requests')
      .insert({
        request_id: requestId,
        estate_code: estate,
        operator_name: operatorName,
        device_id_hash: deviceIdHash,
        user_agent: userAgent || null,
        app_version: appVersion || null,
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        gps_accuracy: location?.accuracy || null,
        gps_status: location?.status || null,
        google_map_link: location?.googleMapLink || null,
        status: 'pending',
      });

    if (insertError) {
      throw new Error(`Failed to create request: ${insertError.message}`);
    }

    // Create audit event
    await supabaseAdmin.from('approval_events').insert({
      event_type: 'request',
      request_id: requestId,
      device_id_hash: deviceIdHash,
      estate_code: estate,
      operator_name: operatorName,
      performed_by: 'device',
      event_data: { user_agent: userAgent, app_version: appVersion }
    });

    // Send Telegram notification directly
    let telegramStatus = 'not_sent';
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const telegramChatId = Deno.env.get('TELEGRAM_CHAT_ID');

    if (telegramBotToken && telegramChatId) {
      try {
        const text = `New GirthTracker Access Request\n\n` +
                     `Estate: ${estate}\n` +
                     `Operator Name: ${operatorName}\n` +
                     `GPS Status: ${location?.status || 'unknown'}\n` +
                     `Requested At: ${new Date().toISOString()}\n\n` +
                     `Approve or deny this device.`;

        const inlineKeyboard: any[] = [
          [
            { text: "✅ Approve", callback_data: `approve:${requestId}` },
            { text: "❌ Deny", callback_data: `deny:${requestId}` }
          ]
        ];

        if (location?.googleMapLink) {
          inlineKeyboard.push([
            { text: "📍 Open Location", url: location.googleMapLink }
          ]);
        }

        const chatIds = telegramChatId.split(',').map(s => s.trim()).filter(Boolean);
        
        for (const id of chatIds) {
          const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: id,
              text: text,
              reply_markup: { inline_keyboard: inlineKeyboard }
            }),
          });
          const result = await res.json();
          if (!result.ok) {
            console.error(`Telegram send failed to ${id}:`, result);
            telegramStatus = 'failed';
          } else {
            telegramStatus = telegramStatus === 'not_sent' ? 'sent' : telegramStatus;
          }
        }
      } catch (e: any) {
        console.error('Telegram error:', e.message);
        telegramStatus = 'failed';
      }
    }

    return new Response(JSON.stringify({
      success: true,
      requestId,
      status: 'pending',
      message: 'Access request submitted.',
      telegramStatus,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
