'use client';

import { useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import type { UserProfileRole } from '@/lib/auth/roles';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

type ProductRow = {
  id: string;
  sku: string;
  nome: string;
  cmv: number;
  ativo: boolean;
  last_synced_at: string | null;
  supplier_name?: string | null;
};

export function ProductsTable({ products, role }: { products: ProductRow[]; role: UserProfileRole }) {
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isAdmin = role === 'admin';
  const canSeeFinancial = ['admin', 'gerente_estoque', 'gerente_ecommerce', 'financeiro'].includes(role);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return products.filter((p) => p.sku.toLowerCase().includes(term) || p.nome.toLowerCase().includes(term));
  }, [products, search]);

  async function handleSyncNow() {
    setLoading(true);
    setMessage(null);
    const response = await fetch('/api/products/sync', { method: 'POST' });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'Erro ao sincronizar.');
      setLoading(false);
      return;
    }
    setMessage(`Sincronização concluída: ${data.created} criados, ${data.updated} atualizados.`);
    setLoading(false);
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input className="pl-9" placeholder="Buscar por SKU ou nome (nesta página)" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {isAdmin && (
          <Button variant="primary" onClick={handleSyncNow} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            {loading ? 'Sincronizando...' : 'Sincronizar agora'}
          </Button>
        )}
      </div>

      {message && <p className="text-sm text-zinc-600">{message}</p>}

      <Card>
        <CardBody className="p-0">
          {filtered.length === 0 ? (
            <EmptyState title="Nenhum produto encontrado" description="Ajuste a busca ou sincronize os produtos com o Google Sheets." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                    <th className="px-4 py-2.5">SKU</th>
                    <th className="px-4 py-2.5">Nome</th>
                    {canSeeFinancial && <th className="px-4 py-2.5">CMV</th>}
                    <th className="px-4 py-2.5">Fornecedor</th>
                    <th className="px-4 py-2.5">Última sincronização</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-zinc-600">{p.sku}</td>
                      <td className="px-4 py-2.5 font-medium text-zinc-800">{p.nome}</td>
                      {canSeeFinancial && (
                        <td className="px-4 py-2.5">
                          {Number(p.cmv) <= 0 ? <Badge tone="danger">CMV pendente</Badge> : `R$ ${Number(p.cmv).toFixed(2)}`}
                        </td>
                      )}
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
