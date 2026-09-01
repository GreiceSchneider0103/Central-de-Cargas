import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/auth/roles';
import { CommentForm } from '@/components/comments/CommentForm';

type VisibleLoad = {
  id: string;
  codigo_interno: string | null;
  numero_carga_marketplace: string | null;
  codigo_agendamento: string | null;
  tipo: string | null;
  status: string | null;
  prioridade: string | null;
  data_agendada: string | null;
  data_prevista_recebimento: string | null;
  data_real_recebimento: string | null;
  custo_frete: number | null;
  outros_custos: number | null;
  faturamento_estimado: number | null;
  cmv_total: number | null;
  margem_estimativa_valor: number | null;
  margem_estimativa_percentual: number | null;
  observacoes: string | null;
  motivo_cancelamento: string | null;
};

type VisibleLoadItem = {
  id: string;
  sku: string | null;
  nome_produto: string | null;
  quantidade: number | null;
  cmv_unitario: number | null;
  cmv_total: number | null;
  peso: number | null;
  altura: number | null;
  largura: number | null;
  profundidade: number | null;
  cubagem: number | null;
  status_item: string | null;
};

type ChecklistRow = Record<string, boolean | null | undefined>;
type CommentRow = { id: string; texto: string | null; created_at: string };

const CHECKLIST_FIELDS: { key: string; label: string }[] = [
  { key: 'pedido_realizado', label: 'Pedido realizado' },
  { key: 'pedido_confirmado_fornecedor', label: 'Pedido confirmado pelo fornecedor' },
  { key: 'produto_recebido', label: 'Produto recebido' },
  { key: 'montada', label: 'Carga montada' },
  { key: 'agendada', label: 'Agendada' },
  { key: 'etiqueta_impressa', label: 'Etiqueta impressa' },
  { key: 'carga_separada', label: 'Carga separada' },
  { key: 'carga_etiquetada', label: 'Carga etiquetada' },
  { key: 'nf_emitida', label: 'NF emitida' },
  { key: 'carga_carregada', label: 'Carga carregada' },
  { key: 'finalizada', label: 'Finalizada' },
];

function money(value: number | null | undefined) {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default async function CargaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile } = await supabase
    .from('users_profile')
    .select('*')
    .eq('auth_user_id', userData.user.id)
    .single<UserProfile>();
  if (!profile) redirect('/login');

  // Vendedor não vê margem/faturamento; operador não vê custo/CMV (ver migration p1_financial_masking_by_field).
  const canViewCosts = ['admin', 'gerente_estoque', 'gerente_ecommerce', 'financeiro', 'vendedor_loja'].includes(profile.perfil);
  const canViewMargin = ['admin', 'gerente_estoque', 'gerente_ecommerce', 'financeiro', 'operador_carga'].includes(profile.perfil);

  const { data: loads } = await supabase.rpc('get_visible_loads');
  const load = ((loads ?? []) as VisibleLoad[]).find((row) => row.id === id);
  if (!load) redirect('/cargas');

  const { data: items } = await supabase.rpc('get_visible_load_items', { p_load_id: id });
  const { data: checklist } = await supabase.from('load_checklists').select('*').eq('load_id', id).single<ChecklistRow>();
  const { data: comments } = await supabase
    .from('comments')
    .select('id,texto,created_at')
    .eq('entidade', 'load')
    .eq('entidade_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  const typedItems = (items ?? []) as VisibleLoadItem[];
  const nfEmitida = checklist?.nf_emitida;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{load.codigo_interno}</h1>
          <p className="text-zinc-600">
            {load.tipo} • {load.status}
            {load.prioridade ? ` • Prioridade: ${load.prioridade}` : ''}
          </p>
        </div>
        <Link href="/cargas" className="px-3 py-2 border rounded text-sm">
          Editar na lista de cargas
        </Link>
      </div>

      <div className="bg-white border rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <p><strong>Nº carga marketplace:</strong> {load.numero_carga_marketplace ?? '-'}</p>
        <p><strong>Código de agendamento:</strong> {load.codigo_agendamento ?? '-'}</p>
        <p><strong>Data agendada:</strong> {load.data_agendada ? new Date(load.data_agendada).toLocaleString('pt-BR') : '-'}</p>
        <p><strong>Prev. recebimento:</strong> {load.data_prevista_recebimento ? new Date(load.data_prevista_recebimento).toLocaleString('pt-BR') : '-'}</p>
        <p><strong>Real recebimento:</strong> {load.data_real_recebimento ? new Date(load.data_real_recebimento).toLocaleString('pt-BR') : '-'}</p>
        <p><strong>Observações:</strong> {load.observacoes ?? '-'}</p>
        {load.status === 'Cancelada' && (
          <p className="md:col-span-3 text-rose-700"><strong>Motivo do cancelamento:</strong> {load.motivo_cancelamento ?? '-'}</p>
        )}
      </div>

      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold mb-2">Itens da carga</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">SKU</th>
                <th>Nome</th>
                <th>Qtd</th>
                {canViewCosts && <th>CMV unit.</th>}
                {canViewCosts && <th>CMV total</th>}
                <th>Peso</th>
                <th>Dimensões (A×L×P)</th>
                <th>Cubagem</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {typedItems.map((i) => (
                <tr key={i.id} className="border-b">
                  <td className="py-2">{i.sku}</td>
                  <td>{i.nome_produto}</td>
                  <td>{i.quantidade}</td>
                  {canViewCosts && <td>{i.cmv_unitario ?? '-'}</td>}
                  {canViewCosts && <td>{i.cmv_total ?? '-'}</td>}
                  <td>{i.peso ?? '-'}</td>
                  <td>{i.altura ?? '-'} × {i.largura ?? '-'} × {i.profundidade ?? '-'}</td>
                  <td>{i.cubagem ?? '-'}</td>
                  <td>{i.status_item ?? '-'}</td>
                </tr>
              ))}
              {typedItems.length === 0 && (
                <tr>
                  <td colSpan={canViewCosts ? 9 : 7} className="py-3 text-zinc-500">Sem itens.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(canViewCosts || canViewMargin) && (
        <div className="bg-white border rounded-xl p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          {canViewMargin && (
            <div>
              <div className="text-zinc-500">Faturamento estimado</div>
              <div className="font-semibold">{money(load.faturamento_estimado)}</div>
            </div>
          )}
          {canViewCosts && (
            <div>
              <div className="text-zinc-500">CMV total</div>
              <div className="font-semibold">{money(load.cmv_total)}</div>
            </div>
          )}
          {canViewCosts && (
            <div>
              <div className="text-zinc-500">Custo de frete</div>
              <div className="font-semibold">{money(load.custo_frete)}</div>
            </div>
          )}
          {canViewCosts && (
            <div>
              <div className="text-zinc-500">Outros custos</div>
              <div className="font-semibold">{money(load.outros_custos)}</div>
            </div>
          )}
          {canViewMargin && (
            <div>
              <div className="text-zinc-500">Margem estimada</div>
              <div className="font-semibold">
                {money(load.margem_estimativa_valor)}
                {load.margem_estimativa_percentual !== null && load.margem_estimativa_percentual !== undefined
                  ? ` (${(load.margem_estimativa_percentual * 100).toFixed(2)}%)`
                  : ' (pendente)'}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold mb-3">Checklist operacional</h2>
        {checklist ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {CHECKLIST_FIELDS.map((field) => (
              <label key={field.key} className="flex items-center gap-2">
                <input type="checkbox" checked={!!checklist[field.key]} disabled readOnly />
                {field.label}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Checklist ainda não disponível para esta carga.</p>
        )}
        {!nfEmitida && (
          <p className="text-xs text-amber-600 mt-2">Atenção: NF ainda não emitida.</p>
        )}
        <p className="text-xs text-zinc-500 mt-3">
          Para marcar etapas do checklist, editar itens, financeiro ou finalizar/cancelar a carga, use o painel em{' '}
          <Link href="/cargas" className="text-indigo-600">/cargas</Link>.
        </p>
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">Comentários</h2>
        <CommentForm entidade="load" entidadeId={id} />
        <ul className="text-sm space-y-2">
          {((comments ?? []) as CommentRow[]).map((c) => (
            <li key={c.id} className="border-b pb-2">
              {c.texto}
              <br />
              <span className="text-xs text-zinc-500">{new Date(c.created_at).toLocaleString('pt-BR')}</span>
            </li>
          ))}
          {(comments ?? []).length === 0 && <li className="text-zinc-500">Sem comentários ainda.</li>}
        </ul>
      </div>

      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold mb-2">Histórico de alterações</h2>
        <p className="text-sm text-zinc-600">
          Consulte todas as alterações desta carga em{' '}
          <Link href={`/auditoria?tabela=loads&registro_id=${id}`} className="text-indigo-600">
            Auditoria filtrada por esta carga
          </Link>.
        </p>
      </div>
    </div>
  );
}
