import Link from 'next/link';
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
  fornecedor_id?: string | null;
  suppliers?: ProductSupplier[] | ProductSupplier | null;
  supplier_name?: string | null;
};

const PAGE_SIZE = 50;

export default async function ProdutosPage({ searchParams }: { searchParams?: Promise<{ page?: string }> }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile } = await supabase
    .from('users_profile')
    .select('*')
    .eq('auth_user_id', userData.user.id)
    .single<UserProfile>();

  if (!profile) redirect('/');

  const resolvedSearchParams = await searchParams;
  const currentPage = Math.max(1, Number(resolvedSearchParams?.page ?? '1') || 1);

  const { data: products } = await supabase.rpc('get_visible_products_page', { p_page: currentPage, p_page_size: PAGE_SIZE });

  const typedProducts = (products ?? []) as (ProductWithSupplier & { total_count?: number })[];
  const totalProducts = Number(typedProducts[0]?.total_count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
  const normalized = typedProducts.map((p) => {
    const supplier = Array.isArray(p.suppliers) ? p.suppliers[0] : p.suppliers;

    return {
      ...p,
      cmv: p.cmv ?? 0,
      ativo: p.ativo ?? false,
      supplier_name: p.supplier_name ?? supplier?.nome ?? p.fornecedor_id ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Produtos</h1>
        <p className="text-sm text-zinc-500">Sincronização de SKU, nome e CMV via Google Sheets, toda segunda-feira às 8h.</p>
      </div>
      <ProductsTable products={normalized} role={profile.perfil} />
      <div className="flex items-center justify-between text-sm">
        <Link
          className={`rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50 ${currentPage === 1 ? 'pointer-events-none opacity-50' : ''}`}
          href={`/produtos?page=${Math.max(1, currentPage - 1)}`}
        >
          Anterior
        </Link>
        <span className="text-zinc-500">Página {currentPage} de {totalPages} ({totalProducts} produtos)</span>
        <Link
          className={`rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50 ${currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
          href={`/produtos?page=${currentPage + 1}`}
        >
          Próxima
        </Link>
      </div>
    </div>
  );
}
