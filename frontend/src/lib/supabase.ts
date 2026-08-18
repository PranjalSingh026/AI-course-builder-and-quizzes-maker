import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local.");
}

/**
 * Shared Supabase browser client for authentication and database queries.
 * The publishable key is intentionally safe to expose in a Vite browser app;
 * protect data with Supabase Row Level Security policies.
 */
export const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
