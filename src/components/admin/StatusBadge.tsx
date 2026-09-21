import { statusInfo, toneClass } from '@/lib/hrStatus';
import { cn } from '@/lib/utils';

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const { label, tone } = statusInfo(status);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        toneClass(tone),
        className,
      )}
    >
      {label}
    </span>
  );
}
