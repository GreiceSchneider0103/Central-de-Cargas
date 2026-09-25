'use client';

import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/Field';
import { cn } from '@/lib/utils';

export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <Input ref={ref} type={visible ? 'text' : 'password'} className={cn('h-11 pr-10', className)} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Esconder senha' : 'Mostrar senha'}
          title={visible ? 'Esconder senha' : 'Mostrar senha'}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-zinc-400 hover:text-zinc-700"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';
