// Đợt 11 (spec 011) — FR-007. Accordion clay trên @radix-ui/react-accordion (đã cài).
// a11y do Radix lo; style clay (radius/border/focus-visible, target ≥44px, no shadow).
import type { ReactNode } from 'react';
import * as RA from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';

export interface AccordionItem {
  key: string;
  trigger: ReactNode;
  content: ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  type?: 'single' | 'multiple';
  defaultValue?: string | string[];
  className?: string;
}

export function Accordion({
  items,
  type = 'single',
  defaultValue,
  className,
}: AccordionProps) {
  const common = {
    className: clsx('space-y-3', className),
  };
  const body = items.map((it) => (
    <RA.Item
      key={it.key}
      value={it.key}
      className="overflow-hidden rounded-[14px] border border-[var(--clay-border)] bg-[var(--clay-surface)]"
    >
      <RA.Header>
        <RA.Trigger
          className={clsx(
            'group flex min-h-[48px] w-full items-center justify-between gap-3 px-4 py-3 text-left',
            'text-[15px] font-semibold text-[var(--clay-text)]',
            'hover:bg-[var(--clay-surface-soft)]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--clay-primary-focus)]',
          )}
        >
          {it.trigger}
          <ChevronDown
            className="h-4 w-4 shrink-0 text-[var(--clay-muted)] transition-transform duration-200 group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </RA.Trigger>
      </RA.Header>
      <RA.Content className="border-t border-[var(--clay-border)] px-4 py-3 text-sm leading-relaxed text-[var(--clay-muted)]">
        {it.content}
      </RA.Content>
    </RA.Item>
  ));

  return type === 'multiple' ? (
    <RA.Root
      type="multiple"
      defaultValue={Array.isArray(defaultValue) ? defaultValue : undefined}
      {...common}
    >
      {body}
    </RA.Root>
  ) : (
    <RA.Root
      type="single"
      collapsible
      defaultValue={typeof defaultValue === 'string' ? defaultValue : undefined}
      {...common}
    >
      {body}
    </RA.Root>
  );
}

export default Accordion;
