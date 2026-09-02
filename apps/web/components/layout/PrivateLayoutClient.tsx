'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import type { UserProfile } from '@/lib/auth/roles';
import { Sidebar } from '@/components/layout/Sidebar';
import { ToastProvider } from '@/components/ui/Toast';

export function PrivateLayoutClient({
  profile,
  children,
}: {
  profile: UserProfile;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-zinc-50">
        <Sidebar profile={profile} open={open} onClose={() => setOpen(false)} />

        {open && (
          <button
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="md:hidden sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
            <button
              className="rounded-lg border border-zinc-200 p-2 text-zinc-600"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="text-sm font-semibold text-zinc-900">Central de Cargas</div>
            <div className="w-9" />
          </div>

          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
