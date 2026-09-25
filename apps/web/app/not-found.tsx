import Link from 'next/link';
import { SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
          <SearchX className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-zinc-900">Página não encontrada</h1>
        <p className="mt-1 text-sm text-zinc-500">O endereço pode ter mudado ou o registro não existe mais.</p>
        <Link href="/" className="mt-5 inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
