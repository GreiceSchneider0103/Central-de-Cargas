import { createClient } from '@supabase/supabase-js';
import { fetchProductsFromGoogleSheets } from '@/lib/googleSheets';

export async function syncProducts() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    throw new Error('Configuração do Supabase incompleta para sincronização server-side.');
  }

  const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
  const rows = await fetchProductsFromGoogleSheets();
  const now = new Date().toISOString();

  const payload = rows.map((row) => ({
    sku: row.sku,
    nome: row.nome,
    cmv: row.cmv,
    last_synced_at: now,
  }));

  if (payload.length === 0) {
    return { totalRows: 0, created: 0, updated: 0 };
  }

  const { data: before } = await supabase.from('products').select('sku');
  const existing = new Set((before ?? []).map((p) => p.sku));

  const { error } = await supabase
    .from('products')
    .upsert(payload, { onConflict: 'sku', ignoreDuplicates: false });

  if (error) throw error;

  let created = 0;
  let updated = 0;
  for (const p of payload) {
    if (existing.has(p.sku)) updated += 1;
    else created += 1;
  }

  return { totalRows: payload.length, created, updated };
}
