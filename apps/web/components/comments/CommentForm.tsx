'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';

export function CommentForm({ entidade, entidadeId }: { entidade: 'load' | 'load_request'; entidadeId: string }) {
  const [texto, setTexto] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entidade, entidade_id: entidadeId, texto }),
    });
    if (!response.ok) {
      const data = await response.json();
      setMessage(data.error || 'Erro ao comentar.');
      return;
    }
    setTexto('');
    setMessage('Comentário salvo. Recarregue para atualizar a lista.');
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea className="w-full border rounded p-2 text-sm" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Adicionar comentário interno" />
      <button className="px-3 py-2 bg-indigo-600 text-white rounded text-sm">Comentar</button>
      {message && <p className="text-sm text-zinc-600">{message}</p>}
    </form>
  );
}
