'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Field';
import { loadStatusTone } from '@/lib/ui/status-styles';
import { toDatetimeLocalValue } from '@/lib/ui/datetime';
import { alertLabel, type AgendaLoad } from './types';

export function EventDetailDialog({
  load,
  destinoDisplay,
  empresaNome,
  canEditDate,
  onClose,
  onReschedule,
}: {
  load: AgendaLoad;
  destinoDisplay: string;
  empresaNome: string;
  canEditDate: boolean;
  onClose: () => void;
  onReschedule: (loadId: string, isoDate: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState(() => toDatetimeLocalValue(load.data_agendada));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!value) return;
    setSaving(true);
    setError(null);
    const iso = new Date(value).toISOString();
    const ok = await onReschedule(load.id, iso);
    setSaving(false);
    if (!ok) {
      setError('Não foi possível reagendar. Tente novamente.');
      return;
    }
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={load.codigo_interno}
      description={`${load.tipo === 'FULL_MARKETPLACE' ? 'Full Marketplace' : 'Loja física'} • ${empresaNome}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Link href={`/cargas/${load.id}`}>
            <Button variant="secondary">
              Ver carga completa
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={loadStatusTone(load.status)} dot>{load.status}</Badge>
          {(load.alerts ?? []).map((a) => (
            <Badge key={a.alert_type} tone="warning">
              <AlertTriangle className="h-3 w-3" />
              {alertLabel(a.alert_type)}
            </Badge>
          ))}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <dt className="text-xs text-zinc-500">Destino</dt>
            <dd className="font-medium text-zinc-800">{destinoDisplay}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Responsável</dt>
            <dd className="font-medium text-zinc-800">{load.responsavel_nome || '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Nº marketplace</dt>
            <dd className="font-medium text-zinc-800">{load.numero_carga_marketplace || '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Código agendamento</dt>
            <dd className="font-medium text-zinc-800">{load.codigo_agendamento || '-'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-zinc-500">Fornecedores</dt>
            <dd className="font-medium text-zinc-800">{load.fornecedores || '-'}</dd>
          </div>
          {load.comentario && (
            <div className="col-span-2">
              <dt className="text-xs text-zinc-500">Último comentário</dt>
              <dd className="text-zinc-700">{load.comentario}</dd>
            </div>
          )}
        </dl>

        {canEditDate && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <Label htmlFor="reschedule">Reagendar</Label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <Input id="reschedule" type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
              <Button variant="primary" onClick={save} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
            {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
            <p className="mt-1 text-xs text-zinc-500">Dica: no mês e na semana, você também pode arrastar o card pra outro dia.</p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
