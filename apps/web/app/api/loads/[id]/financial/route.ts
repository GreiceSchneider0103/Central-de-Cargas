import { NextRequest, NextResponse } from 'next/server';
import { requireProfile } from '@/lib/server/authz';

const ERROR_STATUS: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  LOAD_NOT_FOUND: 404,
  FINANCIAL_FORBIDDEN: 403,
};

function mapError(message?: string) {
  const key = Object.keys(ERROR_STATUS).find((code) => message?.includes(code));
  return { error: key ?? 'INTERNAL_ERROR', status: key ? ERROR_STATUS[key] : 500 };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase } = await requireProfile();
    const patch = await request.json();
    const { error } = await supabase.rpc('patch_load_financial_safe', { p_load_id: id, p_patch: patch });
    if (error) {
      const mapped = mapError(error.message);
      return NextResponse.json({ error: mapped.error, detail: error.message }, { status: mapped.status });
    }
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro inesperado';
    const mapped = mapError(message);
    return NextResponse.json({ error: mapped.error, detail: message }, { status: mapped.status });
  }
}

