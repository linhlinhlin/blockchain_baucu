# Contract — Shared Component API (`components/ui/clay/`)

Hợp đồng API tối thiểu cho lớp dùng chung. Mục tiêu: ổn định, a11y-by-default, style bằng token clay (không nhận `className` tuỳ tiện phá hệ). Tất cả export qua `components/ui/clay/index.ts`.

## Nguyên tắc chung
- Props điều khiển bằng *variant* enum, không truyền hex/spacing thô.
- Mọi control tương tác: `aria-*` đúng, `:focus-visible` rõ, target ≥44px, hỗ trợ bàn phím.
- Không shadow trang trí; radius: card 18px, pill cho CTA/badge.
- Trạng thái màu chỉ qua `tone` ngữ nghĩa.

## API

```ts
// Button
type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';      // lg ⇒ ≥44px
  loading?: boolean;               // hiện spinner, disable, giữ width
  iconLeft?: ReactNode; iconRight?: ReactNode;
} & ButtonHTMLAttributes;

// Field — bọc control + label + hint + error (a11y: htmlFor/aria-describedby/aria-invalid)
type FieldProps = {
  label: string; hint?: string; error?: string; required?: boolean;
  children: ReactElement;          // input/select/textarea
};

// Panel / SectionCard
type PanelProps = { as?: ElementType; padded?: boolean };
type SectionCardProps = { title: string; description?: string; actions?: ReactNode };

// StatusBadge
type StatusBadgeProps = { tone: 'success'|'warning'|'danger'|'info'|'neutral'; children: ReactNode };

// Tabs (Radix) — không unmount panel khi đổi tab (giữ state form)
type TabsProps = { items: {key:string; label:ReactNode; content:ReactNode}[]; value:string; onValueChange:(k:string)=>void; keepMounted?: boolean };

// Stepper + Wizard — Wizard giữ tất cả step mounted (bảo toàn state), chỉ ẩn/hiện
type Step = { key:string; title:string; status:'done'|'current'|'todo'|'error' };
type WizardProps = {
  steps: Step[]; current: string; onStepChange:(k:string)=>void;
  children: ReactNode;             // các <Wizard.Panel key=...>; tất cả mounted
  rail?: ReactNode;                // SummaryRail sticky
};

// DataTable — sort/filter/paginate CLIENT-SIDE, chiều cao có trần (ScrollArea)
type Column<T> = { key:string; header:string; sortable?:boolean; render?:(row:T)=>ReactNode; filter?:'text'|'select' };
type DataTableProps<T> = {
  rows: T[]; columns: Column<T>[];
  pageSize?: number;               // mặc định 10
  maxBodyHeight?: number|string;   // FR-008: không phình trang
  empty?: ReactNode;               // EmptyState khi 0 dòng/0 khớp
  initialSort?: { key:string; dir:'asc'|'desc' };
};

// Pagination
type PaginationProps = { page:number; pageCount:number; onPage:(p:number)=>void };

// DropdownButton (Radix dropdown-menu)
type DropdownButtonProps = {
  label: ReactNode; variant?: ButtonProps['variant'];
  items: ({ kind:'item'; label:ReactNode; onSelect:()=>void; tone?:'danger' } | { kind:'separator' })[];
};

// Breadcrumb / PageHeader
type Crumb = { label:string; to?:string };
type BreadcrumbProps = { trail: Crumb[] };
type PageHeaderProps = { title:string; description?:string; breadcrumb:Crumb[]; actions?:ReactNode };

// SummaryRail — aside dính (sticky top), tự bỏ dính < lg (xuống dưới)
type SummaryRailProps = { children: ReactNode };

// EmptyState
type EmptyStateProps = { icon?:ReactNode; title:string; description?:string; action?:ReactNode };

// Loader / Skeleton
type LoaderProps = { label?:string; size?:'sm'|'md' };
type SkeletonProps = { lines?:number; className?:string };

// notify (helper, KHÔNG render provider — provider đã ở App root)
notify.success(msg:string): void
notify.error(msg:string): void
notify.info(msg:string): void
notify.promise<T>(p:Promise<T>, m:{loading:string;success:string;error:string}): Promise<T>
// Bọc react-hot-toast; vị trí top-right, thời lượng & style nhất quán. Cấm gọi toast lib khác ở active path.
```

## Bất biến (không phá vỡ)
- `Wizard`/`Tabs(keepMounted)`: panel **không unmount** → state form/handler trang được bảo toàn (FR-012).
- `DataTable` xử lý client-side, không gọi API/đổi hợp đồng dữ liệu (D4).
- `notify` chỉ proxy react-hot-toast; không thêm provider mới (tránh đa hệ toast).
- Không component nào tự ý `dangerouslySetInnerHTML` (giữ S8/sanitize).
