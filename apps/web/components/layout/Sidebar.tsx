'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Truck,
  Package,
  BarChart3,
  History,
  Users,
  Settings2,
  type LucideIcon,
} from 'lucide-react';
import { MENU_BY_ROLE, type UserProfile } from '@/lib/auth/roles';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { cn } from '@/lib/utils';

const ITEMS: Record<string, { label: string; icon: LucideIcon }> = {
  '/': { label: 'Dashboard', icon: LayoutDashboard },
  '/agenda': { label: 'Agenda', icon: CalendarDays },
  '/solicitacoes': { label: 'Solicitações', icon: ClipboardList },
  '/cargas': { label: 'Cargas', icon: Truck },
  '/produtos': { label: 'Produtos', icon: Package },
  '/relatorios': { label: 'Relatórios', icon: BarChart3 },
  '/auditoria': { label: 'Auditoria', icon: History },
  '/usuarios': { label: 'Usuários', icon: Users },
  '/cadastros': { label: 'Cadastros', icon: Settings2 },
};

function initials(name: string | null | undefined, fallback: string) {
  const source = (name ?? fallback).trim();
  if (!source) return '?';
  const parts = source.split(/\s+/);
  const chars = parts.length > 1 ? [parts[0][0], parts[parts.length - 1][0]] : [source[0]];
  return chars.join('').toUpperCase();
}

const PERFIL_LABEL: Record<string, string> = {
  admin: 'Administrador',
  gerente_estoque: 'Gerente de estoque',
  gerente_ecommerce: 'Gerente de e-commerce',
  vendedor_loja: 'Vendedor de loja',
  operador_carga: 'Operador de carga',
  financeiro: 'Financeiro',
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
  const pathname = usePathname();

  return (
    <aside
      className={`bg-zinc-950 text-white flex flex-col border-r border-zinc-800
        fixed inset-y-0 left-0 z-40 w-64 transform transition-transform md:static md:translate-x-0
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}
      aria-hidden={!open}
    >
      <div className="flex items-center gap-2 p-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-bold text-sm">CC</div>
        <div>
          <h1 className="text-sm font-bold tracking-tight leading-none">Central de Cargas</h1>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto">
        {items.map((path) => {
          const item = ITEMS[path];
          if (!item) return null;
          const Icon = item.icon;
          const active = path === '/' ? pathname === '/' : pathname === path || pathname?.startsWith(`${path}/`);
          return (
            <Link
              key={path}
              href={path}
              onClick={() => onClose?.()}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active ? 'bg-brand-600 text-white' : 'text-zinc-300 hover:bg-zinc-900 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-4">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold">
            {initials(profile.nome, profile.email ?? '')}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{profile.nome ?? profile.email}</p>
            <p className="truncate text-xs text-zinc-400">{PERFIL_LABEL[profile.perfil] ?? profile.perfil}</p>
          </div>
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
