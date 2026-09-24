import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProductsTable } from '@/components/products/ProductsTable';
import type { UserProfile } from '@/lib/auth/roles';
import type { ProductRow } from '@/lib/products/types';

type ProductPageRow = Omit<ProductRow, 'cmv' | 'ativo' | 'company_ids'> & {
  cmv: number | null;
  ativo: boolean | null;
  company_ids: string[] | null;
  total_count?: number;
};

const PAGE_SIZE = 50;

export default async function ProdutosPage({ searchParams }: { searchParams?: Promise<{ page?: string; search?: string; empresa?: string }> }) {
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
  const search = resolvedSearchParams?.search?.trim() ?? '';

  const [{ data: companies }, { data: suppliers }] = await Promise.all([
    supabase.from('companies').select('id,nome').eq('ativo', true).order('nome'),
    supabase.from('suppliers').select('id,nome').eq('ativo', true).order('nome'),
  ]);
  const companyList = (companies ?? []) as { id: string; nome: string }[];
  const requestedCompany = resolvedSearchParams?.empresa ?? '';
  const companyId = companyList.some((c) => c.id === requestedCompany) ? requestedCompany : '';

  const { data: products } = await supabase.rpc('get_visible_products_page', {
    p_page: currentPage,
    p_page_size: PAGE_SIZE,
    p_search: search || null,
    p_company_id: companyId || null,
  });
  const pageQuery = `${search ? `&search=${encodeURIComponent(search)}` : ''}${companyId ? `&empresa=${companyId}` : ''}`;

  const typedProducts = (products ?? []) as ProductPageRow[];
  const totalProducts = Number(typedProducts[0]?.total_count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
  const normalized: ProductRow[] = typedProducts.map((p) => ({
    id: p.id,
    sku: p.sku,
    nome: p.nome,
    cmv: p.cmv ?? 0,
    ativo: p.ativo ?? false,
    last_synced_at: p.last_synced_at,
    fornecedor_id: p.fornecedor_id,
    supplier_name: p.supplier_name,
    peso: p.peso,
    altura: p.altura,
    largura: p.largura,
    profundidade: p.profundidade,
    preco_venda: p.preco_venda,
    company_names: p.company_names,
    company_ids: p.company_ids ?? [],
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Produtos</h1>
        <p className="text-sm text-zinc-500">Importe produtos por planilha escolhendo as empresas (um SKU pode pertencer a mais de uma).</p>
      </div>
      <ProductsTable
        products={normalized}
        role={profile.perfil}
        search={search}
        companies={companyList}
        suppliers={(suppliers ?? []) as { id: string; nome: string }[]}
        companyId={companyId}
        totalProducts={totalProducts}
      />
      <div className="flex items-center justify-between text-sm">
        <Link
          className={`rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50 ${currentPage === 1 ? 'pointer-events-none opacity-50' : ''}`}
          href={`/produtos?page=${Math.max(1, currentPage - 1)}${pageQuery}`}
        >
          Anterior
        </Link>
        <span className="text-zinc-500">Página {currentPage} de {totalPages} ({totalProducts} produtos)</span>
        <Link
          className={`rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50 ${currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
          href={`/produtos?page=${currentPage + 1}${pageQuery}`}
        >
          Próxima
        </Link>
      </div>
    </div>
  );
}
