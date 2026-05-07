import { NextRequest, NextResponse } from 'next/server';
import { canApprove, requireProfile } from '@/lib/server/authz';

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, profile } = await requireProfile();
    if (!canApprove(profile)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const { data: request } = await supabase.from('load_requests').select('*').eq('id', id).single();
    if (!request) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (request.status !== 'Aprovada') return NextResponse.json({ error: 'REQUEST_NOT_APPROVED' }, { status: 422 });
    if (request.carga_id) return NextResponse.json({ error: 'ALREADY_CONVERTED' }, { status: 409 });

    const { data: reqItems } = await supabase.from('load_request_items').select('*').eq('request_id', id);
    if (!reqItems || reqItems.length === 0) return NextResponse.json({ error: 'REQUEST_WITHOUT_ITEMS' }, { status: 422 });

    const { data: load, error: loadErr } = await supabase.from('loads').insert({
      tipo: request.tipo,
      empresa_id: request.empresa_id,
      canal_id: request.canal_id,
      marketplace_id: request.marketplace_id,
      destino_full_id: request.destino_full_id,
      loja_destino_id: request.loja_destino_id,
      prioridade: request.prioridade,
      solicitante_id: request.solicitante_id,
      observacoes: request.observacoes,
      status: 'Aprovada',
    }).select('*').single();
    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 400 });

    const itemsPayload = reqItems.map((i: any) => ({
      load_id: load.id,
      product_id: i.product_id,
      sku: i.sku,
      nome_produto: i.nome_produto,
      quantidade: i.quantidade,
      fornecedor_origem_id: i.fornecedor_origem_id,
      cmv_unitario: i.cmv_unitario,
      cmv_total: i.cmv_total,
      data_prevista_recebimento: i.data_prevista_recebimento,
      observacao: i.observacao,
    }));
    const { error: itemErr } = await supabase.from('load_items').insert(itemsPayload);
    if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 400 });

    await supabase.from('load_checklists').insert({ load_id: load.id });
    await supabase.from('load_requests').update({ status: 'Transformada em carga', carga_id: load.id }).eq('id', id);
    await supabase.from('load_request_history').insert({
      request_id: id,
      acao: 'request_converted_to_load',
      status_anterior: 'Aprovada',
      status_novo: 'Transformada em carga',
      observacao: `load_id:${load.id}`,
      autor_profile_id: profile.id,
    });

    return NextResponse.json({ ok: true, loadId: load.id });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}
