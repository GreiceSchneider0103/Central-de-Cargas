import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    throw new Error('Configuração do Supabase incompleta para operações administrativas.');
  }

  return createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
}
