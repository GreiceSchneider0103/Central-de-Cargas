import { NextRequest, NextResponse } from 'next/server';
import { canChecklist, requireProfile } from '@/lib/server/authz';

const ALLOWED_FIELDS = [
  'pedido_realizado','pedido_confirmado_fornecedor','produto_recebido','montada','agendada','etiqueta_impressa','carga_separada','carga_etiquetada','nf_emitida','carga_carregada','finalizada',
] as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { field, value } = await req.json();
    if (!field) return NextResponse.json({ error: 'FIELD_REQUIRED' }, { status: 422 });
    if (!ALLOWED_FIELDS.includes(field)) return NextResponse.json({ error: 'FIELD_NOT_ALLOWED' }, { status: 422 });
    if (typeof value !== 'boolean') return NextResponse.json({ error: 'VALUE_MUST_BE_BOOLEAN' }, { status: 422 });

    const { supabase, profile } = await requireProfile();
    if (!canChecklist(profile)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const { data: checklist, error: checklistErr } = await supabase.from('load_checklists').select('*').eq('load_id', id).single();
    if (checklistErr) return NextResponse.json({ error: checklistErr.message }, { status: 500 });
    if (!checklist) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const previous = checklist[field];
    const { error: updChecklistErr } = await supabase.from('load_checklists').update({ [field]: value }).eq('id', checklist.id);
    if (updChecklistErr) return NextResponse.json({ error: updChecklistErr.message }, { status: 500 });

    if (field === 'finalizada' && value) { const { error } = await supabase.from('loads').update({ status: 'Finalizada' }).eq('id', id); if (error) return NextResponse.json({ error: error.message }, { status: 500 }); }
    if (field === 'carga_carregada' && value) { const { error } = await supabase.from('loads').update({ status: 'Carregada' }).eq('id', id); if (error) return NextResponse.json({ error: error.message }, { status: 500 }); }
    if (field === 'agendada' && value) { const { error } = await supabase.from('loads').update({ status: 'Agendada' }).eq('id', id); if (error) return NextResponse.json({ error: error.message }, { status: 500 }); }

    const { error: auditErr } = await supabase.rpc('write_audit_log_safe', {
      p_tabela: 'load_checklists',
      p_registro_id: checklist.id,
      p_acao: 'CHECKLIST_FIELD_UPDATED',
      p_payload: { field, previous, next: value },
    });
    if (auditErr) return NextResponse.json({ error: auditErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || 'INTERNAL_ERROR';
    if (msg.includes('UNAUTHORIZED')) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    if (msg.includes('FORBIDDEN')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    return NextResponse.json({ error: 'INTERNAL_ERROR', detail: msg }, { status: 500 });
  }
}
