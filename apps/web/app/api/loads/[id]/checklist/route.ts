import { NextRequest, NextResponse } from 'next/server';
import { canChecklist, requireProfile } from '@/lib/server/authz';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { field, value } = await req.json();
    if (!field) return NextResponse.json({ error: 'FIELD_REQUIRED' }, { status: 422 });
    const { supabase, profile } = await requireProfile();
    if (!canChecklist(profile)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const { data: checklist } = await supabase.from('load_checklists').select('*').eq('load_id', id).single();
    if (!checklist) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const patch: any = { [field]: !!value };
    await supabase.from('load_checklists').update(patch).eq('id', checklist.id);

    if (field === 'finalizada' && value) await supabase.from('loads').update({ status: 'Finalizada' }).eq('id', id);
    if (field === 'carga_carregada' && value) await supabase.from('loads').update({ status: 'Carregada' }).eq('id', id);
    if (field === 'agendada' && value) await supabase.from('loads').update({ status: 'Agendada' }).eq('id', id);

    await supabase.from('audit_logs').insert({ tabela: 'load_checklists', registro_id: checklist.id, acao: 'CHECKLIST_FIELD_UPDATED', payload: { field, previous: checklist[field], next: !!value }, profile_id: profile.id });
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}
