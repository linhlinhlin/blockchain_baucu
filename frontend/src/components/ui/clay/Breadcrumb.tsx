// Đợt 10 (spec 010) — FR-001. Breadcrumb clay: caption quiet, accent xanh cho link.
import type React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Crumb } from '../../../routes/routeMeta';

export interface BreadcrumbProps {
  trail: Crumb[];
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ trail, className }) => {
  if (!trail?.length) return null;
  return (
    <nav
      aria-label="Đường dẫn phân cấp"
      className={['flex items-center gap-1 text-[13px] leading-none', className ?? ''].join(' ')}
    >
      <ol className="flex flex-wrap items-center gap-1">
        {trail.map((c, i) => {
          const last = i === trail.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1">
              {c.to && !last ? (
                <Link
                  to={c.to}
                  className="rounded-[6px] px-1 py-0.5 text-[var(--clay-muted)] hover:text-[var(--clay-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--clay-primary-focus)]"
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  className={
                    last
                      ? 'px-1 py-0.5 font-semibold text-[var(--clay-text)]'
                      : 'px-1 py-0.5 text-[var(--clay-muted)]'
                  }
                  aria-current={last ? 'page' : undefined}
                >
                  {c.label}
                </span>
              )}
              {!last && (
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-[var(--clay-muted-soft)]"
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
