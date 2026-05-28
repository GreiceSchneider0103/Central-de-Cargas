import { NextRequest, NextResponse } from 'next/server';
import { requireProfile } from '@/lib/server/authz';

export async function POST(request: NextRequest) {
  try {
    const { supabase } = await requireProfile();
    const body = await request.json();
    if (!body?.entidade || !body?.entidade_id || typeof body?.texto !== 'string') {
      return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 422 });
    }
    const { data, error } = await supabase.rpc('add_comment_safe', {
      p_entidade: body.entidade,
      p_entidade_id: body.entidade_id,
      p_texto: body.texto,
    });
    if (error) {
      const status = error.message.includes('FORBIDDEN') ? 403 : error.message.includes('COMMENT_REQUIRED') ? 422 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ ok: true, commentId: data });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro inesperado' }, { status: 500 });
  }
}
