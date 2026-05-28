import { NextRequest, NextResponse } from 'next/server';
import { requireProfile } from '@/lib/server/authz';
import { USER_PROFILES } from '@/lib/auth/roles';

function isAdmin(profile: { perfil: string }) {
  return profile.perfil === 'admin';
}

function cleanNullable(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildPayload(body: Record<string, unknown>) {
  const perfil = String(body.perfil ?? '');
  if (!USER_PROFILES.includes(perfil as (typeof USER_PROFILES)[number])) {
    throw new Error('INVALID_PROFILE');
  }

  return {
    auth_user_id: cleanNullable(body.auth_user_id),
    nome: cleanNullable(body.nome),
    email: cleanNullable(body.email),
    perfil,
    loja_id: cleanNullable(body.loja_id),
    empresa_id: cleanNullable(body.empresa_id),
    ativo: Boolean(body.ativo),
  };
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, profile } = await requireProfile();
    if (!isAdmin(profile)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const body = await request.json();
    const payload = buildPayload(body);
    if (!payload.auth_user_id) return NextResponse.json({ error: 'AUTH_USER_REQUIRED' }, { status: 422 });

    const { error } = await supabase.from('users_profile').insert(payload);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro inesperado';
    return NextResponse.json({ error: message }, { status: message === 'INVALID_PROFILE' ? 422 : 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, profile } = await requireProfile();
    if (!isAdmin(profile)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const body = await request.json();
    const id = cleanNullable(body.id);
    if (!id) return NextResponse.json({ error: 'ID_REQUIRED' }, { status: 422 });

    const payload = buildPayload(body);
    delete (payload as Partial<typeof payload>).auth_user_id;

    const { error } = await supabase.from('users_profile').update(payload).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro inesperado';
    return NextResponse.json({ error: message }, { status: message === 'INVALID_PROFILE' ? 422 : 500 });
  }
}
