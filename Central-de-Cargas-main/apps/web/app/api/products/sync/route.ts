import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncProducts } from '@/lib/products/sync';

async function handleSync(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      const result = await syncProducts();

      return NextResponse.json({
        ok: true,
        source: 'cron',
        ...result,
      });
    }

    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('users_profile')
      .select('perfil,ativo')
      .eq('auth_user_id', userData.user.id)
      .single();

    if (profileError || !profile || !profile.ativo || profile.perfil !== 'admin') {
      return NextResponse.json(
        { error: 'Sem permissão para sincronizar' },
        { status: 403 }
      );
    }

    const result = await syncProducts();

    return NextResponse.json({
      ok: true,
      source: 'manual',
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro na sincronização';

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}
