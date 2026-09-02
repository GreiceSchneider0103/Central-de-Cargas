import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TONE_BADGE, TONE_DOT, type StatusTone } from '@/lib/ui/status-styles';

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', TONE_BADGE[tone], className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', TONE_DOT[tone])} />}
      {children}
    </span>
  );
}
