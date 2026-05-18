# Feature Specification: Đợt 2 — Remediation Bảo Mật Cao (High)

**Feature Branch**: `002-security-remediation-high`
**Created**: 2026-05-18
**Status**: Draft
**Input**: `docs/audit/AUDIT_2026-05-18.md` — S6, S7, S8, S9, S10, S13
**Constitution**: Principle I (Security), II (Auditability), IV (surgical)

## Problem

Sau khi đóng 5 Critical (Đợt 1), còn 6 lỗ hổng High/Med cho phép: spam/brute-force OTP qua endpoint chưa throttle (S6), mạo định danh khi mã SV trống (S7), stored XSS (S8), election finalize không kiểm turnout (S9), CORS lộ origin cũ + AllowCredentials (S10), và chiếm wallet-slot của cử tri khác (S13).

## Goal

Đóng S6,S7,S8,S9,S10,S13 sao cho: endpoint nhạy cảm có rate-limit tầng middleware; định danh cử tri ràng buộc đủ mạnh; HTML người dùng được sanitize; election có cờ/ngưỡng turnout tường minh; CORS theo cấu hình; invite gắn đúng account. Đo: 0 finding trong nhóm này còn mở khi re-audit.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Endpoint nhạy cảm có rate-limit (Priority: P1)

Là hệ thống, tôi cần `voter-invites/*` (send-otp, verify-otp, bind) bị giới hạn tần suất để không bị spam/brute-force ngay cả trước lockout per-invite.

**Why this priority**: S6 — bổ trợ lockout S2 ở tầng IP/route; chặn spam gửi OTP.

**Independent Test**: gọi dồn `send-otp`/`verify-otp` vượt ngưỡng → HTTP 429; dưới ngưỡng → bình thường.

**Acceptance Scenarios**:
1. **Given** N request/phút vượt giới hạn tới `voter-invites/*`, **When** request tiếp theo, **Then** trả 429 Too Many Requests.
2. **Given** lưu lượng bình thường, **When** dùng luồng OTP hợp lệ, **Then** không bị chặn.

### User Story 2 - Định danh cử tri đủ mạnh (Priority: P1)

Là hệ thống, tôi không được coi mã sinh viên trống là “khớp”.

**Why this priority**: S7 — biết email roster là xin được OTP nếu mã SV trống.

**Independent Test**: roster có mã SV → yêu cầu thiếu/sai mã bị từ chối; chỉ khớp khi mã trùng chính xác.

**Acceptance Scenarios**:
1. **Given** roster lưu mã SV, **When** OTP request không kèm mã hoặc sai mã, **Then** từ chối.
2. **Given** roster không lưu mã SV, **When** request, **Then** vẫn yêu cầu định danh email hợp lệ (không nới lỏng thêm).

### User Story 3 - Không Stored XSS (Priority: P1)

Là người dùng, nội dung HTML (điều lệ…) phải được sanitize trước khi render.

**Why this priority**: S8 — `dangerouslySetInnerHTML` không sanitizer.

**Independent Test**: nội dung chứa `<script>`/`onerror` → bị loại sau sanitize; render an toàn ở trang active.

**Acceptance Scenarios**:
1. **Given** dữ liệu HTML có payload XSS, **When** render trang active, **Then** payload bị loại, không thực thi.

### User Story 4 - Election có ngưỡng/cờ turnout (Priority: P2)

Là ban tổ chức, tôi cần biết election có đạt số phiếu reveal tối thiểu hay không.

**Why this priority**: S9 — finalize hiện không phản ánh turnout; quyết định “chặn hay chỉ gắn cờ” là quyết định nghiệp vụ.

**Independent Test**: deploy election với `minReveals`>0; finalize khi reveal < ngưỡng → trạng thái phản ánh low-turnout rõ ràng (theo quyết định team).

**Acceptance Scenarios**:
1. **Given** `minReveals = k`, **When** finalize với reveal < k, **Then** `lowTurnout`/tương đương = true (giá trị mặc định 0 ⇒ hành vi cũ, tương thích ngược).

### User Story 5 - CORS theo cấu hình (Priority: P2)

Là vận hành, allowed origins phải đến từ config/env, không hardcode origin cũ.

**Independent Test**: đổi env origins → CORS thay đổi tương ứng; không còn origin azurewebsites cũ trong source.

**Acceptance Scenarios**:
1. **Given** `Cors:AllowedOrigins` cấu hình, **When** request cross-origin, **Then** chỉ origin trong cấu hình được phép (kèm credentials).

### User Story 6 - Invite gắn đúng account (Priority: P2)

Là cử tri, chỉ tôi (account đã xác thực OTP) mới bind được ví vào slot của mình.

**Why this priority**: S13 — user đăng nhập bất kỳ có token là claim được slot.

**Independent Test**: account A xác thực OTP invite X; account B có token X gọi bind → bị từ chối.

**Acceptance Scenarios**:
1. **Given** invite đã OTP-verified bởi account A, **When** account B bind ví bằng cùng token, **Then** từ chối.

### Edge Cases

- Rate-limit không được chặn người dùng hợp lệ trong giới hạn bình thường.
- S9 default `minReveals=0` phải giữ nguyên hành vi election cũ (tương thích ngược).
- Sanitize không phá HTML hợp lệ (định dạng cơ bản giữ nguyên).

## Requirements *(mandatory)*

- **FR-001 (S6)**: MUST áp rate-limit (ASP.NET RateLimiter) cho route `voter-invites/*` (send-otp, verify-otp, bind), trả 429 khi vượt.
- **FR-002 (S7)**: MUST từ chối khi roster có mã SV nhưng request thiếu/sai; KHÔNG coi trống là khớp.
- **FR-003 (S8)**: MUST sanitize mọi HTML người dùng trước `dangerouslySetInnerHTML` ở trang active (thêm `dompurify`).
- **FR-004 (S9)**: `ElectionV1` MUST có `minReveals` immutable + cờ turnout tường minh; default 0 ⇒ tương thích ngược; ripple ABI (backend inline, frontend inline), factory, script deploy.
- **FR-005 (S10)**: CORS allowed origins MUST từ config/env; bỏ origin hardcode cũ.
- **FR-006 (S13)**: bind-wallet MUST chỉ cho account đã OTP-verify invite đó (gắn invite ↔ account ở bước OTP).

### Key Entities

- **Invite**: thêm liên kết account xác thực (ClaimedByUserId set ở OTP, kiểm ở bind).
- **ElectionV1**: thêm `minReveals` (immutable), view/flag turnout.

## Success Criteria *(mandatory)*

- **SC-001**: re-audit S6,S7,S8,S9,S10,S13 → 0 còn mở.
- **SC-002**: contracts compile + test pass (gồm test mới cho minReveals/turnout).
- **SC-003**: `dotnet build` 0 error; rate-limit & authz test thủ công đạt.
- **SC-004**: scoped typecheck file FE đụng → 0 lỗi do thay đổi.
- **SC-005**: không secret mới; không tăng bề mặt legacy.

## Assumptions

- ASP.NET rate limiting middleware (.NET 9 built-in) đủ, không thêm lib ngoài.
- `dompurify` là lib chuẩn cho sanitize FE (thêm dependency có chủ đích).
- S9: quyết định “chặn finalize hay chỉ gắn cờ low-turnout” chốt cùng team trước khi code (governance — Constitution).
- Đổi constructor `ElectionV1` chấp nhận ripple ABI/script; election đã deploy không bị ảnh hưởng (immutable trên chain), chỉ deploy mới dùng tham số mới.

## Out of Scope

- S11,S12,S14–S20 (Đợt 3–5).
- Xóa legacy tree (Đợt 3) — S8 chỉ sanitize usage active; usage trong page legacy sẽ biến mất khi Đợt 3 xóa.
- Anonymous voting / Semaphore (V2).
