import { NextRequest, NextResponse } from 'next/server';
import { canManageLoad, requireProfile } from '@/lib/server/authz';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { motivo } = await req.json();
    if (!motivo || typeof motivo !== 'string') return NextResponse.json({ error: 'MOTIVO_REQUIRED' }, { status: 422 });

    const { supabase, profile } = await requireProfile();
    const { data: load, error: loadErr } = await supabase.from('loads').select('*').eq('id', id).single();
    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
    if (!load) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (!canManageLoad(profile, load)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    if (load.status === 'Cancelada') return NextResponse.json({ error: 'ALREADY_CANCELED' }, { status: 409 });

    const patch = { status: 'Cancelada', cancelada_em: new Date().toISOString(), cancelada_por: profile.id, motivo_cancelamento: motivo };
    const { error: updErr } = await supabase.from('loads').update(patch).eq('id', id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    const { error: auditErr } = await supabase.rpc('write_audit_log_safe', {
      p_tabela: 'loads',
      p_registro_id: id,
      p_acao: 'LOAD_CANCELED',
      p_payload: { previous_status: load.status, ...patch },
    });
    if (auditErr) return NextResponse.json({ error: auditErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro inesperado';
    const msg = message || 'INTERNAL_ERROR';
    if (msg.includes('UNAUTHORIZED')) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    if (msg.includes('FORBIDDEN')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    return NextResponse.json({ error: 'INTERNAL_ERROR', detail: msg }, { status: 500 });
  }
}
