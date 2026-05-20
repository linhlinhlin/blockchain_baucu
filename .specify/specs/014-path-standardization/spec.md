# Feature Specification: Đợt 14 — Chuẩn hoá đường dẫn (canonical English + backward-compat)

**Branch**: `014-path-standardization` · 2026-05-20 · **Status**: Draft

## Bối cảnh
Đường dẫn hiện tại trộn lẫn: VN không dấu (`/tao-phien-bau-cu`, `/quan-ly-smart-contract`, `/chinh-sach-bao-mat`, `/lien-he`, `/tim-tai-khoan/.../tuy-chon/gui-otp/dat-lai-mat-khau`) + EN (`/user-elections`, `/role-management`, `/settings`, `/admin`) + thuật ngữ cũ (`tao-phien-bau-cu` thay vì `bau-cu`/`elections`). Không nhất quán = không chuyên nghiệp.

## User Story (P1)
Người dùng/dev/integration thấy mọi đường dẫn theo **một quy ước** (English kebab-case, REST-ish, shallow). Bookmark/share link cũ vẫn vào đúng trang (auto-redirect).

**Acceptance**:
1. Truy cập `/tao-phien-bau-cu` → tự redirect `/app/elections/new` 200.
2. Mọi `Link`/`navigate` trong app dùng path canonical mới.
3. Sidebar/header/breadcrumb hiển thị đúng tiêu đề khi ở path mới.
4. Không hồi quy chức năng (login, OTP, vote on-chain, contact form, …).

## FR
- **FR-001**: Định nghĩa `frontend/src/routes/paths.ts` (object const) là **nguồn sự thật** mọi đường dẫn.
- **FR-002**: AppRoutes: thêm route canonical EN; giữ TOÀN BỘ path VN cũ dưới dạng `<Navigate to=... replace/>` (backward compat).
- **FR-003**: routeMeta + Sidebar + mọi `Link to=`/`navigate(...)` ở 5 trang app + trang công khai = dùng path mới.
- **FR-004**: Quality gate: `npm run build` PASS; container frontend rebuild + serve path mới + redirect cũ → 200.
- **FR-005**: KHÔNG đụng route động có ID (`/elections/:id/session/:idPhien/...`) ngoài việc giữ redirect chuẩn.
- **FR-006**: Tuân thủ Hiến chương I/III/IV: không đổi handler bảo mật, không xoá route, surgical, mọi thay đổi qua spec này.

## Bản đồ canonical (Stripe/Vercel-style)
| VN/cũ | Canonical mới |
|---|---|
| `/tim-tai-khoan` | `/forgot-password` |
| `/tim-tai-khoan/:u/:c/tuy-chon` | `/forgot-password/account/:u/:c/options` |
| `/tim-tai-khoan/:u/:c/tuy-chon/gui-otp` | `/forgot-password/account/:u/:c/send-otp` |
| `/tim-tai-khoan/:u/:c/tuy-chon/gui-otp/dat-lai-mat-khau` | `/forgot-password/account/:u/:c/reset` |
| `/chua-xac-thuc` | `/unauthorized` |
| `/chinh-sach-bao-mat` | `/privacy` |
| `/dieu-khoan-su-dung` | `/terms` |
| `/lien-he` | `/contact` |
| `/thank-you` | `/thanks` |
| `/app/quan-ly-smart-contract` | `/app/dashboard` |
| `/app/user-elections` | `/app/elections` |
| `/app/tao-phien-bau-cu` | `/app/elections/new` |
| `/app/upcoming-elections` | `/app/notifications` |
| `/app/quan-ly-file` | `/app/files` |
| `/app/quet-ma-qr` | `/app/scan` |
| `/app/account-info` | `/app/account` |
| `/app/role-management` | `/app/admin/roles` |
| `/app/role-assignment` | `/app/admin/permissions` |

Giữ nguyên: `/`, `/login`, `/register`, `/elections`, `/faq`, `/blockchain-setup`, `/verify-voter`, `/app`, `/app/admin`, `/app/settings`.

## SC
- SC-001: 100% `Link to=`/`navigate(...)`/`router redirect` ở source dùng path canonical mới (grep).
- SC-002: Truy cập mỗi path VN cũ → redirect path mới HTTP 200 (test runtime).
- SC-003: `npm run build` PASS; container live phục vụ path mới.
- SC-004: 0 hồi quy: 5 luồng (login, register, OTP recovery, contact, vote on-chain) chạy bình thường.

## Out of Scope
- Đổi route động `/:id` patterns.
- Đổi BE/API endpoint paths (chỉ FE routing).
- Refactor lớn (đổi cấu trúc nested của route động).
