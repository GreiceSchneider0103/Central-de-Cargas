import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProductsTable } from '@/components/products/ProductsTable';
import type { UserProfile } from '@/lib/auth/roles';

export default async function ProdutosPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile } = await supabase
    .from('users_profile')
    .select('*')
    .eq('auth_user_id', userData.user.id)
    .single<UserProfile>();

  if (!profile) redirect('/');

  const { data: products } = await supabase
    .from('products')
    .select('id,sku,nome,cmv,ativo,last_synced_at,suppliers(nome)')
    .order('nome', { ascending: true });

  const normalized = (products ?? []).map((p: any) => ({
    ...p,
    supplier_name: p.suppliers?.nome ?? null,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Produtos</h1>
      <p className="text-zinc-600">Sincronização inicial de SKU, nome e CMV via Google Sheets.</p>
      <ProductsTable products={normalized} role={profile.perfil} />
    </div>
  );
}
