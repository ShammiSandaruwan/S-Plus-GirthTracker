import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Verify HMAC signature from GAS requests.
 * Checks: timestamp window, nonce uniqueness (persistent), HMAC match.
 * Returns { valid: boolean, error?: string }
 */
export async function verifyGasHmac(
  req: Request,
  body: string,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<{ valid: boolean; error?: string }> {
  const sharedSecret = Deno.env.get('GAS_SHARED_SECRET') || '';
  if (!sharedSecret) {
    return { valid: false, error: 'GAS_SHARED_SECRET not configured' };
  }

  const signature = req.headers.get('x-gas-signature');
  const timestamp = req.headers.get('x-gas-timestamp');
  const nonce = req.headers.get('x-gas-nonce');

  if (!signature || !timestamp || !nonce) {
    return { valid: false, error: 'Missing HMAC headers' };
  }

  // 1. Timestamp window check (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > 300) {
    return { valid: false, error: 'Request timestamp outside allowed window' };
  }

  // 2. Persistent nonce check — atomic insert
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
  const { error: nonceError } = await supabaseAdmin
    .from('request_nonces')
    .insert({ nonce, expires_at: expiresAt });

  if (nonceError) {
    // Unique constraint violation = replay
    if (nonceError.code === '23505') {
      return { valid: false, error: 'Duplicate nonce — replay rejected' };
    }
    return { valid: false, error: `Nonce check failed: ${nonceError.message}` };
  }

  // 3. HMAC verification
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(sharedSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expectedHex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (expectedHex !== signature) {
    return { valid: false, error: 'HMAC signature mismatch' };
  }

  return { valid: true };
}

/**
 * Validate a device against Supabase approved_devices table.
 * Returns { valid, deviceIdHash?, error?, errorType? }
 */
export async function validateDeviceFromSupabase(
  deviceId: string,
  deviceToken: string,
  estate: string,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<{ valid: boolean; deviceIdHash?: string; error?: string; errorType?: string }> {
  // Hash the device ID and token
  const encoder = new TextEncoder();

  const idHash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(deviceId)))
  ).map(b => b.toString(16).padStart(2, '0')).join('');

  const tokenHash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(deviceToken)))
  ).map(b => b.toString(16).padStart(2, '0')).join('');

  // Look up device
  const { data: device, error } = await supabaseAdmin
    .from('approved_devices')
    .select('*')
    .eq('device_id_hash', idHash)
    .single();

  if (error || !device) {
    return { valid: false, error: 'Device not approved.', errorType: 'auth_failed' };
  }

  if (device.revoked) {
    return { valid: false, error: 'Device revoked.', errorType: 'auth_failed' };
  }

  if (device.expires_at && new Date(device.expires_at) < new Date()) {
    return { valid: false, error: 'Access expired. Please contact administrator.', errorType: 'subscription_expired' };
  }

  if (device.token_hash !== tokenHash) {
    return { valid: false, error: 'Invalid token.', errorType: 'auth_failed' };
  }

  if (device.estate_code !== estate) {
    return { valid: false, error: 'Estate mismatch.', errorType: 'auth_failed' };
  }

  // Update last_seen_at
  await supabaseAdmin
    .from('approved_devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('device_id_hash', idHash);

  return { valid: true, deviceIdHash: idHash };
}
