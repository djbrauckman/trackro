/**
 * supabaseClient.js
 * Single shared Supabase client, built from config.js.
 */
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
