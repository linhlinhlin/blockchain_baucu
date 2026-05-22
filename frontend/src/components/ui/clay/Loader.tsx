// Đợt 10 (spec 010) — FR-006. Loader clay: spinner + nhãn nhất quán.
import clsx from 'clsx';

export interface LoaderProps {
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function Loader({ label, size = 'md', className }: LoaderProps) {
  const dim = size === 'sm' ? 'h-4 w-4 border-2' : 'h-6 w-6 border-[3px]';
  return (
    <div
      className={clsx('flex items-center gap-2 text-[var(--clay-muted)]', className)}
      role="status"
      aria-live="polite"
    >
      <span
        className={clsx(
          'animate-spin rounded-full border-current border-r-transparent',
          dim,
        )}
        aria-hidden="true"
      />
      {label && <span className="text-sm">{label}</span>}
      <span className="sr-only">{label ?? 'Đang tải'}</span>
    </div>
  );
}

export default Loader;
