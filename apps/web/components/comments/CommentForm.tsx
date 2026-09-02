'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';

export function CommentForm({ entidade, entidadeId }: { entidade: 'load' | 'load_request'; entidadeId: string }) {
  const [texto, setTexto] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setSending(true);
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entidade, entidade_id: entidadeId, texto }),
    });
    setSending(false);
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
      <Textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Adicionar comentário interno" />
      <Button type="submit" variant="primary" size="sm" disabled={sending || !texto.trim()}>{sending ? 'Enviando...' : 'Comentar'}</Button>
      {message && <p className="text-sm text-zinc-600">{message}</p>}
    </form>
  );
}
