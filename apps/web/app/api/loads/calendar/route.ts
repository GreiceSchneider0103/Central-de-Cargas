import { NextRequest, NextResponse } from 'next/server';
import { requireProfile } from '@/lib/server/authz';

function parseIso(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  try {
    const { supabase } = await requireProfile();
    const body = await req.json();
    const from = parseIso(body?.from);
    const to = parseIso(body?.to);
    if (!from || !to) return NextResponse.json({ error: 'INVALID_RANGE' }, { status: 422 });
    if (to <= from) return NextResponse.json({ error: 'INVALID_RANGE' }, { status: 422 });

    const maxRangeMs = 1000 * 60 * 60 * 24 * 62;
    if (to.getTime() - from.getTime() > maxRangeMs) {
      return NextResponse.json({ error: 'RANGE_TOO_LARGE' }, { status: 422 });
    }

    const { data, error } = await supabase.rpc('get_visible_loads_enriched_range', {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
      p_limit: 2000,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, loads: data ?? [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro inesperado';
    if (message.includes('UNAUTHORIZED')) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    if (message.includes('FORBIDDEN')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    return NextResponse.json({ error: 'INTERNAL_ERROR', detail: message }, { status: 500 });
  }
}

