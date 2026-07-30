import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SignJWT, jwtVerify } from "https://deno.land/x/jose@v5.1.3/index.ts";
import * as OTPAuth from "https://esm.sh/otpauth@9.3.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function respond(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const adminSecret = Deno.env.get('ADMIN_APPROVAL_KEY') || '';
  const totpSecretBase32 = Deno.env.get('ADMIN_TOTP_SECRET') || '';

  if (!supabaseUrl || !supabaseKey || !adminSecret || !totpSecretBase32) {
    return respond({ error: 'Server misconfiguration' }, 500);
  }

  const db = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const action = body.action;

    // ==========================================
    // ACTION: LOGIN
    // ==========================================
    if (action === 'login') {
      const { username, code } = body;
      const ip = req.headers.get("x-forwarded-for") || "unknown";
      const adminId = username || 'admin';

      // 1. Rate Limiting Check
      const { data: rlData } = await db.from('admin_rate_limits')
        .select('*')
        .eq('ip_address', ip)
        .eq('admin_identifier', adminId)
        .single();

      if (rlData && rlData.locked_until && new Date(rlData.locked_until) > new Date()) {
        return respond({ error: 'Too many attempts. Try again later.' }, 429);
      }

      // 2. Validate TOTP
      let totpValid = false;
      try {
        const totp = new OTPAuth.TOTP({
          issuer: "GirthTracker",
          label: "Admin",
          algorithm: "SHA1",
          digits: 6,
          period: 30,
          secret: OTPAuth.Secret.fromBase32(totpSecretBase32),
        });
        const delta = totp.validate({ token: code, window: 1 });
        totpValid = (delta !== null);
      } catch (e) {
        totpValid = false;
      }

      if (!totpValid) {
        // Record failure
        const attempts = rlData ? rlData.failed_attempts + 1 : 1;
        let lockedUntil = null;
        if (attempts >= 5) {
          lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min lock
        }
        await db.from('admin_rate_limits').upsert({
          ip_address: ip,
          admin_identifier: adminId,
          failed_attempts: attempts,
          locked_until: lockedUntil,
          updated_at: new Date().toISOString()
        });
        
        return respond({ error: 'Authentication failed.' }, 401);
      }

      // 3. Reset rate limits on success
      if (rlData) {
        await db.from('admin_rate_limits').update({
          failed_attempts: 0,
          locked_until: null,
          updated_at: new Date().toISOString()
        }).eq('ip_address', ip).eq('admin_identifier', adminId);
      }

      // 4. Create Session in DB
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      const { data: session, error: sessErr } = await db.from('admin_sessions').insert({
        admin_identifier: adminId,
        expires_at: expiresAt.toISOString(),
      }).select().single();

      if (sessErr || !session) {
        return respond({ error: 'Failed to create session' }, 500);
      }

      // 5. Sign JWT
      const secret = new TextEncoder().encode(adminSecret);
      const jwt = await new SignJWT({ 
          sub: adminId, 
          sid: session.sid, 
          role: 'admin' 
        })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setIssuer('girthtracker-edge')
        .setAudience('girthtracker-admin')
        .setExpirationTime('30m')
        .sign(secret);

      return respond({ success: true, token: jwt });
    }

    // ==========================================
    // ACTION: LOGOUT
    // ==========================================
    if (action === 'logout') {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      
      if (!token) return respond({ error: 'No token provided' }, 400);

      const secret = new TextEncoder().encode(adminSecret);
      try {
        const { payload } = await jwtVerify(token, secret, {
          issuer: 'girthtracker-edge',
          audience: 'girthtracker-admin'
        });

        // Revoke the session in DB
        if (payload.sid) {
          await db.from('admin_sessions').update({
            revoked_at: new Date().toISOString()
          }).eq('sid', payload.sid);
        }

        return respond({ success: true, message: 'Logged out successfully' });
      } catch (err) {
        return respond({ success: true, message: 'Logged out (or invalid token)' });
      }
    }

    // ==========================================
    // ACTION: VALIDATE_SESSION (used internally or directly)
    // ==========================================
    if (action === 'validate_session') {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      
      if (!token) return respond({ valid: false, error: 'No token provided' }, 401);

      const secret = new TextEncoder().encode(adminSecret);
      try {
        const { payload } = await jwtVerify(token, secret, {
          issuer: 'girthtracker-edge',
          audience: 'girthtracker-admin'
        });

        if (!payload.sid) throw new Error('Missing sid');
        
        const { data: session } = await db.from('admin_sessions')
          .select('*')
          .eq('sid', payload.sid)
          .single();

        if (!session || session.revoked_at || new Date(session.expires_at) < new Date()) {
          throw new Error('Session invalid, revoked, or expired');
        }

        // Update last seen
        await db.from('admin_sessions').update({
          last_seen_at: new Date().toISOString()
        }).eq('sid', payload.sid);

        return respond({ valid: true, admin: payload.sub });
      } catch (err: any) {
        return respond({ valid: false, error: 'Unauthorized' }, 401);
      }
    }

    return respond({ error: 'Invalid action' }, 400);

  } catch (err: any) {
    return respond({ error: 'Internal error' }, 500);
  }
});
