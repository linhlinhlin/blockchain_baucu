# Contract — Component reuse & Accordion (Đợt 11)

Đợt 11 KHÔNG định nghĩa API mới; tiêu thụ hợp đồng `010-ux-professionalization/contracts/component-api.md`.
Chỉ thêm 1 hợp đồng mới nếu cần:

## Accordion (mới, nếu FAQ cần) — `components/ui/clay/Accordion.tsx`

```ts
type AccordionItem = { key: string; trigger: ReactNode; content: ReactNode };
type AccordionProps = {
  items: AccordionItem[];
  type?: 'single' | 'multiple';   // mặc định 'single' collapsible
  defaultValue?: string | string[];
};
// Trên @radix-ui/react-accordion (đã cài). a11y do Radix lo; style clay
// (radius 14px, border clay, focus-visible, target ≥44px, no decorative shadow).
// Export qua components/ui/clay/index.ts (barrel).
```

## Ràng buộc tái dùng
- Form công khai dùng `Field` (label/hint/error/aria) + `fieldControlClass`, `Button` (variant/loading).
- Thông báo: chỉ `notify` (FR-009).
- Không component nào tự ý `dangerouslySetInnerHTML` (giữ sanitize); legal pages giữ cách render hiện có (không đổi).
- Không nhận `className` phá hệ token; tone màu chỉ qua `StatusBadge`/state tokens.
