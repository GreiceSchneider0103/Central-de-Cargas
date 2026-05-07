import { NextRequest, NextResponse } from 'next/server';
import { requireProfile } from '@/lib/server/authz';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { dataAgendada } = await req.json();
    if (!dataAgendada) return NextResponse.json({ error: 'DATE_REQUIRED' }, { status: 422 });
    const { supabase, profile } = await requireProfile();
    if (!['admin', 'gerente_estoque', 'gerente_ecommerce'].includes(profile.perfil)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const { data: load } = await supabase.from('loads').select('id,tipo').eq('id', id).single();
    if (!load) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (profile.perfil === 'gerente_ecommerce' && load.tipo !== 'FULL_MARKETPLACE') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    await supabase.from('loads').update({ data_agendada: new Date(dataAgendada).toISOString() }).eq('id', id);
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}
