'use client';

import { useMemo, useState } from 'react';
import type { UserProfileRole } from '@/lib/auth/roles';

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
      <div className="flex items-center justify-between gap-2">
        <input
          className="h-10 rounded border px-3 w-full max-w-md"
          placeholder="Buscar por SKU ou nome"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {isAdmin && (
          <button onClick={handleSyncNow} disabled={loading} className="h-10 px-4 rounded bg-indigo-600 text-white disabled:opacity-50">
            {loading ? 'Sincronizando...' : 'Sincronizar agora'}
          </button>
        )}
      </div>

      {message && <p className="text-sm text-zinc-600">{message}</p>}

      <table className="w-full text-sm bg-white rounded-xl border overflow-hidden">
        <thead>
          <tr className="text-left border-b bg-zinc-50">
            <th className="p-3">SKU</th>
            <th className="p-3">Nome</th>
            <th className="p-3">CMV</th>
            <th className="p-3">Fornecedor</th>
            <th className="p-3">Última sincronização</th>
            <th className="p-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="p-3 font-mono">{p.sku}</td>
              <td className="p-3">{p.nome}</td>
              <td className="p-3">
                {Number(p.cmv) <= 0 ? <span className="text-rose-600 font-semibold">CMV pendente</span> : `R$ ${Number(p.cmv).toFixed(2)}`}
              </td>
              <td className="p-3">{p.supplier_name || '-'}</td>
              <td className="p-3">{p.last_synced_at ? new Date(p.last_synced_at).toLocaleString('pt-BR') : '-'}</td>
              <td className="p-3">{p.ativo ? 'Ativo' : 'Inativo'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
