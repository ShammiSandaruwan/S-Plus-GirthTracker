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

    // Get config version
    const { data: meta } = await supabaseAdmin
      .from('config_metadata')
      .select('version, updated_at')
      .eq('id', 1)
      .single();

    // Check if client already has this version
    const body = req.method === 'POST' ? await req.json() : {};
    const clientVersion = body.configVersion || 0;

    if (meta && clientVersion >= meta.version) {
      return new Response(JSON.stringify({
        success: true,
        upToDate: true,
        configVersion: meta.version,
        updatedAt: meta.updated_at
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch active estates
    const { data: estates } = await supabaseAdmin
      .from('estates')
      .select('id, code, name')
      .eq('active', true)
      .order('name');

    // Fetch active divisions
    const { data: divisions } = await supabaseAdmin
      .from('divisions')
      .select('id, estate_id, code, name')
      .eq('active', true)
      .order('name');

    // Fetch active fields
    const { data: fields } = await supabaseAdmin
      .from('fields')
      .select('id, estate_id, division_id, field_code, display_name, extent_ha, yop')
      .eq('active', true)
      .order('field_code');

    return new Response(JSON.stringify({
      success: true,
      upToDate: false,
      configVersion: meta?.version || 1,
      updatedAt: meta?.updated_at || new Date().toISOString(),
      estates: estates || [],
      divisions: divisions || [],
      fields: fields || []
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
