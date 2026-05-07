'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white"
    >
      Sair
    </button>
  );
}
