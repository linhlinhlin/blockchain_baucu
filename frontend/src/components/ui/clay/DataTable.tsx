// Đợt 10 (spec 010) — FR-004/008/010. DataTable clay: sort/filter/paginate CLIENT-SIDE,
// thân bảng có TRẦN chiều cao (không phình trang). KHÔNG gọi API (research §D4).
import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import clsx from 'clsx';
import { Pagination } from './Pagination';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  filter?: 'text' | 'select';
  render?: (row: T) => ReactNode;
  /** Giá trị thô cho sort/filter (mặc định đọc row[key]). */
  value?: (row: T) => string | number;
  width?: string;
  align?: 'left' | 'right' | 'center';
}

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  pageSize?: number;
  maxBodyHeight?: number | string;
  empty?: ReactNode;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  getRowKey?: (row: T, index: number) => string | number;
  className?: string;
}

function rawValue<T>(row: T, col: Column<T>): string | number {
  if (col.value) return col.value(row);
  const v = (row as Record<string, unknown>)[col.key];
  return typeof v === 'number' ? v : String(v ?? '');
}

export function DataTable<T>({
  rows,
  columns,
  pageSize = 10,
  maxBodyHeight = 460,
  empty,
  initialSort,
  getRowKey,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let out = rows;
    for (const col of columns) {
      const f = filters[col.key];
      if (!f) continue;
      out = out.filter((r) =>
        String(rawValue(r, col)).toLowerCase().includes(f.toLowerCase()),
      );
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        out = [...out].sort((a, b) => {
          const av = rawValue(a, col);
          const bv = rawValue(b, col);
          const cmp =
            typeof av === 'number' && typeof bv === 'number'
              ? av - bv
              : String(av).localeCompare(String(bv), 'vi');
          return sort.dir === 'asc' ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, columns, filters, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: string) =>
    setSort((s) =>
      s?.key === key
        ? s.dir === 'asc'
          ? { key, dir: 'desc' }
          : null
        : { key, dir: 'asc' },
    );

  const selectOptions = (col: Column<T>) =>
    Array.from(new Set(rows.map((r) => String(rawValue(r, col))))).sort();

  return (
    <div className={clsx('flex flex-col gap-3', className)}>
      <div className="overflow-hidden rounded-[14px] border border-[var(--clay-border)]">
        <div className="overflow-auto" style={{ maxHeight: maxBodyHeight }}>
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--clay-surface-soft)]">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    style={{ width: c.width }}
                    className={clsx(
                      'border-b border-[var(--clay-border)] px-3 py-2.5 text-left align-bottom',
                      c.align === 'right' && 'text-right',
                      c.align === 'center' && 'text-center',
                    )}
                  >
                    <div className="flex flex-col gap-1.5">
                      {c.sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[-0.01em] text-[var(--clay-muted)] hover:text-[var(--clay-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--clay-primary-focus)]"
                          aria-label={`Sắp xếp theo ${c.header}`}
                        >
                          {c.header}
                          {sort?.key === c.key ? (
                            sort.dir === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                          )}
                        </button>
                      ) : (
                        <span className="text-[12px] font-semibold uppercase tracking-[-0.01em] text-[var(--clay-muted)]">
                          {c.header}
                        </span>
                      )}
                      {c.filter === 'text' && (
                        <input
                          type="search"
                          aria-label={`Lọc ${c.header}`}
                          value={filters[c.key] ?? ''}
                          onChange={(e) => {
                            setFilters((f) => ({ ...f, [c.key]: e.target.value }));
                            setPage(1);
                          }}
                          placeholder="Lọc…"
                          className="w-full rounded-[8px] border border-[var(--clay-border)] bg-[var(--clay-surface)] px-2 py-1 text-xs focus:outline focus:outline-2 focus:outline-[var(--clay-primary-focus)]"
                        />
                      )}
                      {c.filter === 'select' && (
                        <select
                          aria-label={`Lọc ${c.header}`}
                          value={filters[c.key] ?? ''}
                          onChange={(e) => {
                            setFilters((f) => ({ ...f, [c.key]: e.target.value }));
                            setPage(1);
                          }}
                          className="w-full rounded-[8px] border border-[var(--clay-border)] bg-[var(--clay-surface)] px-2 py-1 text-xs focus:outline focus:outline-2 focus:outline-[var(--clay-primary-focus)]"
                        >
                          <option value="">Tất cả</option>
                          {selectOptions(c).map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="p-8 text-center">
                    {empty ?? (
                      <span className="text-sm text-[var(--clay-muted)]">Không có dữ liệu.</span>
                    )}
                  </td>
                </tr>
              ) : (
                pageRows.map((row, i) => (
                  <tr
                    key={getRowKey ? getRowKey(row, i) : i}
                    className="border-b border-[var(--clay-border)] last:border-0 hover:bg-[var(--clay-surface-soft)]"
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={clsx(
                          'px-3 py-2.5 align-middle text-[var(--clay-text)]',
                          c.align === 'right' && 'text-right',
                          c.align === 'center' && 'text-center',
                        )}
                      >
                        {c.render ? c.render(row) : String(rawValue(row, c))}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-[var(--clay-muted)]">
          {filtered.length} mục{filtered.length !== rows.length ? ` / ${rows.length}` : ''}
        </p>
        <Pagination page={safePage} pageCount={pageCount} onPage={setPage} />
      </div>
    </div>
  );
}

export default DataTable;
