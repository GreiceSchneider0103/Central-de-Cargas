import { NextRequest, NextResponse } from 'next/server';
import { canApprove, requireProfile } from '@/lib/server/authz';

function mapRpcError(message?: string) {
  if (message?.includes('UNAUTHORIZED')) return { status: 401, error: 'UNAUTHORIZED' };
  if (message?.includes('FORBIDDEN')) return { status: 403, error: 'FORBIDDEN' };
  if (message?.includes('REQUEST_NOT_FOUND')) return { status: 404, error: 'NOT_FOUND' };
  if (message?.includes('ALREADY_CONVERTED')) return { status: 409, error: 'ALREADY_CONVERTED' };
  if (message?.includes('REQUEST_NOT_APPROVED')) return { status: 422, error: 'REQUEST_NOT_APPROVED' };
  if (message?.includes('REQUEST_WITHOUT_ITEMS')) return { status: 422, error: 'REQUEST_WITHOUT_ITEMS' };
  return { status: 500, error: 'INTERNAL_ERROR' };
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, profile } = await requireProfile();
    if (!canApprove(profile)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const { data, error } = await supabase.rpc('convert_load_request_to_load', { p_request_id: id });
    if (error) {
      const mapped = mapRpcError(error.message);
      return NextResponse.json({ error: mapped.error, detail: error.message }, { status: mapped.status });
    }

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, loadId: row?.load_id, codigoInterno: row?.codigo_interno });
  } catch (e: any) {
    const mapped = mapRpcError(e?.message);
    return NextResponse.json({ error: mapped.error, detail: e?.message ?? 'unknown' }, { status: mapped.status });
  }
}
