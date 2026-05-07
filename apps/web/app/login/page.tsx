import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LoginForm } from '@/components/auth/LoginForm';

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl p-6 space-y-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold">Central de Cargas</h1>
          <p className="text-sm text-zinc-500">Acesse com sua conta corporativa.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
