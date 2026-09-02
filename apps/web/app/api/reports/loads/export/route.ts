import { NextRequest, NextResponse } from 'next/server';
import { requireProfile } from '@/lib/server/authz';

function parseIso(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function canViewFinancial(role: string) {
  return ['admin', 'gerente_estoque', 'financeiro', 'gerente_ecommerce'].includes(role);
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

    const [{ data, error }, companiesRes, channelsRes, storesRes] = await Promise.all([
      supabase.rpc('get_visible_loads_enriched_range', {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_limit: 2000,
      }),
      supabase.from('companies').select('id,nome'),
      supabase.from('channels').select('id,nome'),
      supabase.from('stores').select('id,nome'),
    ]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const financialAllowed = canViewFinancial(profile.perfil);
    const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];

    const companyById = new Map(((companiesRes.data ?? []) as { id: string; nome: string }[]).map((r) => [r.id, r.nome] as const));
    const channelById = new Map(((channelsRes.data ?? []) as { id: string; nome: string }[]).map((r) => [r.id, r.nome] as const));
    const storeById = new Map(((storesRes.data ?? []) as { id: string; nome: string }[]).map((r) => [r.id, r.nome] as const));

    const resolvedRows: Record<string, unknown>[] = rows.map((r) => ({
      ...r,
      empresa: r.empresa_id ? (companyById.get(String(r.empresa_id)) ?? r.empresa_id) : '',
      marketplace: r.marketplace_id ? (channelById.get(String(r.marketplace_id)) ?? r.marketplace_id) : '',
      loja_destino: r.loja_destino_id ? (storeById.get(String(r.loja_destino_id)) ?? r.loja_destino_id) : '',
    }));

    const headers = [
      'codigo_interno',
      'tipo',
      'status',
      'data_agendada',
      'empresa',
      'marketplace',
      'loja_destino',
      'numero_carga_marketplace',
      'codigo_agendamento',
      'fornecedores',
      'responsavel_nome',
      'comentario',
    ];

    const financialHeaders = [
      'faturamento_estimado',
      'cmv_total',
      'custo_frete',
      'outros_custos',
      'margem_estimativa_valor',
    ];

    const finalHeaders = financialAllowed ? [...headers, ...financialHeaders] : headers;

    const lines: string[] = [];
    lines.push(finalHeaders.join(','));
    for (const r of resolvedRows) {
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

