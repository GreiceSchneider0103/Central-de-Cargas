import { NextRequest, NextResponse } from 'next/server';
import { canApprove, requireProfile } from '@/lib/server/authz';

const ALLOWED = ['Pendente', 'Em análise', 'Ajuste solicitado', 'Aprovada'];
const BLOCKED = ['Cancelada', 'Recusada', 'Transformada em carga'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { motivo } = await req.json();
    if (!motivo || typeof motivo !== 'string') return NextResponse.json({ error: 'MOTIVO_REQUIRED' }, { status: 422 });

    const { supabase, profile } = await requireProfile();
    if (!canApprove(profile)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const { data: current, error: currErr } = await supabase.from('load_requests').select('id,status').eq('id', id).single();
    if (currErr) return NextResponse.json({ error: currErr.message }, { status: 500 });
    if (!current) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (BLOCKED.includes(current.status) || !ALLOWED.includes(current.status)) return NextResponse.json({ error: 'INVALID_STATUS' }, { status: 422 });

    const { error: updErr } = await supabase.from('load_requests').update({ status: 'Ajuste solicitado' }).eq('id', id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    const { error: histErr } = await supabase.from('load_request_history').insert({ request_id: id, acao: 'REQUEST_ADJUST', status_anterior: current.status, status_novo: 'Ajuste solicitado', observacao: motivo, autor_profile_id: profile.id });
    if (histErr) return NextResponse.json({ error: histErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro inesperado';
    const msg = message || 'INTERNAL_ERROR';
    if (msg.includes('UNAUTHORIZED')) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    if (msg.includes('FORBIDDEN')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    return NextResponse.json({ error: 'INTERNAL_ERROR', detail: msg }, { status: 500 });
  }
}
