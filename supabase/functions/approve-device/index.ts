import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token, x-telegram-bot-api-secret-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const telegramSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables missing');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let action, requestId, performedBy;
    const isGet = req.method === 'GET';

    if (isGet) {
      // Legacy Web Approval (GET) - e.g. clicking link from email/telegram directly
      const url = new URL(req.url);
      action = url.searchParams.get('action');
      requestId = url.searchParams.get('requestId');
      const adminKey = url.searchParams.get('adminKey');
      
      const expectedAdminKey = Deno.env.get('ADMIN_APPROVAL_KEY');
      if (!expectedAdminKey || adminKey !== expectedAdminKey) {
        return respondHtml('Invalid admin key', false);
      }
      performedBy = 'web_admin_link';
    } else {
      const bodyText = await req.text();
      let body;
      try { body = JSON.parse(bodyText); } catch { body = {}; }

      // --- 1. TELEGRAM WEBHOOK HANDLING ---
      const teleSecretHeader = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
      if (teleSecretHeader) {
        if (!telegramSecret || teleSecretHeader !== telegramSecret) {
          return new Response('Unauthorized Webhook', { status: 403 });
        }

        if (body.callback_query) {
          const callbackQuery = body.callback_query;
          const data = callbackQuery.data; // e.g. "approve:REQ-123"
          const chatId = callbackQuery.message?.chat?.id;
          const messageId = callbackQuery.message?.message_id;

          if (data && (data.startsWith('approve:') || data.startsWith('deny:'))) {
            const [cbAction, cbRequestId] = data.split(':');
            
            // Execute Atomic RPC
            const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('process_telegram_approval', {
              p_request_id: cbRequestId,
              p_action: cbAction,
              p_admin_identifier: `telegram_chat_${chatId}`
            });

            let resultMessage = '';
            if (rpcError) {
              resultMessage = `❌ Error: ${rpcError.message}`;
            } else if (!rpcResult.success) {
              resultMessage = `❌ Error: ${rpcResult.error}`;
            } else {
              resultMessage = cbAction === 'approve' ? '✅ Device Approved!' : '❌ Device Denied.';
            }

            const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
            if (botToken) {
              // 1. Answer the callback query to show a toast
              await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: callbackQuery.id, text: resultMessage, show_alert: true })
              });

              // 2. Edit the original message to remove buttons and append status
              if (chatId && messageId && callbackQuery.message.text) {
                await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: chatId,
                    message_id: messageId,
                    text: `${callbackQuery.message.text}\n\nStatus: ${resultMessage}`
                  })
                });
              }
            }
          }
        }
        return new Response('OK'); // Always return OK to Telegram
      }
      // --- END TELEGRAM WEBHOOK HANDLING ---

      // --- 2. ADMIN DASHBOARD API HANDLING ---
      const adminToken = req.headers.get('x-admin-token');
      if (!adminToken) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Missing admin token' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Validate session via admin-auth
      const authRes = await fetch(`${supabaseUrl}/functions/v1/admin-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'validate_session' })
      });
      const authResult = await authRes.json();
      
      if (!authResult.valid) {
        return new Response(JSON.stringify({ error: authResult.error || 'Invalid session' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      action = body.action;
      requestId = body.requestId;
      performedBy = authResult.admin;
    } // End if (isGet)
    
    // Process Dashboard / Web-link Actions (Approve/Deny) using RPC
    if (action === 'approve' || action === 'deny') {
      if (!requestId) {
        const errStr = JSON.stringify({ error: 'requestId is required' });
        return isGet ? respondHtml('requestId is required', false) : new Response(errStr, { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('process_telegram_approval', {
        p_request_id: requestId,
        p_action: action,
        p_admin_identifier: performedBy
      });

      if (rpcError) {
        const errStr = JSON.stringify({ error: rpcError.message });
        return isGet ? respondHtml('Error: ' + rpcError.message, false) : new Response(errStr, { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (!rpcResult.success) {
        const errStr = JSON.stringify({ error: rpcResult.error });
        return isGet ? respondHtml('Error: ' + rpcResult.error, false) : new Response(errStr, { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const successStr = JSON.stringify({ success: true, message: `Request ${action}d successfully.`, ...rpcResult });
      return isGet ? respondHtml(`Request ${action}d successfully.`, true) : new Response(successStr, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'revoke') {
       // Keep simple JS logic for revoke since we didn't write an RPC for revoke
       return new Response(JSON.stringify({ error: 'Revoke action should be handled via admin-config' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const unkStr = JSON.stringify({ error: 'Unknown action' });
    return isGet ? respondHtml('Unknown action', false) : new Response(unkStr, { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    if (req.method === 'GET') return respondHtml('Error processing request: ' + err.message, false);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function respondHtml(message: string, isSuccess: boolean) {
  const color = isSuccess ? '#4CAF50' : '#F44336';
  const icon = isSuccess ? '✅' : '❌';
  const html = `<!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f9f9f9; }
          .card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 90%; }
          h2 { color: ${color}; margin-top: 10px; }
          .icon { font-size: 48px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">${icon}</div>
          <h2>${message}</h2>
          <p>You can now close this window.</p>
        </div>
      </body>
    </html>`;
  const headers = new Headers(corsHeaders);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(html, { headers });
}
