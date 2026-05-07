import Link from 'next/link';
import { Calendar, FileText, LayoutDashboard, Package, Settings, Truck } from 'lucide-react';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Calendar, label: 'Agenda', path: '/agenda' },
  { icon: FileText, label: 'Solicitações', path: '/solicitacoes' },
  { icon: Truck, label: 'Cargas', path: '/cargas' },
  { icon: Package, label: 'Produtos', path: '/produtos' },
  { icon: Settings, label: 'Cadastros', path: '/cadastros' },
];

export function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-zinc-950 text-white flex flex-col border-r border-zinc-800">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight">Central de Cargas</h1>
        <p className="text-xs text-zinc-400 mt-1">Base Next.js (migração)</p>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {menuItems.map((item) => (
          <Link key={item.path} href={item.path} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-900">
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
