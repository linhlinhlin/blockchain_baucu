// Đợt 10 (spec 010) — FR-006. Skeleton clay: placeholder tải, tôn trọng prefers-reduced-motion.
import clsx from 'clsx';

export interface SkeletonProps {
  lines?: number;
  className?: string;
}

export function Skeleton({ lines = 3, className }: SkeletonProps) {
  return (
    <div className={clsx('space-y-2.5', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3.5 animate-pulse rounded-[6px] bg-[var(--clay-border)]"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

export default Skeleton;
