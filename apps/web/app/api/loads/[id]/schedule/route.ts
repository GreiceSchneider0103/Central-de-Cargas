import { NextRequest, NextResponse } from 'next/server';
import { requireProfile } from '@/lib/server/authz';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { dataAgendada } = await req.json();
    if (!dataAgendada || typeof dataAgendada !== 'string') return NextResponse.json({ error: 'DATE_REQUIRED' }, { status: 422 });

    const parsed = new Date(dataAgendada);
    if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: 'INVALID_DATE' }, { status: 422 });

    const { supabase, profile } = await requireProfile();
    if (!['admin', 'gerente_estoque', 'gerente_ecommerce'].includes(profile.perfil)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const { data: load, error: loadErr } = await supabase.from('loads').select('id,tipo,data_agendada').eq('id', id).single();
    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
    if (!load) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (profile.perfil === 'gerente_ecommerce' && load.tipo !== 'FULL_MARKETPLACE') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const iso = parsed.toISOString();
    const { error: updErr } = await supabase.from('loads').update({ data_agendada: iso }).eq('id', id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    const { error: auditErr } = await supabase.from('audit_logs').insert({ tabela: 'loads', registro_id: id, acao: 'LOAD_SCHEDULE_UPDATED', payload: { previous_data_agendada: load.data_agendada, next_data_agendada: iso }, profile_id: profile.id });
    if (auditErr) return NextResponse.json({ error: auditErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || 'INTERNAL_ERROR';
    if (msg.includes('UNAUTHORIZED')) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    if (msg.includes('FORBIDDEN')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    return NextResponse.json({ error: 'INTERNAL_ERROR', detail: msg }, { status: 500 });
  }
}
