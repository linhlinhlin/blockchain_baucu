// Đợt 10 (spec 010) — FR-004. DropdownButton trên @radix-ui/react-dropdown-menu.
// Bàn phím + a11y do Radix lo; style clay.
import type { ReactNode } from 'react';
import * as DM from '@radix-ui/react-dropdown-menu';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { Button, type ButtonVariant } from './Button';

export type DropdownEntry =
  | { kind: 'item'; label: ReactNode; onSelect: () => void; tone?: 'danger'; disabled?: boolean }
  | { kind: 'separator' };

export interface DropdownButtonProps {
  label: ReactNode;
  items: DropdownEntry[];
  variant?: ButtonVariant;
  align?: 'start' | 'end';
  className?: string;
}

export function DropdownButton({
  label,
  items,
  variant = 'secondary',
  align = 'end',
  className,
}: DropdownButtonProps) {
  return (
    <DM.Root>
      <DM.Trigger asChild>
        <Button variant={variant} iconRight={<ChevronDown className="h-4 w-4" />} className={className}>
          {label}
        </Button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content
          align={align}
          sideOffset={6}
          className="z-50 min-w-[200px] rounded-[14px] border border-[var(--clay-border)] bg-[var(--clay-surface)] p-1.5"
        >
          {items.map((it, i) =>
            it.kind === 'separator' ? (
              <DM.Separator key={`s${i}`} className="my-1 h-px bg-[var(--clay-border)]" />
            ) : (
              <DM.Item
                key={`i${i}`}
                disabled={it.disabled}
                onSelect={it.onSelect}
                className={clsx(
                  'flex min-h-[40px] cursor-pointer items-center rounded-[10px] px-3 text-sm outline-none',
                  'data-[highlighted]:bg-[var(--clay-surface-soft)] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
                  it.tone === 'danger'
                    ? 'text-[var(--state-danger)]'
                    : 'text-[var(--clay-text)]',
                )}
              >
                {it.label}
              </DM.Item>
            ),
          )}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export default DropdownButton;
