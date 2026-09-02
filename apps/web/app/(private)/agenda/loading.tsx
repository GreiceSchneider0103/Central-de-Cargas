import { Skeleton } from '@/components/ui/Skeleton';

export default function AgendaLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-48" />
      </div>
      <Skeleton className="h-[calc(100vh-14rem)] min-h-[480px] w-full" />
    </div>
  );
}
