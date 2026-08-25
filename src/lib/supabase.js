import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://cxjhquprsmxkaqmznjfd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4amhxdXByc214a2FxbXpuamZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDMzMjMsImV4cCI6MjA5ODAxOTMyM30.sqRmsjZ1LXIC4F3_E2ZpPndzyo2KI4b94FtozJ3TCcE";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
});
