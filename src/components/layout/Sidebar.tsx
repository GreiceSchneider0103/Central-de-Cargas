import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  FileText, 
  Truck, 
  Package, 
  Settings, 
  LogOut,
  Users
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: Object.values(UserRole) },
  { icon: Calendar, label: 'Agenda', path: '/agenda', roles: Object.values(UserRole) },
  { icon: FileText, label: 'Solicitações', path: '/solicitacoes', roles: [UserRole.ADMIN, UserRole.STOCK_MANAGER, UserRole.ECOMMERCE_MANAGER, UserRole.SALESPERSON] },
  { icon: Truck, label: 'Cargas', path: '/cargas', roles: [UserRole.ADMIN, UserRole.STOCK_MANAGER, UserRole.ECOMMERCE_MANAGER, UserRole.OPERATOR, UserRole.FINANCE] },
  { icon: Package, label: 'Produtos', path: '/produtos', roles: [UserRole.ADMIN, UserRole.STOCK_MANAGER, UserRole.ECOMMERCE_MANAGER] },
  { icon: Users, label: 'Usuários', path: '/usuarios', roles: [UserRole.ADMIN] },
  { icon: Settings, label: 'Cadastros', path: '/cadastros', roles: [UserRole.ADMIN] },
];

export function Sidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();

  const filteredItems = menuItems.filter(item => 
    profile && item.roles.includes(profile.role)
  );

  return (
    <div className="w-64 h-screen bg-zinc-950 text-white flex flex-col border-r border-zinc-800">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Truck className="w-6 h-6 text-indigo-500" />
          Central de Cargas
        </h1>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {filteredItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              location.pathname === item.path
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-zinc-900/50 mb-4">
          <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
            {profile?.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.name}</p>
            <p className="text-xs text-zinc-500 truncate lowercase">{profile?.role}</p>
          </div>
        </div>

        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </div>
  );
}
