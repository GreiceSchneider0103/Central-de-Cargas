'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { translateError } from '@/lib/ui/error-messages';

export function CommentForm({ entidade, entidadeId }: { entidade: 'load' | 'load_request'; entidadeId: string }) {
  const [texto, setTexto] = useState('');
  const [sending, setSending] = useState(false);
  const toast = useToast();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entidade, entidade_id: entidadeId, texto }),
    });
    setSending(false);
    if (!response.ok) {
      const data = await response.json();
      toast.error(translateError(data.error, 'Erro ao comentar.'));
      return;
    }
    setTexto('');
    toast.success('Comentário salvo. Recarregue para ver na lista.');
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Adicionar comentário interno" />
      <Button type="submit" variant="primary" size="sm" disabled={sending || !texto.trim()}>{sending ? 'Enviando...' : 'Comentar'}</Button>
    </form>
  );
}
