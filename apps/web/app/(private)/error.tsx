'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// Erro inesperado numa tela do sistema: mantém o menu e oferece tentar de novo.
export default function PrivateError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-zinc-900">Algo deu errado nesta tela</h1>
        <p className="mt-1 text-sm text-zinc-500">Tente de novo. Se continuar, recarregue a página (Ctrl+Shift+R).</p>
        <Button variant="primary" className="mt-5" onClick={reset}>Tentar de novo</Button>
      </div>
    </div>
  );
}
