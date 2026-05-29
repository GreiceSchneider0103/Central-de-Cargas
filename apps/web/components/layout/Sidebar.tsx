'use client';

import Link from 'next/link';
import { MENU_BY_ROLE, type UserProfile } from '@/lib/auth/roles';
import { LogoutButton } from '@/components/auth/LogoutButton';

const labels: Record<string, string> = {
  '/': 'Dashboard',
  '/agenda': 'Agenda',
  '/solicitacoes': 'Solicitações',
  '/cargas': 'Cargas',
  '/produtos': 'Produtos',
  '/relatorios': 'Relatórios',
  '/auditoria': 'Auditoria',
  '/usuarios': 'Usuários',
  '/cadastros': 'Cadastros',
};

export function Sidebar({
  profile,
  open = true,
  onClose,
}: {
  profile: UserProfile;
  open?: boolean;
  onClose?: () => void;
}) {
  const items = MENU_BY_ROLE[profile.perfil] || [];

  return (
    <aside
      className={`bg-zinc-950 text-white flex flex-col border-r border-zinc-800
        fixed inset-y-0 left-0 z-40 w-64 transform transition-transform md:static md:translate-x-0
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}
      aria-hidden={!open}
    >
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight">Central de Cargas</h1>
        <p className="text-xs text-zinc-400 mt-1">{profile.nome ?? profile.email}</p>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {items.map((path) => (
          <Link
            key={path}
            href={path}
            onClick={() => onClose?.()}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-900"
          >
            {labels[path] ?? path}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-400 mb-2">Perfil: {profile.perfil}</p>
        <LogoutButton />
      </div>
    </aside>
  );
}

