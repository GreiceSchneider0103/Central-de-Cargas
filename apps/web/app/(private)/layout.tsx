import { redirect } from 'next/navigation';
import { PrivateLayoutClient } from '@/components/layout/PrivateLayoutClient';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/auth/roles';

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('users_profile')
    .select('*')
    .eq('auth_user_id', userData.user.id)
    .single<UserProfile>();

  if (!profile || !profile.ativo) {
    redirect('/login');
  }

  return (
    <PrivateLayoutClient profile={profile}>{children}</PrivateLayoutClient>
  );
}
