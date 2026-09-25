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
  ClipboardCheck,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { MENU_BY_ROLE, PERFIL_LABEL, type UserProfile } from '@/lib/auth/roles';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { cn } from '@/lib/utils';

const ITEMS: Record<string, { label: string; icon: LucideIcon }> = {
  '/': { label: 'Dashboard', icon: LayoutDashboard },
  '/operacao': { label: 'Operação', icon: ClipboardCheck },
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

export function Sidebar({
  profile,
  open = true,
  onClose,
  collapsed = false,
  onToggleCollapsed,
}: {
  profile: UserProfile;
  open?: boolean;
  onClose?: () => void;
  // Só no desktop: menu recolhido mostra apenas os ícones.
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const items = MENU_BY_ROLE[profile.perfil] || [];
  const pathname = usePathname();

  return (
    <aside
      className={`bg-zinc-950 text-white flex flex-col border-r border-zinc-800
        fixed inset-y-0 left-0 z-40 w-56 transform transition-[transform,width] md:sticky md:top-0 md:h-screen md:translate-x-0
        ${collapsed ? 'md:w-14' : 'md:w-48'}
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}
      aria-hidden={!open}
    >
      <div className={cn('flex items-center gap-2 px-4 py-4', collapsed && 'md:justify-center md:px-2')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 font-bold text-sm">CC</div>
        <h1 className={cn('text-sm font-bold tracking-tight leading-none', collapsed && 'md:hidden')}>Central de Cargas</h1>
      </div>

      <nav className={cn('flex-1 space-y-0.5 overflow-y-auto px-2')}>
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
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                collapsed && 'md:justify-center md:px-0',
                active ? 'bg-brand-600 text-white' : 'text-zinc-300 hover:bg-zinc-900 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className={cn(collapsed && 'md:hidden')}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={cn('border-t border-zinc-800 p-3', collapsed && 'md:px-2')}>
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className={cn(
              'mb-2 hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white md:flex',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            <span className={cn(collapsed && 'md:hidden')}>Recolher menu</span>
          </button>
        )}
        <div className={cn('mb-2 flex items-center gap-2.5', collapsed && 'md:justify-center')} title={collapsed ? profile.nome ?? profile.email ?? '' : undefined}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold">
            {initials(profile.nome, profile.email ?? '')}
          </div>
          <div className={cn('min-w-0', collapsed && 'md:hidden')}>
            <p className="truncate text-sm font-medium text-white">{profile.nome ?? profile.email}</p>
            <p className="truncate text-xs text-zinc-400">{PERFIL_LABEL[profile.perfil] ?? profile.perfil}</p>
          </div>
        </div>
        <LogoutButton compact={collapsed} />
      </div>
    </aside>
  );
}
