# REMEDIATION Đợt 8 — App Shell Redesign theo ảnh

- **Spec**: `.specify/specs/008-dashboard-redesign/` · **Branch**: `008-dashboard-redesign` (stack 007) · **Ngày**: 2026-05-19

## Đã làm (surgical, an toàn — chỉ shell, không đụng logic bầu cử)

- `src/components/Sidebar.tsx` **viết lại** theo ảnh: rail phẳng trắng cố định `--sidebar-w` 264px; logo vuông bo 12px + "HoLiHu/BlockVote"; ô search bo 10px; nhóm **Quản lý / Công cụ / Quản trị** (nhãn uppercase mảnh); item active nền `--clay-primary-light` + chữ/icon xanh, hover `surface-soft`; `UserMenu` trong card viền ở đáy; icon dùng lucide đồng bộ; mobile top-bar 60px + drawer. **Route giữ nguyên** (reuse path cũ) ⇒ điều hướng không gãy.
- `src/AppAfterLogin.tsx`: bỏ logic collapse 296/104, dùng `md:ml-[var(--sidebar-w)]` + `mt-[60px]` mobile.
- `src/index.css`: thêm `--sidebar-w: 264px`.

## Verify

- scoped tsc Sidebar+AppAfterLogin → **0 lỗi do thay đổi** (EXIT≠0 chỉ là nợ legacy có sẵn, như mọi đợt).
- `docker cp` + Vite **HMR áp sạch** (`hmr update Sidebar.tsx/AppAfterLogin.tsx/index.css`), FE **HTTP 200**, log không lỗi.
- Props/route/UserMenu/mobile bảo toàn ⇒ không ảnh hưởng commit/reveal/finalize.

## Follow-up (Đợt 9 — ghi nhận trung thực)

Trang dashboard trong ảnh (topbar chips ElectionV1·Sepolia / Ví / ETH / "Tạo ballot mới", toolbar lọc, **table ballot** trạng-thái-chấm-màu, pagination, card "Trạng thái kết nối") nằm trong `QuanLySmartContractPage` (1028 dòng, chứa commit/reveal/finalize). Dựng lại bảng này phải cẩn thận để **không phá luồng bầu cử trọng yếu** (Constitution I) ⇒ tách Đợt 9 làm có kiểm thử, không rewrite mù trong 1 phát.

> Hard-refresh (Ctrl+Shift+R) để thấy shell mới: rail phẳng, nhóm nhãn, active xanh nhạt, user card đáy — đúng khung ảnh tham chiếu.
