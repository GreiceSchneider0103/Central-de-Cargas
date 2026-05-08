import { NextRequest, NextResponse } from 'next/server';
import { canApprove, requireProfile } from '@/lib/server/authz';

const ALLOWED = ['Pendente', 'Em análise', 'Ajuste solicitado'];

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, profile } = await requireProfile();
    if (!canApprove(profile)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const { data: req, error: reqErr } = await supabase.from('load_requests').select('id,status').eq('id', id).single();
    if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 });
    if (!req) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (!ALLOWED.includes(req.status)) return NextResponse.json({ error: 'INVALID_STATUS' }, { status: 422 });

    const { error: updErr } = await supabase.from('load_requests').update({ status: 'Aprovada' }).eq('id', id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    const { error: histErr } = await supabase.from('load_request_history').insert({ request_id: id, acao: 'REQUEST_APPROVED', status_anterior: req.status, status_novo: 'Aprovada', autor_profile_id: profile.id });
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
