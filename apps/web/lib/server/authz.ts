import { createClient } from '@/lib/supabase/server';

export async function requireProfile() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('UNAUTHORIZED');

  const { data: profile } = await supabase
    .from('users_profile')
    .select('*')
    .eq('auth_user_id', userData.user.id)
    .single();

  if (!profile || !profile.ativo) throw new Error('FORBIDDEN');
  return { supabase, user: userData.user, profile };
}

export function canApprove(profile: { perfil: string }) {
  return ['admin', 'gerente_estoque'].includes(profile.perfil);
}

export function canManageLoad(profile: { perfil: string }, load?: { tipo?: string }) {
  if (['admin', 'gerente_estoque'].includes(profile.perfil)) return true;
  if (profile.perfil === 'gerente_ecommerce') return load?.tipo === 'FULL_MARKETPLACE';
  return false;
}

export function canChecklist(profile: { perfil: string }) {
  return ['admin', 'gerente_estoque', 'operador_carga'].includes(profile.perfil);
}
