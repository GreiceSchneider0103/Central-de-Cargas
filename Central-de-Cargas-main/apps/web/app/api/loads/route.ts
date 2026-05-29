import { NextRequest, NextResponse } from 'next/server';
import { requireProfile, canManageLoad } from '@/lib/server/authz';

const ERROR_STATUS: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  FORBIDDEN_LOAD_TYPE: 403,
  INVALID_LOAD_TYPE: 422,
  INVALID_LOAD_STATUS: 422,
  EMPRESA_REQUIRED: 422,
  CANAL_REQUIRED: 422,
  MARKETPLACE_REQUIRED: 422,
  DESTINO_FULL_REQUIRED: 422,
  LOJA_DESTINO_REQUIRED: 422,
  ITEMS_MUST_BE_ARRAY: 422,
  LOAD_WITHOUT_ITEMS: 422,
  ITEM_SKU_REQUIRED: 422,
  ITEM_QUANTITY_INVALID: 422,
  ITEM_NAME_REQUIRED: 422,
  ITEM_CMV_INVALID: 422,
};

function mapError(message?: string) {
  const key = Object.keys(ERROR_STATUS).find((code) => message?.includes(code));
  return { error: key ?? 'INTERNAL_ERROR', status: key ? ERROR_STATUS[key] : 500 };
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, profile } = await requireProfile();
    const body = await request.json();
    const load = body?.load;
    const items = body?.items;

    if (!load || typeof load !== 'object') {
      return NextResponse.json({ error: 'LOAD_REQUIRED' }, { status: 422 });
    }

    if (!canManageLoad(profile, { tipo: load.tipo })) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { data, error } = await supabase.rpc('create_load_with_items', {
      p_load: load,
      p_items: Array.isArray(items) ? items : [],
    });

    if (error) {
      const mapped = mapError(error.message);
      return NextResponse.json({ error: mapped.error, detail: error.message }, { status: mapped.status });
    }

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, loadId: row?.load_id, codigoInterno: row?.codigo_interno });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro inesperado';
    const mapped = mapError(message);
    return NextResponse.json({ error: mapped.error, detail: message }, { status: mapped.status });
  }
}
