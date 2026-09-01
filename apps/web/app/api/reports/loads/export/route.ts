import { NextRequest, NextResponse } from 'next/server';
import { requireProfile } from '@/lib/server/authz';

function parseIso(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Vendedor não vê margem/faturamento; operador não vê custo/CMV (ver migration p1_financial_masking_by_field).
function canViewCosts(role: string) {
  return ['admin', 'gerente_estoque', 'gerente_ecommerce', 'financeiro', 'vendedor_loja'].includes(role);
}

function canViewMargin(role: string) {
  return ['admin', 'gerente_estoque', 'gerente_ecommerce', 'financeiro', 'operador_carga'].includes(role);
}

function csvEscape(value: unknown) {
  const s = value == null ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  try {
    const { supabase, profile } = await requireProfile();
    const url = new URL(req.url);
    const from = parseIso(url.searchParams.get('from'));
    const to = parseIso(url.searchParams.get('to'));
    if (!from || !to || to <= from) {
      return NextResponse.json({ error: 'INVALID_RANGE' }, { status: 422 });
    }

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

    const costsAllowed = canViewCosts(profile.perfil);
    const marginAllowed = canViewMargin(profile.perfil);
    const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];

    const headers = [
      'codigo_interno',
      'tipo',
      'status',
      'data_agendada',
      'empresa_id',
      'marketplace_id',
      'loja_destino_id',
      'numero_carga_marketplace',
      'codigo_agendamento',
      'fornecedores',
      'responsavel_nome',
      'comentario',
    ];

    const costHeaders = ['cmv_total', 'custo_frete', 'outros_custos'];
    const marginHeaders = ['faturamento_estimado', 'margem_estimativa_valor'];

    const finalHeaders = [
      ...headers,
      ...(costsAllowed ? costHeaders : []),
      ...(marginAllowed ? marginHeaders : []),
    ];

    const lines: string[] = [];
    lines.push(finalHeaders.join(','));
    for (const r of rows) {
      lines.push(
        finalHeaders
          .map((h) => csvEscape(r[h]))
          .join(','),
      );
    }

    const csv = lines.join('\n');
    const filename = `relatorio-cargas-${from.toISOString().slice(0, 10)}_${to
      .toISOString()
      .slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro inesperado';
    if (message.includes('UNAUTHORIZED')) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    if (message.includes('FORBIDDEN')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    return NextResponse.json({ error: 'INTERNAL_ERROR', detail: message }, { status: 500 });
  }
}

