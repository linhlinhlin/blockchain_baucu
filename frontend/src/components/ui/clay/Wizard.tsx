// Đợt 10 (spec 010) — FR-007. Wizard clay: MỌI panel luôn mounted (chỉ ẩn/hiện)
// ⇒ bảo toàn state form/handler trang khi chuyển bước (FR-012). Rail sticky tuỳ chọn.
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Stepper, type Step } from './Stepper';

export interface WizardPanelProps {
  value: string;
  children: ReactNode;
}

/** Panel của Wizard — luôn render, ẩn bằng [hidden] khi không phải bước hiện tại. */
export function WizardPanel({ children }: WizardPanelProps) {
  return <>{children}</>;
}

export interface WizardProps {
  steps: Step[];
  current: string;
  onStepChange: (key: string) => void;
  /** các <WizardPanel value=...> — tất cả mounted */
  children: ReactNode;
  /** SummaryRail sticky (cột phải ≥lg) */
  rail?: ReactNode;
  className?: string;
}

export function Wizard({ steps, current, onStepChange, children, rail, className }: WizardProps) {
  const panels = Children.toArray(children).filter(
    (c): c is ReactElement<WizardPanelProps> =>
      isValidElement(c) && (c.props as WizardPanelProps).value !== undefined,
  );

  return (
    <div className={className}>
      <div className="mb-4 overflow-x-auto">
        <Stepper steps={steps} onStepChange={onStepChange} />
      </div>
      <div className="grid gap-6 min-[1200px]:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {panels.map((p) => {
            const active = p.props.value === current;
            return (
              <div
                key={p.props.value}
                role="tabpanel"
                hidden={!active}
                aria-hidden={!active}
              >
                {p}
              </div>
            );
          })}
        </div>
        {rail && (
          <aside className="min-[1200px]:sticky min-[1200px]:top-6 min-[1200px]:self-start">{rail}</aside>
        )}
      </div>
    </div>
  );
}

Wizard.Panel = WizardPanel;

export default Wizard;
