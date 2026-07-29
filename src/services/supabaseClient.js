// Currently not used directly as we use Edge Functions, but kept for potential future use (e.g. auth)
// NO SERVICE ROLE KEY HERE!

// NOTE: We don't initialize the full client here if we only use edge functions via fetch.
// But we'll export the URLs for edge functions.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || `${SUPABASE_URL}/functions/v1`;
