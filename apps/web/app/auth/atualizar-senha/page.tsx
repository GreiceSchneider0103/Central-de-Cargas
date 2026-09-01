import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UpdatePasswordForm } from '@/components/auth/UpdatePasswordForm';

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl p-6 space-y-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold">Definir nova senha</h1>
          <p className="text-sm text-zinc-500">Escolha uma nova senha para sua conta.</p>
        </div>
        <UpdatePasswordForm />
      </div>
    </div>
  );
}
