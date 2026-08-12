import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveAdminAuth } from "../_shared/adminAuth.ts";

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

    const { estate, division, fieldNo, estate_id, division_id, field_id, dateFrom, dateTo, status } = await req.json();

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Validate JWT + resolve role and estate assignments via shared helper
    const auth = await resolveAdminAuth(supabaseAdmin, adminToken);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const callerRole = auth.role!;
    const callerEstateCodes = auth.estateCodes!;

    const PAGE_SIZE = 1000;

    let selectedEstateCode: string | null = null;
    if (estate_id) {
      if (callerRole !== 'superadmin' && !callerEstateIds.includes(estate_id)) {
        return new Response(JSON.stringify({ success: true, measurements: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: estateRow } = await supabaseAdmin
        .from('estates')
        .select('code')
        .eq('id', estate_id)
        .maybeSingle();

      if (!estateRow?.code) {
        return new Response(JSON.stringify({ success: true, measurements: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      selectedEstateCode = estateRow.code;
    } else if (estate && estate !== 'all') {
      if (callerRole !== 'superadmin' && !callerEstateCodes.includes(estate)) {
        return new Response(JSON.stringify({ success: true, measurements: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      selectedEstateCode = estate;
    }

    let selectedDivisionCode: string | null = null;
    if (division_id) {
      const { data: divRow } = await supabaseAdmin
        .from('divisions')
        .select('code')
        .eq('id', division_id)
        .maybeSingle();

      if (divRow?.code) {
        selectedDivisionCode = divRow.code;
      }
    } else if (division && division !== 'all') {
      selectedDivisionCode = division;
    }

    const buildQuery = () => {
      let query = supabaseAdmin
        .from('census_measurements')
        .select('*');

      if (callerRole !== 'superadmin') {
        query = query.in('estate', callerEstateCodes);
      }

      if (selectedEstateCode) {
        query = query.eq('estate', selectedEstateCode);
      }

      if (selectedDivisionCode) {
        query = query.eq('division', selectedDivisionCode);
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

      return query.order('measured_at', { ascending: false });
    };

    // Mandatory estate scope for non-superadmin callers
    if (callerRole !== 'superadmin') {
      if (callerEstateCodes.length === 0) {
        return new Response(JSON.stringify({ success: true, measurements: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    let measurements: any[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const fromIndex = page * PAGE_SIZE;
      const toIndex = (page + 1) * PAGE_SIZE - 1;
      const { data, error: dbError } = await buildQuery().range(fromIndex, toIndex);

      if (dbError) {
        throw new Error(`Failed to fetch data: ${dbError.message}`);
      }

      if (data && data.length > 0) {
        measurements.push(...data);
      }

      if (!data || data.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
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
