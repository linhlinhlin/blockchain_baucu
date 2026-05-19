# Phase 0 — Research: Đợt 12 (bản đồ token cố định)

0 NEEDS CLARIFICATION. Quyết định: replace_all chuỗi màu theo bản đồ ngữ nghĩa
(hex-nền-tối → surface sáng; hex-chữ → chữ tối; off-system Tailwind → clay/state).
framer-motion/ToC/scroll KHÔNG chứa hex → replace_all an toàn, 0 chạm logic.

## Bản đồ hex (cả 2 file)
| Hex (dark bespoke) | → token clay (light) | Vai trò |
|---|---|---|
| `#0A1416` | `var(--clay-bg)` | nền trang tối nhất |
| `#1A2327` | `var(--clay-surface)` | panel |
| `#1E272C` | `var(--clay-surface)` | panel |
| `#263238` | `var(--clay-surface-soft)` | panel phụ |
| `#37474F` | `var(--clay-text)` | tiêu đề/chữ đậm |
| `#455A64` | `var(--clay-muted)` | body text |
| `#B0BEC5` | `var(--clay-muted-soft)` | chữ phụ |
| `#6A1B9A` `#01579B` | `var(--clay-primary-dark)` | accent đậm (DieuKhoan còn sót) |
| `#00796B` | `var(--clay-primary)` | accent teal |

## Bản đồ Tailwind off-system
- `bg-gray-50/100` → `bg-[var(--clay-surface-soft)]` · `bg-gray-300` → `bg-[var(--clay-border)]`
- `hover:bg-gray-100/200` → `hover:bg-[var(--clay-surface-soft)]`
- `border-gray-200/700/800` → `border-[var(--clay-border)]`
- `text-gray-600/700` → `text-[var(--clay-muted)]` · `text-gray-800/900` → `text-[var(--clay-text)]`
- `bg-blue-50/100` → `bg-[var(--clay-primary-light)]` · `bg-blue-600` → `bg-[var(--clay-primary)]`
- `hover:bg-blue-50` → `hover:bg-[var(--clay-primary-light)]` · `hover:bg-blue-700` → `hover:bg-[var(--clay-primary-dark)]`
- `text-blue-600/700` → `text-[var(--clay-primary)]` · `border-blue-100/200` → `border-[var(--clay-border)]`
- `bg-green-100` → `bg-[var(--state-success-soft)]` · `text-green-600` → `text-[var(--state-success)]`
- `bg-amber-50/100` → `bg-[var(--state-warning-soft)]` · `text-amber-400/500/600` → `text-[var(--state-warning)]` · `border-amber-500` → `border-[var(--state-warning)]`
- `bg-purple-100` → `bg-[var(--clay-primary-light)]` · `text-purple-600` → `text-[var(--clay-primary)]` · `hover:text-purple-700` → `hover:text-[var(--clay-primary-dark)]`

## Để lại (vô hại)
Gradient stop `from-*/to-*/via-*`: guardrail Đợt 7 (`[class*='bg-gradient-to']`)
đã trung hoà gradient → stop-color không render; map ~20 cái = noise, bỏ qua.

## Bất biến
KHÔNG sửa: `useScroll/useTransform/motion.*`, ToC sticky, back-to-top,
`scrollIntoView/scrollTo`, nội dung, cấu trúc DOM. POST: grep refs framer-motion
giữ nguyên số lượng; diff chỉ chứa thay đổi chuỗi class màu.
