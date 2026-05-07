import { NextRequest, NextResponse } from 'next/server';
import { canApprove, requireProfile } from '@/lib/server/authz';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { motivo } = await req.json();
    if (!motivo) return NextResponse.json({ error: 'MOTIVO_REQUIRED' }, { status: 422 });
    const { supabase, profile } = await requireProfile();
    if (!canApprove(profile)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const { data: current } = await supabase.from('load_requests').select('status').eq('id', id).single();
    if (!current) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    await supabase.from('load_requests').update({ status: 'Ajuste solicitado' }).eq('id', id);
    await supabase.from('load_request_history').insert({ request_id: id, acao: 'REQUEST_ADJUST', status_anterior: current.status, status_novo: 'Ajuste solicitado', observacao: motivo, autor_profile_id: profile.id });
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}
