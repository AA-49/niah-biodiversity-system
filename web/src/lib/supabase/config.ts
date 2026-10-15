// Same check as isSupabaseConfigured in item 14's lib/supabase.ts. Kept here
// so the auth code does not depend on that branch being merged first.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "";

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anonKey;

export const authConfigured = Boolean(
  url &&
    anonKey &&
    !url.includes("your-project-id") &&
    !anonKey.includes("your-anon-key"),
);
