import React, { useState } from 'react';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Truck, LogIn, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Login realizado com sucesso!');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/operation-not-allowed') {
        toast.error('O login por e-mail/senha não está ativado no Firebase Console.');
      } else {
        toast.error('Erro ao realizar login. Verifique suas credenciais.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success('Login realizado com sucesso!');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/cancelled-popup-request') {
        toast.error('A janela de login foi fechada antes da conclusão ou existe uma solicitação pendente.');
      } else if (error.code === 'auth/operation-not-allowed') {
        toast.error('O provedor Google não está ativado no Firebase Console.');
      } else {
        toast.error('Erro ao realizar login com Google.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <Card className="w-full max-w-md shadow-2xl border-none">
        <CardHeader className="space-y-1 text-center pb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-indigo-200 shadow-xl">
              <Truck className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Central de Cargas</CardTitle>
          <CardDescription>Acesse sua conta para gerenciar a operação</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="nome@empresa.com.br" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-4">
            <Button className="w-full h-11 text-base font-medium bg-indigo-600 hover:bg-indigo-700" type="submit" disabled={isLoading}>
              {isLoading ? 'Entrando...' : 'Entrar'}
              <LogIn className="w-4 h-4 ml-2" />
            </Button>
            <div className="relative w-full text-center">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-200"></span>
              </div>
              <span className="relative bg-white px-4 text-xs text-zinc-500 uppercase tracking-widest font-semibold">ou</span>
            </div>
            <Button variant="outline" className="w-full h-11 text-base font-medium" type="button" onClick={handleGoogleLogin} disabled={isGoogleLoading}>
              {isGoogleLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-indigo-600 mr-2" />
              ) : (
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 ml-2" />
              )}
              {isGoogleLoading ? 'Carregando...' : 'Entrar com Google'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
