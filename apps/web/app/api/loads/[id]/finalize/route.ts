import { NextRequest, NextResponse } from 'next/server';
import { canManageLoad, requireProfile } from '@/lib/server/authz';

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, profile } = await requireProfile();
    const { data: load } = await supabase.from('loads').select('*').eq('id', id).single();
    if (!load) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (!canManageLoad(profile, load)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    if (['Cancelada','Finalizada'].includes(load.status)) return NextResponse.json({ error: 'INVALID_STATUS' }, { status: 422 });

    const { data: checklist } = await supabase.from('load_checklists').select('*').eq('load_id', id).single();
    await supabase.from('loads').update({ status: 'Finalizada' }).eq('id', id);
    if (checklist) await supabase.from('load_checklists').update({ finalizada: true }).eq('id', checklist.id);

    return NextResponse.json({ ok: true, warning: checklist && !checklist.nf_emitida ? 'NF_NOT_EMITTED' : null });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}
