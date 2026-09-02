import { NextRequest, NextResponse } from 'next/server';
import { requireProfile } from '@/lib/server/authz';
import { USER_PROFILES } from '@/lib/auth/roles';
import { createAdminClient } from '@/lib/supabase/admin';

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
    const manualLink = Boolean(body.manual_link);

    let authUserId = payload.auth_user_id;

    if (manualLink) {
      if (!authUserId) return NextResponse.json({ error: 'AUTH_USER_UUID_REQUIRED' }, { status: 422 });
    } else {
      if (!payload.email) return NextResponse.json({ error: 'EMAIL_REQUIRED' }, { status: 422 });

      const admin = createAdminClient();
      const redirectTo = `${new URL(request.url).origin}/auth/callback?next=/auth/atualizar-senha`;
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(payload.email, { redirectTo });

      if (inviteError || !invited.user) {
        const alreadyRegistered = /already.*regist/i.test(inviteError?.message ?? '');
        return NextResponse.json(
          { error: alreadyRegistered ? 'EMAIL_ALREADY_REGISTERED' : 'USER_INVITE_FAILED' },
          { status: alreadyRegistered ? 409 : 500 },
        );
      }

      authUserId = invited.user.id;
    }

    const { data: inserted, error } = await supabase
      .from('users_profile')
      .insert({ ...payload, auth_user_id: authUserId })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, profile: inserted });
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
