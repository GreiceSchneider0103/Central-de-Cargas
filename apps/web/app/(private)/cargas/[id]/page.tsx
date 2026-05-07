import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function CargaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: load } = await supabase.from('loads').select('*').eq('id', id).single();
  const { data: items } = await supabase.from('load_items').select('*').eq('load_id', id);
  const { data: checklist } = await supabase.from('load_checklists').select('*').eq('load_id', id).single();

  if (!load) redirect('/cargas');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{load.codigo_interno}</h1>
      <p>Status: {load.status}</p>
      <p>Data agendada: {load.data_agendada ? new Date(load.data_agendada).toLocaleString('pt-BR') : '-'}</p>
      <table className="w-full text-sm bg-white border"><thead><tr><th>SKU</th><th>Nome</th><th>Qtd</th><th>CMV Total</th></tr></thead><tbody>
        {(items ?? []).map((i) => <tr key={i.id}><td>{i.sku}</td><td>{i.nome_produto}</td><td>{i.quantidade}</td><td>{i.cmv_total}</td></tr>)}
      </tbody></table>
      <pre className="bg-zinc-100 p-3 rounded text-xs overflow-auto">{JSON.stringify(checklist, null, 2)}</pre>
    </div>
  );
}
