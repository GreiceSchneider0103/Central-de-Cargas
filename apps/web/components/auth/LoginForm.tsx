'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { FieldGroup, Input } from '@/components/ui/Field';
import { PasswordInput } from './PasswordInput';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'recover'>('login');
  const [recoverMessage, setRecoverMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Não foi possível entrar. Verifique e-mail e senha.');
      setLoading(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  };

  const handleRecover = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setRecoverMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/atualizar-senha`,
    });
    setLoading(false);

    if (error) {
      setError('Não foi possível enviar o link de recuperação.');
      return;
    }

    setRecoverMessage('Se o e-mail existir, enviamos um link para redefinir a senha.');
  };

  if (mode === 'recover') {
    return (
      <form onSubmit={handleRecover} className="space-y-4">
        <div className="rounded-lg bg-zinc-100 px-3 py-2.5 text-sm text-zinc-600">
          Informe seu e-mail. Enviamos um link para você criar uma nova senha.
        </div>
        <FieldGroup label="E-mail">
          <Input
            id="recover-email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            className="h-11"
            placeholder="voce@empresa.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FieldGroup>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {recoverMessage && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{recoverMessage}</p>}

        <Button type="submit" variant="primary" disabled={loading} className="h-11 w-full">
          {loading ? 'Enviando...' : 'Enviar link de recuperação'}
        </Button>
        <button
          type="button"
          className="w-full text-sm font-medium text-zinc-600 hover:text-zinc-900"
          onClick={() => { setMode('login'); setError(null); setRecoverMessage(null); }}
        >
          ← Voltar para o login
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FieldGroup label="E-mail">
        <Input
          id="email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          className="h-11"
          placeholder="voce@empresa.com.br"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </FieldGroup>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-xs font-medium text-zinc-600">Senha</label>
          <button
            type="button"
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
            onClick={() => { setMode('recover'); setError(null); }}
          >
            Esqueci minha senha
          </button>
        </div>
        <PasswordInput
          id="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <Button type="submit" variant="primary" disabled={loading} className="h-11 w-full">
        {loading ? 'Entrando...' : 'Entrar'}
      </Button>
    </form>
  );
}
