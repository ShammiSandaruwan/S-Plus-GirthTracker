import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables missing');
    }

    const authHeader = req.headers.get('Authorization') || req.headers.get('x-admin-token');
    const adminToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : null;
    if (!adminToken) {
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { estate, division, fieldNo, estate_id, division_id, field_id, dateFrom, dateTo, status } = await req.json();

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Validate JWT via Supabase Auth
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(adminToken);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired admin session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Check if user is in admin_users allowlist
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('auth_uid', user.id)
      .eq('active', true)
      .single();

    if (adminError || !adminUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized: User is not an active admin' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Allow fetching across all estates if no specific estate or estate_id is provided
    // If estate_id is provided, use it. Else fallback to text.
    let query = supabaseAdmin
      .from('census_measurements')
      .select('*');

    if (estate_id) {
      const { data: estateRow } = await supabaseAdmin
        .from('estates')
        .select('code, name')
        .eq('id', estate_id)
        .maybeSingle();

      if (estateRow) {
        const estateValues = Array.from(new Set([estateRow.code, estateRow.name].filter(Boolean)));
        query = query.in('estate', estateValues);
      }
    } else if (estate && estate !== 'all') {
      query = query.eq('estate', estate);
    }

    if (division_id) {
      const { data: divRow } = await supabaseAdmin
        .from('divisions')
        .select('code, name')
        .eq('id', division_id)
        .maybeSingle();

      if (divRow) {
        const divValues = Array.from(new Set([divRow.code, divRow.name].filter(Boolean)));
        query = query.in('division', divValues);
      }
    } else if (division && division !== 'all') {
      query = query.eq('division', division);
    }

    if (field_id) {
      query = query.eq('field_id', field_id);
    } else if (fieldNo && fieldNo !== 'all') {
      query = query.eq('field_no', fieldNo);
    }

    if (dateFrom) query = query.gte('measured_at', dateFrom);
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      query = query.lte('measured_at', toDate.toISOString());
    }

    if (status && status !== 'all') {
      if (status === 'tappable') query = query.eq('recommendation_status', 'tappable');
      if (status === 'approaching') query = query.eq('recommendation_status', 'approaching');
      if (status === 'below') query = query.eq('recommendation_status', 'not_ready');
      if (status === 'abnormal') query = query.eq('abnormal_flag', true);
    }

    // We can limit this if the dataset is huge, but for now fetch all matches
    const { data: measurements, error: dbError } = await query.order('measured_at', { ascending: false });

    if (dbError) {
      throw new Error(`Failed to fetch data: ${dbError.message}`);
    }

    // Map to the frontend expected structure
    const mappedMeasurements = (measurements || []).map(r => ({
      id: r.local_dexie_id,
      measurementId: r.id,
      fieldId: r.field_id,
      estate: r.estate,
      division: r.division,
      fieldNo: r.field_no,
      extent: r.extent,
      treeNo: r.tree_no,
      caliperReading: r.caliper_reading,
      girth: r.girth,
      girthCm: r.girth_cm,
      treeCondition: r.tree_condition || 'healthy',
      conditionNote: r.condition_note || null,
      recommendationStatus: r.recommendation_status,
      recommendationText: r.recommendation_text,
      abnormalFlag: r.abnormal_flag,
      abnormalReason: r.abnormal_reason,
      latitude: r.latitude,
      longitude: r.longitude,
      gpsAccuracy: r.gps_accuracy,
      googleMapLink: r.google_map_link,
      operatorName: r.operator_name,
      sessionId: r.session_id,
      date: r.measured_at,
      exportedAt: r.exported_at
    }));

    return new Response(JSON.stringify({ success: true, measurements: mappedMeasurements }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Fetch error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
