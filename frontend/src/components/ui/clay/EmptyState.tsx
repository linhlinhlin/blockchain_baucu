// Đợt 10 (spec 010) — FR-006. EmptyState: không vùng trắng trống; có hướng dẫn.
import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-3 rounded-[18px] border border-dashed border-[var(--clay-border)] bg-[var(--clay-surface-soft)] px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--clay-surface)] text-[var(--clay-muted)]"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-[var(--clay-text)]">{title}</h3>
      {description && (
        <p className="max-w-sm text-[13px] leading-relaxed text-[var(--clay-muted)]">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export default EmptyState;
