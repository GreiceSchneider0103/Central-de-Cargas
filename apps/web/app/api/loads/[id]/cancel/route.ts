import { NextRequest, NextResponse } from 'next/server';
import { canManageLoad, requireProfile } from '@/lib/server/authz';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { motivo } = await req.json();
    if (!motivo) return NextResponse.json({ error: 'MOTIVO_REQUIRED' }, { status: 422 });
    const { supabase, profile } = await requireProfile();
    const { data: load } = await supabase.from('loads').select('*').eq('id', id).single();
    if (!load) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (!canManageLoad(profile, load)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    if (load.status === 'Cancelada') return NextResponse.json({ error: 'ALREADY_CANCELED' }, { status: 409 });

    await supabase.from('loads').update({ status: 'Cancelada', cancelada_em: new Date().toISOString(), cancelada_por: profile.id, motivo_cancelamento: motivo }).eq('id', id);
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}
