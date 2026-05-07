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

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const { data: existing } = await supabase.from('products').select('id').eq('sku', row.sku).maybeSingle();

    if (!existing) {
      const { error } = await supabase.from('products').insert({
        sku: row.sku,
        nome: row.nome,
        cmv: row.cmv,
        last_synced_at: new Date().toISOString(),
      });
      if (error) throw error;
      created += 1;
    } else {
      const { error } = await supabase
        .from('products')
        .update({ nome: row.nome, cmv: row.cmv, last_synced_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
      updated += 1;
    }
  }

  return { totalRows: rows.length, created, updated };
}
