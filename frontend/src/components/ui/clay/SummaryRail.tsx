// Đợt 10 (spec 010) — FR-007. SummaryRail: cột tóm tắt dính (sticky) ≥lg.
// Dùng trong Wizard.rail; <lg tự xuống dưới (Wizard đã lo layout grid).
import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface SummaryRailProps {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function SummaryRail({ title, children, footer, className }: SummaryRailProps) {
  return (
    <div
      className={clsx(
        'rounded-[18px] border border-[var(--clay-border)] bg-[var(--clay-surface)] p-5',
        className,
      )}
    >
      {title && (
        <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-[var(--clay-text)]">
          {title}
        </h2>
      )}
      <div className="space-y-3 text-sm">{children}</div>
      {footer && <div className="mt-4 border-t border-[var(--clay-border)] pt-4">{footer}</div>}
    </div>
  );
}

export interface SummaryRowProps {
  label: ReactNode;
  value: ReactNode;
}

export function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[var(--clay-muted)]">{label}</span>
      <span className="text-right font-medium text-[var(--clay-text)]">{value}</span>
    </div>
  );
}

export default SummaryRail;
