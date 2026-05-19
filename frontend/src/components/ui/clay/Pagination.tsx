// Đợt 10 (spec 010) — FR-010. Pagination clay client-side.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

export interface PaginationProps {
  page: number; // 1-based
  pageCount: number;
  onPage: (p: number) => void;
  className?: string;
}

function range(page: number, pageCount: number): (number | '…')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  const lo = Math.max(2, page - 1);
  const hi = Math.min(pageCount - 1, page + 1);
  if (lo > 2) out.push('…');
  for (let i = lo; i <= hi; i++) out.push(i);
  if (hi < pageCount - 1) out.push('…');
  out.push(pageCount);
  return out;
}

export function Pagination({ page, pageCount, onPage, className }: PaginationProps) {
  if (pageCount <= 1) return null;
  const cell =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-[10px] px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--clay-primary-focus)] disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <nav className={clsx('flex items-center gap-1', className)} aria-label="Phân trang">
      <button
        type="button"
        className={cell}
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        aria-label="Trang trước"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {range(page, pageCount).map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="px-2 text-[var(--clay-muted-soft)]">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p)}
            aria-current={p === page ? 'page' : undefined}
            className={clsx(
              cell,
              p === page
                ? 'bg-[var(--clay-primary)] font-semibold text-white'
                : 'text-[var(--clay-text)] hover:bg-[var(--clay-surface-soft)]',
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        className={cell}
        onClick={() => onPage(page + 1)}
        disabled={page >= pageCount}
        aria-label="Trang sau"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

export default Pagination;
