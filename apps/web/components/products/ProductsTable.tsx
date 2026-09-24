'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Search, Upload } from 'lucide-react';
import type { UserProfileRole } from '@/lib/auth/roles';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { translateError } from '@/lib/ui/error-messages';
import { ProductImportDialog, type CompanyOption } from '@/components/products/ProductImportDialog';

type ProductRow = {
  id: string;
  sku: string;
  nome: string;
  cmv: number;
  ativo: boolean;
  last_synced_at: string | null;
  supplier_name?: string | null;
  company_names?: string | null;
};

function productsUrl(search: string, companyId: string) {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (companyId) params.set('empresa', companyId);
  const query = params.toString();
  return `/produtos${query ? `?${query}` : ''}`;
}

export function ProductsTable({
  products,
  role,
  search: initialSearch,
  companies,
  companyId,
}: {
  products: ProductRow[];
  role: UserProfileRole;
  search: string;
  companies: CompanyOption[];
  companyId: string;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [loading, setLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const isFirstRun = useRef(true);
  const isAdmin = role === 'admin';
  const canImport = role === 'admin' || role === 'gerente_estoque';
  const canSeeFinancial = ['admin', 'gerente_estoque', 'gerente_ecommerce', 'financeiro'].includes(role);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      router.push(productsUrl(search, companyId));
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleSyncNow() {
    setLoading(true);
    const response = await fetch('/api/products/sync', { method: 'POST' });
    const data = await response.json();
    if (!response.ok) {
      toast.error(translateError(data.error, 'Erro ao sincronizar.'));
      setLoading(false);
      return;
    }
    toast.success(`Sincronização concluída: ${data.created} criados, ${data.updated} atualizados.`);
    setLoading(false);
    setTimeout(() => window.location.reload(), 1200);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input className="pl-9" placeholder="Buscar por SKU ou nome" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select className="w-full max-w-xs" value={companyId} onChange={(e) => router.push(productsUrl(search, e.target.value))}>
          <option value="">Todas as empresas</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </Select>
        <div className="ml-auto flex flex-wrap gap-2">
          {canImport && (
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Importar planilha
            </Button>
          )}
          {isAdmin && (
            <Button variant="primary" onClick={handleSyncNow} disabled={loading}>
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              {loading ? 'Sincronizando...' : 'Sincronizar agora'}
            </Button>
          )}
        </div>
      </div>

      {canImport && <ProductImportDialog open={importOpen} onClose={() => setImportOpen(false)} companies={companies} />}

      <Card>
        <CardBody className="p-0">
          {products.length === 0 ? (
            <EmptyState title="Nenhum produto encontrado" description="Ajuste a busca ou o filtro de empresa, ou importe uma planilha de produtos." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                    <th className="px-4 py-2.5">SKU</th>
                    <th className="px-4 py-2.5">Nome</th>
                    {canSeeFinancial && <th className="px-4 py-2.5">CMV</th>}
                    <th className="px-4 py-2.5">Empresas</th>
                    <th className="px-4 py-2.5">Fornecedor</th>
                    <th className="px-4 py-2.5">Última sincronização</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-zinc-600">{p.sku}</td>
                      <td className="px-4 py-2.5 font-medium text-zinc-800">{p.nome}</td>
                      {canSeeFinancial && (
                        <td className="px-4 py-2.5">
                          {Number(p.cmv) <= 0 ? <Badge tone="danger">CMV pendente</Badge> : `R$ ${Number(p.cmv).toFixed(2)}`}
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-zinc-600">{p.company_names || '-'}</td>
                      <td className="px-4 py-2.5 text-zinc-600">{p.supplier_name || '-'}</td>
                      <td className="px-4 py-2.5 text-zinc-500">{p.last_synced_at ? new Date(p.last_synced_at).toLocaleString('pt-BR') : '-'}</td>
                      <td className="px-4 py-2.5"><Badge tone={p.ativo ? 'success' : 'neutral'} dot>{p.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
