// Đợt 10 (spec 010) — FR-007/011. Stepper clay: trạng thái done/current/todo/error.
import { Check } from 'lucide-react';
import clsx from 'clsx';

export type StepStatus = 'done' | 'current' | 'todo' | 'error';

export interface Step {
  key: string;
  title: string;
  status: StepStatus;
}

export interface StepperProps {
  steps: Step[];
  onStepChange?: (key: string) => void;
  className?: string;
}

const MARKER: Record<StepStatus, string> = {
  done: 'bg-[var(--state-success-soft)] text-[var(--state-success)] border-[var(--state-success)]',
  current: 'bg-[var(--clay-primary-light)] text-[var(--clay-primary)] border-[var(--clay-primary)]',
  todo: 'bg-[var(--clay-surface-soft)] text-[var(--clay-muted-soft)] border-[var(--clay-border)]',
  error: 'bg-[var(--state-danger-soft)] text-[var(--state-danger)] border-[var(--state-danger)]',
};

export function Stepper({ steps, onStepChange, className }: StepperProps) {
  return (
    <ol className={clsx('flex flex-wrap items-center gap-1', className)} aria-label="Tiến độ">
      {steps.map((s, i) => {
        const interactive = !!onStepChange;
        return (
          <li key={s.key} className="flex items-center">
            <button
              type="button"
              disabled={!interactive}
              onClick={() => onStepChange?.(s.key)}
              aria-current={s.status === 'current' ? 'step' : undefined}
              className={clsx(
                'group flex min-h-[44px] items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-left',
                interactive &&
                  'hover:bg-[var(--clay-surface-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--clay-primary-focus)]',
                !interactive && 'cursor-default',
              )}
            >
              <span
                className={clsx(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-bold tabular-nums',
                  MARKER[s.status],
                )}
              >
                {s.status === 'done' ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
              </span>
              <span
                className={clsx(
                  'whitespace-nowrap text-[13px] font-semibold',
                  s.status === 'current'
                    ? 'text-[var(--clay-text)]'
                    : s.status === 'error'
                      ? 'text-[var(--state-danger)]'
                      : 'text-[var(--clay-muted)]',
                )}
              >
                {s.title}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className="mx-1 h-px w-5 shrink-0 bg-[var(--clay-border)] sm:w-8"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default Stepper;
