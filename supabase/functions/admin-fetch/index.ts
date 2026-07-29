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
    const gasUrl = Deno.env.get('GAS_URL') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables missing');
    }

    const adminToken = req.headers.get('x-admin-token');
    if (!adminToken) {
      return new Response(JSON.stringify({ error: 'Missing admin token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { estate, division, fieldNo, estate_id, division_id, field_id, dateFrom, dateTo, status } = await req.json();

    // 1. Validate admin token using GAS (or via Supabase if token logic is migrated)
    const validateResponse = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'validate_admin_session',
        adminSessionToken: adminToken
      })
    });

    const validateResult = await validateResponse.json();
    if (!validateResult.success) {
      return new Response(JSON.stringify({ error: 'Invalid or expired admin session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Allow fetching across all estates if no specific estate or estate_id is provided
    // If estate_id is provided, use it. Else fallback to text.
    let query = supabaseAdmin
      .from('census_measurements')
      .select('*');

    if (estate_id) {
      query = query.eq('estate_id', estate_id);
    } else if (estate) {
      query = query.eq('estate', estate);
    }

    if (division_id) {
      query = query.eq('division_id', division_id);
    } else if (division) {
      query = query.eq('division', division);
    }

    if (field_id) {
      query = query.eq('field_id', field_id);
    } else if (fieldNo) {
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
      estate: r.estate,
      division: r.division,
      fieldNo: r.field_no,
      extent: r.extent,
      treeNo: r.tree_no,
      caliperReading: r.caliper_reading,
      girth: r.girth,
      girthCm: r.girth_cm,
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
