import { NextRequest, NextResponse } from 'next/server';
import { requireProfile } from '@/lib/server/authz';

const ERROR_STATUS: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  LOAD_NOT_FOUND: 404,
  ITEM_NOT_FOUND: 404,
  ITEM_SKU_REQUIRED: 422,
  ITEM_QUANTITY_INVALID: 422,
  ITEM_NAME_REQUIRED: 422,
  ITEM_CMV_INVALID: 422,
  LOAD_ITEM_REQUIRED: 422,
};

function mapError(message?: string) {
  const key = Object.keys(ERROR_STATUS).find((code) => message?.includes(code));
  return { error: key ?? 'INTERNAL_ERROR', status: key ? ERROR_STATUS[key] : 500 };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase } = await requireProfile();
    const body = await request.json();
    const { data, error } = await supabase.rpc('upsert_load_item_safe', { p_load_id: id, p_item_id: null, p_item: body });
    if (error) { const mapped = mapError(error.message); return NextResponse.json({ error: mapped.error, detail: error.message }, { status: mapped.status }); }
    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, itemId: row?.item_id, action: row?.action });
  } catch (error: unknown) {
    const mapped = mapError(error instanceof Error ? error.message : 'Erro inesperado');
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase } = await requireProfile();
    const body = await request.json();
    if (!body?.id) return NextResponse.json({ error: 'ITEM_ID_REQUIRED' }, { status: 422 });
    const { data, error } = await supabase.rpc('upsert_load_item_safe', { p_load_id: id, p_item_id: body.id, p_item: body });
    if (error) { const mapped = mapError(error.message); return NextResponse.json({ error: mapped.error, detail: error.message }, { status: mapped.status }); }
    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, itemId: row?.item_id, action: row?.action });
  } catch (error: unknown) {
    const mapped = mapError(error instanceof Error ? error.message : 'Erro inesperado');
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase } = await requireProfile();
    const itemId = request.nextUrl.searchParams.get('itemId');
    if (!itemId) return NextResponse.json({ error: 'ITEM_ID_REQUIRED' }, { status: 422 });
    const { error } = await supabase.rpc('delete_load_item_safe', { p_load_id: id, p_item_id: itemId });
    if (error) { const mapped = mapError(error.message); return NextResponse.json({ error: mapped.error, detail: error.message }, { status: mapped.status }); }
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const mapped = mapError(error instanceof Error ? error.message : 'Erro inesperado');
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
