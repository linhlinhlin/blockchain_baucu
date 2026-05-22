// Đợt 10 (spec 010) — FR-004/FR-013. Field: label + hint + error, a11y wired.
import { cloneElement, useId, type ReactElement, type ReactNode } from 'react';
import clsx from 'clsx';

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  /** control duy nhất: input/select/textarea */
  children: ReactElement<{
    id?: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean | 'true' | 'false';
  }>;
}

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;

  const control = cloneElement(children, {
    id: children.props.id ?? id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
  });

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={children.props.id ?? id}
        className="text-xs font-semibold uppercase tracking-[-0.01em] text-[var(--clay-muted)]"
      >
        {label}
        {required && <span className="ml-1 text-[var(--state-danger)]">*</span>}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-[12px] leading-snug text-[var(--clay-muted-soft)]">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-[12px] leading-snug text-[var(--state-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

/** Input/Textarea clay dùng kèm Field (đồng nhất .clay-input). */
export const fieldControlClass =
  'w-full rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-[var(--clay-surface)] px-4 py-3 text-sm text-[var(--clay-text)] placeholder:text-[var(--clay-muted-soft)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--clay-primary-focus)] disabled:opacity-55';

export default Field;
