'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { FieldGroup } from '@/components/ui/Field';
import { PasswordInput } from './PasswordInput';

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError('Não foi possível atualizar a senha. Solicite um novo link de recuperação.');
      return;
    }

    router.replace('/');
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FieldGroup label="Nova senha">
        <PasswordInput id="password" required minLength={6} autoFocus autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <span className="text-xs text-zinc-400">Mínimo de 6 caracteres.</span>
      </FieldGroup>
      <FieldGroup label="Confirmar nova senha">
        <PasswordInput id="confirm-password" required minLength={6} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      </FieldGroup>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <Button type="submit" variant="primary" disabled={loading} className="h-11 w-full">
        {loading ? 'Salvando...' : 'Salvar nova senha'}
      </Button>
    </form>
  );
}
