import type { ReactNode } from 'react';
import { CalendarDays, ClipboardCheck, Truck } from 'lucide-react';

const HIGHLIGHTS = [
  { icon: Truck, text: 'Cargas de loja e Full num só lugar' },
  { icon: CalendarDays, text: 'Agenda e operação do dia para o estoque' },
  { icon: ClipboardCheck, text: 'Solicitações com aprovação e acompanhamento' },
];

// Layout das telas públicas de acesso (login, nova senha).
export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-50">
      <aside className="relative hidden w-[42%] max-w-xl flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-white lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl" />

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold">CC</div>
          <span className="font-semibold tracking-tight">Central de Cargas</span>
        </div>

        <div className="relative space-y-6">
          <h2 className="text-3xl font-bold leading-tight tracking-tight">
            Do pedido à coleta,
            <br />
            tudo acompanhado.
          </h2>
          <ul className="space-y-3 text-sm text-zinc-300">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-zinc-500">Acesso restrito à equipe.</p>
      </aside>

      <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">CC</div>
            <span className="font-semibold tracking-tight text-zinc-900">Central de Cargas</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
