// Đợt 10 (spec 010) — FR-004. Button clay: variant/size/loading/icon.
// active scale .95 (design.md), focus-visible rõ, lg ≥44px. KHÔNG shadow trang trí.
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--clay-primary)] text-white border border-[var(--clay-primary)] hover:bg-[var(--clay-primary-focus)] hover:border-[var(--clay-primary-focus)]',
  secondary:
    'bg-transparent text-[var(--clay-primary)] border border-[var(--clay-primary)] hover:bg-[var(--clay-primary-light)]',
  ghost:
    'bg-transparent text-[var(--clay-text)] border border-transparent hover:bg-[var(--clay-surface-soft)]',
  danger:
    'bg-[var(--state-danger)] text-white border border-[var(--state-danger)] hover:opacity-90',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-[34px] px-3 text-[13px] gap-1.5',
  md: 'min-h-[40px] px-4 text-sm gap-2',
  lg: 'min-h-[44px] px-5 text-[15px] gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, iconLeft, iconRight, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center rounded-[12px] font-normal leading-none transition-[transform,background-color,color,border-color] duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--clay-primary-focus)]',
        'active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-55',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-hidden="true"
        />
      )}
      {!loading && iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
});

export default Button;
