import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/auth/roles';
import { OperacaoBoard } from '@/components/operacao/OperacaoBoard';

export default async function OperacaoPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: profile } = await supabase.from('users_profile').select('*').eq('auth_user_id', userData.user.id).single<UserProfile>();
  if (!profile) redirect('/');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Operação do estoque</h1>
        <p className="text-sm text-zinc-500">Cargas do dia e da semana: separe, carregue e conclua. O checklist completo fica no detalhe de cada carga.</p>
      </div>
      <OperacaoBoard profile={profile} />
    </div>
  );
}
