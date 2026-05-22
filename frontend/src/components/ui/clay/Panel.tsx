// Đợt 10 (spec 010) — FR-003/004. Panel/SectionCard clay: radius 18px, flat (no decorative shadow).
import type { ElementType, ReactNode } from 'react';
import clsx from 'clsx';

export interface PanelProps {
  as?: ElementType;
  padded?: boolean;
  className?: string;
  children: ReactNode;
}

export function Panel({ as, padded = true, className, children }: PanelProps) {
  const Tag = (as ?? 'div') as ElementType;
  return (
    <Tag
      className={clsx(
        'rounded-[18px] border border-[var(--clay-border)] bg-[var(--clay-surface)]',
        padded && 'p-5 md:p-6',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export interface SectionCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function SectionCard({ title, description, actions, className, children }: SectionCardProps) {
  return (
    <Panel className={className}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--clay-text)]">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[13px] leading-snug text-[var(--clay-muted)]">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </Panel>
  );
}

export default Panel;
