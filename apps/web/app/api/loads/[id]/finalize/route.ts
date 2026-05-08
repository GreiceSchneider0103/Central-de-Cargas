import { NextRequest, NextResponse } from 'next/server';
import { canManageLoad, requireProfile } from '@/lib/server/authz';

function mapRpcError(message?: string) {
  if (message?.includes('UNAUTHORIZED')) return { status: 401, error: 'UNAUTHORIZED' };
  if (message?.includes('FORBIDDEN')) return { status: 403, error: 'FORBIDDEN' };
  if (message?.includes('LOAD_NOT_FOUND')) return { status: 404, error: 'NOT_FOUND' };
  if (message?.includes('INVALID_STATUS')) return { status: 422, error: 'INVALID_STATUS' };
  return { status: 500, error: 'INTERNAL_ERROR' };
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, profile } = await requireProfile();
    const { data: load, error: loadErr } = await supabase.from('loads').select('id,tipo,status').eq('id', id).single();
    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
    if (!load) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (!canManageLoad(profile, load)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const { data, error } = await supabase.rpc('finalize_load_with_checklist', { p_load_id: id });
    if (error) {
      const mapped = mapRpcError(error.message);
      return NextResponse.json({ error: mapped.error, detail: error.message }, { status: mapped.status });
    }

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, warning: row?.warning ?? null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro inesperado';
    const mapped = mapRpcError(message);
    return NextResponse.json({ error: mapped.error, detail: message ?? 'unknown' }, { status: mapped.status });
  }
}
