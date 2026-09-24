'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, RefreshCw, Search, Trash2, Upload } from 'lucide-react';
import type { UserProfileRole } from '@/lib/auth/roles';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { translateError } from '@/lib/ui/error-messages';
import { formatDimensions, type NamedOption, type ProductRow } from '@/lib/products/types';
import { ProductImportDialog } from '@/components/products/ProductImportDialog';
import { ProductEditDialog } from '@/components/products/ProductEditDialog';
import { ProductBulkEditDialog } from '@/components/products/ProductBulkEditDialog';

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
  suppliers,
  companyId,
  totalProducts,
}: {
  products: ProductRow[];
  role: UserProfileRole;
  search: string;
  companies: NamedOption[];
  suppliers: NamedOption[];
  companyId: string;
  totalProducts: number;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [loading, setLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [bulkEditIds, setBulkEditIds] = useState<string[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const toast = useToast();
  const router = useRouter();
  const isFirstRun = useRef(true);
  const isAdmin = role === 'admin';
  const canManage = role === 'admin' || role === 'gerente_estoque';
  const canSeeFinancial = ['admin', 'gerente_estoque', 'gerente_ecommerce', 'financeiro'].includes(role);

  const pageIds = products.map((p) => p.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      setSelected([]);
      router.push(productsUrl(search, companyId));
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function togglePage() {
    setSelected((prev) => (allPageSelected ? prev.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...prev, ...pageIds]))));
  }

  async function selectAllInFilter() {
    const { data, error } = await createClient().rpc('get_visible_product_ids', {
      p_search: initialSearch || null,
      p_company_id: companyId || null,
    });
    if (error) return toast.error(translateError(error.message, 'Erro ao selecionar os produtos.'));
    setSelected(((data ?? []) as string[]).map(String));
  }

  function afterBulk() {
    setSelected([]);
    router.refresh();
  }

  async function deleteSelected() {
    setDeleting(true);
    const { data, error } = await createClient().rpc('delete_products', { p_ids: selected });
    setDeleting(false);
    setConfirmDelete(false);
    if (error) return toast.error(translateError(error.message, 'Erro ao excluir os produtos.'));
    const result = (data as { deleted: number; deactivated: number }[] | null)?.[0];
    const parts = [`${result?.deleted ?? 0} excluídos`];
    if (result?.deactivated) parts.push(`${result.deactivated} inativados por já estarem em cargas ou solicitações`);
    toast.success(parts.join(', ') + '.');
    afterBulk();
  }

  async function handleSyncNow() {
    setLoading(true);
    const response = await fetch('/api/products/sync', { method: 'POST' });
    const data = await response.json();
    if (!response.ok) {
      toast.error(translateError(data.error, `Erro ao sincronizar${data.error ? `: ${data.error}` : '.'}`));
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
        <Select
          className="w-full max-w-xs"
          value={companyId}
          onChange={(e) => {
            setSelected([]);
            router.push(productsUrl(search, e.target.value));
          }}
        >
          <option value="">Todas as empresas</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </Select>
        <div className="ml-auto flex flex-wrap gap-2">
          {canManage && (
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

      {canManage && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm text-zinc-800">
          <span className="font-medium">{selected.length} selecionado{selected.length > 1 ? 's' : ''}</span>
          {allPageSelected && selected.length < totalProducts && (
            <button type="button" className="font-medium text-brand-700 hover:underline" onClick={selectAllInFilter}>
              Selecionar todos os {totalProducts} produtos {initialSearch || companyId ? 'do filtro' : ''}
            </button>
          )}
          <button type="button" className="text-zinc-500 hover:underline" onClick={() => setSelected([])}>Limpar seleção</button>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setBulkEditIds(selected)}>
              <Pencil className="h-3.5 w-3.5" />
              Editar em massa
            </Button>
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </Button>
          </div>
        </div>
      )}

      {canManage && <ProductImportDialog open={importOpen} onClose={() => setImportOpen(false)} companies={companies} />}
      {canManage && <ProductEditDialog product={editing} onClose={() => setEditing(null)} companies={companies} suppliers={suppliers} />}
      {canManage && (
        <ProductBulkEditDialog ids={bulkEditIds} onClose={() => setBulkEditIds(null)} onDone={afterBulk} companies={companies} suppliers={suppliers} />
      )}
      <Dialog
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        title={`Excluir ${selected.length} produtos?`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancelar</Button>
            <Button variant="danger" onClick={deleteSelected} disabled={deleting}>{deleting ? 'Excluindo...' : 'Excluir'}</Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600">
          Produtos que já aparecem em cargas ou solicitações não são apagados: ficam inativos, para manter o histórico.
        </p>
      </Dialog>

      <Card>
        <CardBody className="p-0">
          {products.length === 0 ? (
            <EmptyState title="Nenhum produto encontrado" description="Ajuste a busca ou o filtro de empresa, ou importe uma planilha de produtos." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                    {canManage && (
                      <th className="w-10 px-4 py-2.5">
                        <input type="checkbox" aria-label="Selecionar a página" className="h-4 w-4 accent-brand-600" checked={allPageSelected} onChange={togglePage} />
                      </th>
                    )}
                    <th className="px-4 py-2.5">SKU</th>
                    <th className="px-4 py-2.5">Nome</th>
                    {canSeeFinancial && <th className="px-4 py-2.5">CMV</th>}
                    <th className="px-4 py-2.5">Peso</th>
                    <th className="px-4 py-2.5">Medidas (L × A × P)</th>
                    <th className="px-4 py-2.5">Empresas</th>
                    <th className="px-4 py-2.5">Fornecedor</th>
                    <th className="px-4 py-2.5">Status</th>
                    {canManage && <th className="w-10 px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className={`border-b border-zinc-50 last:border-0 hover:bg-zinc-50 ${selected.includes(p.id) ? 'bg-brand-50/60' : ''}`}>
                      {canManage && (
                        <td className="px-4 py-2.5">
                          <input type="checkbox" aria-label={`Selecionar ${p.sku}`} className="h-4 w-4 accent-brand-600" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
                        </td>
                      )}
                      <td className="px-4 py-2.5 font-mono text-xs text-zinc-600">{p.sku}</td>
                      <td className="px-4 py-2.5 font-medium text-zinc-800">{p.nome}</td>
                      {canSeeFinancial && (
                        <td className="whitespace-nowrap px-4 py-2.5">
                          {Number(p.cmv) <= 0 ? <Badge tone="danger">CMV pendente</Badge> : `R$ ${Number(p.cmv).toFixed(2)}`}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-4 py-2.5 text-zinc-600">{p.peso ? `${Number(p.peso).toLocaleString('pt-BR')} kg` : '-'}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-zinc-600">{formatDimensions(p) ?? '-'}</td>
                      <td className="px-4 py-2.5 text-zinc-600">{p.company_names || '-'}</td>
                      <td className="px-4 py-2.5 text-zinc-600">{p.supplier_name || '-'}</td>
                      <td className="px-4 py-2.5"><Badge tone={p.ativo ? 'success' : 'neutral'} dot>{p.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
                      {canManage && (
                        <td className="px-4 py-2.5">
                          <button type="button" aria-label={`Editar ${p.sku}`} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" onClick={() => setEditing(p)}>
                            <Pencil className="h-4 w-4" />
                          </button>
                        </td>
                      )}
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
