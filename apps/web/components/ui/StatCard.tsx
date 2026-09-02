import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/ui/status-styles';

const TONE_ICON_WRAP: Record<StatusTone, string> = {
  neutral: 'bg-zinc-100 text-zinc-600',
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-sky-100 text-sky-700',
  brand: 'bg-brand-100 text-brand-700',
  progress: 'bg-teal-100 text-teal-700',
  success: 'bg-emerald-100 text-emerald-700',
  danger: 'bg-rose-100 text-rose-700',
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  hint,
  className,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: StatusTone;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-3 rounded-card border border-zinc-200 bg-white p-4 shadow-card', className)}>
      {Icon && (
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', TONE_ICON_WRAP[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-xs font-medium text-zinc-500">{label}</div>
        <div className="text-xl font-bold text-zinc-900 truncate">{value}</div>
        {hint && <div className="text-xs text-zinc-400">{hint}</div>}
      </div>
    </div>
  );
}
