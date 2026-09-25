import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UpdatePasswordForm } from '@/components/auth/UpdatePasswordForm';
import { AuthShell } from '@/components/auth/AuthShell';

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect('/login');
  }

  return (
    <AuthShell title="Definir nova senha" description="Escolha uma nova senha para sua conta.">
      <UpdatePasswordForm />
    </AuthShell>
  );
}
