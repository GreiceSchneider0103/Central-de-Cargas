'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export function LogoutButton({ compact = false }: { compact?: boolean }) {
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
      title={compact ? 'Sair' : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white',
        compact && 'md:justify-center md:px-0',
      )}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      <span className={cn(compact && 'md:hidden')}>Sair</span>
    </button>
  );
}
