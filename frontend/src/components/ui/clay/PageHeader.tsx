// Đợt 10 (spec 010) — FR-001. Page header clay: breadcrumb + title quiet + actions slot.
import type React from 'react';
import { Breadcrumb } from './Breadcrumb';
import type { Crumb } from '../../../routes/routeMeta';

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: Crumb[];
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumb,
  actions,
  className,
}) => (
  <header className={['mb-6', className ?? ''].join(' ')}>
    {breadcrumb && breadcrumb.length > 0 && (
      <div className="mb-3">
        <Breadcrumb trail={breadcrumb} />
      </div>
    )}
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1
          className="font-[var(--display-font)] text-[1.75rem] font-semibold leading-tight tracking-[-0.015em] text-[var(--clay-text)]"
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[15px] leading-relaxed text-[var(--clay-muted)]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  </header>
);

export default PageHeader;
