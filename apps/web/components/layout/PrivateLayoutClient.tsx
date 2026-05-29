'use client';

import { useState } from 'react';
import type { UserProfile } from '@/lib/auth/roles';
import { Sidebar } from '@/components/layout/Sidebar';

export function PrivateLayoutClient({
  profile,
  children,
}: {
  profile: UserProfile;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
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
        <div className="md:hidden sticky top-0 z-20 bg-zinc-50 border-b px-4 py-3 flex items-center justify-between">
          <button
            className="px-3 py-2 border rounded"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            Menu
          </button>
          <div className="text-sm font-semibold">Central de Cargas</div>
          <div className="w-[52px]" />
        </div>

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

