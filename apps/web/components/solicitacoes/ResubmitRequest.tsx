'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { FieldGroup, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { translateError } from '@/lib/ui/error-messages';
import { NewLoadItemsEditor, type NewLoadItem } from '@/components/cargas/NewLoadItemsEditor';

// Quando a gerência pede ajuste, quem solicitou corrige os itens aqui e
// reenvia (a solicitação volta para "Pendente").
export function ResubmitRequest({
  requestId,
  motivo,
  initialItems,
  initialObservacoes,
  companyId,
}: {
  requestId: string;
  motivo: string | null;
  initialItems: NewLoadItem[];
  initialObservacoes: string | null;
  companyId: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<NewLoadItem[]>(initialItems);
  const [observacoes, setObservacoes] = useState(initialObservacoes ?? '');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function resubmit() {
    const filled = items.filter((i) => i.sku.trim() || i.nome_produto.trim());
    if (filled.length === 0 || filled.some((i) => !i.sku.trim() || !i.nome_produto.trim() || Number(i.quantidade || 0) <= 0)) {
      return toast.error('Cada item precisa de SKU, nome e quantidade maior que zero.');
    }
    setSaving(true);
    const { error } = await createClient().rpc('resubmit_load_request', {
      p_request_id: requestId,
      p_items: filled.map((i) => ({ sku: i.sku.trim(), nome_produto: i.nome_produto.trim(), quantidade: Number(i.quantidade) })),
      p_observacoes: observacoes || null,
    });
    setSaving(false);
    if (error) return toast.error(translateError(error.message, 'Erro ao reenviar a solicitação.'));
    toast.success('Solicitação corrigida e reenviada para aprovação.');
    setEditing(false);
    router.refresh();
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">A gerência pediu um ajuste nesta solicitação</p>
          {motivo && <p className="mt-1">{motivo}</p>}
        </div>
        {!editing ? (
          <Button variant="primary" onClick={() => setEditing(true)}>Corrigir e reenviar</Button>
        ) : (
          <div className="space-y-3">
            <NewLoadItemsEditor items={items} onChange={setItems} companyId={companyId} />
            <FieldGroup label="Observações">
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </FieldGroup>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
              <Button variant="primary" onClick={resubmit} disabled={saving}>{saving ? 'Reenviando...' : 'Reenviar para aprovação'}</Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
