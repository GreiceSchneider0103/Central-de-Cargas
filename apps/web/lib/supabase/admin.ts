import { createClient } from '@supabase/supabase-js';

// Server-only client using the service role key. Never import this from a
// client component — it bypasses RLS entirely.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error('SUPABASE_ADMIN_CONFIG_MISSING');
  }

  return createClient(url, serviceRole, { auth: { persistSession: false } });
}
