// Đợt 10 (spec 010) — FR-004. StatusBadge: tone ngữ nghĩa (token Đợt 10), pill quiet.
import type { ReactNode } from 'react';
import clsx from 'clsx';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatusBadgeProps {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}

const TONE: Record<StatusTone, string> = {
  success: 'text-[var(--state-success)] bg-[var(--state-success-soft)] border-[var(--state-success)]',
  warning: 'text-[var(--state-warning)] bg-[var(--state-warning-soft)] border-[var(--state-warning)]',
  danger: 'text-[var(--state-danger)] bg-[var(--state-danger-soft)] border-[var(--state-danger)]',
  info: 'text-[var(--state-info)] bg-[var(--state-info-soft)] border-[var(--state-info)]',
  neutral: 'text-[var(--clay-text)] bg-[var(--state-neutral-soft)] border-[var(--clay-border)]',
};

export function StatusBadge({ tone = 'neutral', children, className }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold leading-none',
        'border-opacity-30',
        TONE[tone],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-current"
      />
      {children}
    </span>
  );
}

export default StatusBadge;
