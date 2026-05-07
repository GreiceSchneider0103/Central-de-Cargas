import { NextRequest, NextResponse } from 'next/server';
import { canApprove, requireProfile } from '@/lib/server/authz';

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, profile } = await requireProfile();
    if (!canApprove(profile)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const { data: req } = await supabase.from('load_requests').select('status').eq('id', id).single();
    if (!req) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (!['Pendente', 'Em análise', 'Ajuste solicitado'].includes(req.status)) return NextResponse.json({ error: 'INVALID_STATUS' }, { status: 422 });

    await supabase.from('load_requests').update({ status: 'Aprovada' }).eq('id', id);
    await supabase.from('load_request_history').insert({ request_id: id, acao: 'REQUEST_APPROVED', status_anterior: req.status, status_novo: 'Aprovada', autor_profile_id: profile.id });
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}
