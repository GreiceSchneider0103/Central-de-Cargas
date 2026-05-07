import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CadastrosManager } from '@/components/cadastros/CadastrosManager';
import type { UserProfile } from '@/lib/auth/roles';

export default async function CadastrosPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile } = await supabase
    .from('users_profile')
    .select('*')
    .eq('auth_user_id', userData.user.id)
    .single<UserProfile>();

  if (!profile) redirect('/');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cadastros Operacionais</h1>
      <p className="text-zinc-600">CRUD básico com ativação/inativação, controlado por perfil.</p>
      <CadastrosManager role={profile.perfil} />
    </div>
  );
}
