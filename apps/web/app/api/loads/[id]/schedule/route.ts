import { NextRequest, NextResponse } from 'next/server';
import { requireProfile } from '@/lib/server/authz';

const ERROR_STATUS: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  LOAD_NOT_FOUND: 404,
  INVALID_DATE: 422,
};

function mapError(message?: string) {
  const key = Object.keys(ERROR_STATUS).find((code) => message?.includes(code));
  return { error: key ?? 'INTERNAL_ERROR', status: key ? ERROR_STATUS[key] : 500 };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { dataAgendada } = await req.json();
    if (!dataAgendada || typeof dataAgendada !== 'string') return NextResponse.json({ error: 'DATE_REQUIRED' }, { status: 422 });

    const parsed = new Date(dataAgendada);
    if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: 'INVALID_DATE' }, { status: 422 });

    const { supabase } = await requireProfile();
    const { error } = await supabase.rpc('patch_load_safe', { p_load_id: id, p_patch: { data_agendada: parsed.toISOString() } });
    if (error) {
      const mapped = mapError(error.message);
      return NextResponse.json({ error: mapped.error, detail: error.message }, { status: mapped.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const mapped = mapError(error instanceof Error ? error.message : 'Erro inesperado');
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
