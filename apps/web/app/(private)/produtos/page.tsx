import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProductsTable } from '@/components/products/ProductsTable';
import type { UserProfile } from '@/lib/auth/roles';

type ProductSupplier = {
  nome?: string | null;
};

type ProductWithSupplier = {
  id: string;
  sku: string;
  nome: string;
  cmv: number | null;
  ativo: boolean | null;
  last_synced_at: string | null;
  suppliers: ProductSupplier[] | ProductSupplier | null;
};

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

  const typedProducts = (products ?? []) as ProductWithSupplier[];

  const normalized = typedProducts.map((p) => {
    const supplier = Array.isArray(p.suppliers) ? p.suppliers[0] : p.suppliers;

    return {
      ...p,
      cmv: p.cmv ?? 0,
      ativo: p.ativo ?? false,
      supplier_name: supplier?.nome ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Produtos</h1>
      <p className="text-zinc-600">Sincronização inicial de SKU, nome e CMV via Google Sheets.</p>
      <ProductsTable products={normalized} role={profile.perfil} />
    </div>
  );
}
