// Đợt 10 (spec 010) — FR-004/009. Tabs trên @radix-ui/react-tabs.
// keepMounted: panel ẩn KHÔNG unmount (giữ state form/handler trang) — FR-012.
import type { ReactNode } from 'react';
import * as RTabs from '@radix-ui/react-tabs';
import clsx from 'clsx';

export interface TabItem {
  key: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (key: string) => void;
  keepMounted?: boolean;
  className?: string;
}

export function Tabs({ items, value, onValueChange, keepMounted = true, className }: TabsProps) {
  return (
    <RTabs.Root value={value} onValueChange={onValueChange} className={className}>
      <RTabs.List
        className="flex flex-wrap gap-1 border-b border-[var(--clay-border)]"
        aria-label="Tabs"
      >
        {items.map((it) => (
          <RTabs.Trigger
            key={it.key}
            value={it.key}
            disabled={it.disabled}
            className={clsx(
              'min-h-[44px] -mb-px border-b-2 px-4 text-sm font-semibold transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--clay-primary-focus)]',
              'border-transparent text-[var(--clay-muted)] hover:text-[var(--clay-text)]',
              'data-[state=active]:border-[var(--clay-primary)] data-[state=active]:text-[var(--clay-primary)]',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {it.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {items.map((it) => (
        <RTabs.Content
          key={it.key}
          value={it.key}
          forceMount={keepMounted ? true : undefined}
          className="pt-5 focus-visible:outline-none data-[state=inactive]:hidden"
        >
          {it.content}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  );
}

export default Tabs;
