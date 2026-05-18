# Feature Specification: Đợt 1 — Remediation Bảo Mật Khẩn (Critical)

**Feature Branch**: `001-security-remediation-critical`
**Created**: 2026-05-18
**Status**: Draft
**Input**: `docs/audit/AUDIT_2026-05-18.md` — các phát hiện Critical S1–S5
**Constitution**: tuân Principle I (Security & Integrity First — blocker), II (Auditability)

## Problem

Audit 2026-05-18 phát hiện 5 lỗ hổng **Critical** khiến hệ thống không an toàn để dùng thật: private key bị commit trong repo, OTP plaintext bị lộ, JWT secret hardcode forge được, và vote-secret ở frontend bị đánh cắp/forge. Mỗi lỗi đều đủ để phá tính toàn vẹn lá phiếu hoặc chiếm phiên.

## Goal

Đóng toàn bộ 5 lỗ hổng Critical sao cho: (1) không còn secret nào trong git và mọi key đã lộ được coi như compromise + rotate; (2) OTP không lộ và không brute-force trivially; (3) không thể forge JWT bằng secret tĩnh; (4) vote-secret không thể bị đánh cắp/forge qua localStorage/XSS. Đo bằng: 0 finding Critical còn mở khi re-audit phần liên quan.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Không còn secret trong repo (Priority: P1) 🎯

Là maintainer, tôi cần repo không chứa private key/secret nào để khoá bị lộ không thể bị lạm dụng và clone mới an toàn.

**Why this priority**: S1 — key 64-hex đã nằm trong git, ai clone cũng có. Phải xử lý trước tiên, độc lập với phần khác.

**Independent Test**: Quét toàn repo (committed files) không còn chuỗi private-key 64-hex; legacy test pages chứa key đã bị xóa; tài liệu xác nhận key đã rotate/coi như lộ và không còn ETH.

**Acceptance Scenarios**:

1. **Given** repo hiện có key trong `frontend/src/test/...`, **When** áp dụng remediation, **Then** không file committed nào còn private-key pattern và build active path vẫn xanh.
2. **Given** một key bị lộ, **When** rà soát, **Then** có ghi chú remediation xác nhận key được rotate / xác nhận không funded.

### User Story 2 - OTP an toàn (Priority: P1)

Là cử tri/admin, tôi cần OTP không bị lộ và không bị dò để định danh không bị mạo.

**Why this priority**: S2 — OTP plaintext trong DB và echo về client; cộng nguy cơ brute-force.

**Independent Test**: OTP lưu dạng hash có salt; không endpoint nào trả mã OTP trừ khi cờ dev tường minh bật; verify-otp có giới hạn số lần thử + lockout; test API chứng minh OTP không xuất hiện trong response ở môi trường không-dev.

**Acceptance Scenarios**:

1. **Given** môi trường không bật `DevelopmentAuthSettings:Enabled`, **When** gửi/verify OTP, **Then** response không bao giờ chứa mã OTP và DB chỉ lưu hash.
2. **Given** kẻ tấn công dò OTP, **When** vượt ngưỡng số lần thử, **Then** invite bị lockout/backoff và verify thất bại.

### User Story 3 - JWT không forge được (Priority: P1)

Là người dùng hệ thống, tôi cần token phiên không thể bị giả mạo.

**Why this priority**: S3 — secret fallback hardcode dùng chính ở path local/in-memory.

**Independent Test**: Khởi động không có `JwtSettings:Secret` ⇒ app từ chối chạy (hoặc sinh secret ngẫu nhiên per-process, không phải hằng số); không còn chuỗi `holihu-local-dev-jwt-secret-...` trong source/compose.

**Acceptance Scenarios**:

1. **Given** không cấu hình JWT secret, **When** app khởi động, **Then** app fail-fast với thông báo rõ (không dùng hằng số).
2. **Given** source và compose, **When** quét, **Then** không còn JWT secret literal nào.

### User Story 4 - Vote-secret không bị đánh cắp/forge (Priority: P1)

Là cử tri, tôi cần phần bí mật của phiếu (salt) an toàn để không ai forge reveal hay liên kết ví↔lựa chọn của tôi.

**Why this priority**: S4 + S5 — salt/commitment plaintext localStorage, không kiểm owner trước reveal.

**Independent Test**: Trước `revealVote`, app kiểm `storedVotePackage.voter === ví đang kết nối`; salt không còn lưu plaintext localStorage (chuyển memory/session-scoped hoặc mã hoá); có cảnh báo reveal cần cùng thiết bị.

**Acceptance Scenarios**:

1. **Given** vote package thuộc ví khác, **When** cử tri bấm Reveal, **Then** app từ chối và cảnh báo, không gọi `revealVote`.
2. **Given** một XSS đọc localStorage, **When** kiểm tra, **Then** không tìm thấy salt dạng plaintext khả dụng.

### Edge Cases

- Key bị lộ nhưng nằm trong nhánh/legacy đã orphan: vẫn phải xóa khỏi tip + ghi chú coi như compromise (history rewrite ngoài scope đợt này, ghi rõ).
- OTP migration: dữ liệu OTP cũ (nếu có) bị vô hiệu hoá, không cố giải mã ngược.
- Người dùng đổi thiết bị giữa commit và reveal: phải có thông báo rõ ràng mất khả năng reveal (đúng thiết kế commit-reveal hiện tại).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (S1)**: Hệ thống MUST không chứa private key/secret nào trong file committed; legacy test pages chứa key bị xóa khỏi active build.
- **FR-002 (S1)**: Mọi key từng commit MUST được tài liệu hoá là compromise + rotate hoặc xác nhận không funded.
- **FR-003 (S2)**: OTP MUST lưu dưới dạng hash có salt; so khớp bằng hash.
- **FR-004 (S2)**: Hệ thống MUST KHÔNG trả mã OTP cho client trừ khi cờ `DevelopmentAuthSettings:Enabled` tường minh bật.
- **FR-005 (S2)**: Endpoint OTP/verify MUST có đếm số lần thử + lockout/backoff per invite.
- **FR-006 (S3)**: Hệ thống MUST từ chối khởi động khi thiếu `JwtSettings:Secret` (hoặc sinh secret ngẫu nhiên per-process); MUST KHÔNG dùng hằng số fallback.
- **FR-007 (S3)**: Source và compose MUST KHÔNG chứa JWT secret literal.
- **FR-008 (S5)**: Frontend MUST validate vote package thuộc đúng ví đang kết nối trước khi `revealVote`.
- **FR-009 (S4)**: Frontend MUST KHÔNG lưu salt/commitment plaintext ở nơi XSS đọc được; có cảnh báo reveal cần cùng thiết bị.

### Key Entities

- **OtpRecord**: định danh invite, hash OTP + salt, thời hạn, số lần thử, trạng thái lockout.
- **VotePackage (client)**: electionAddress, voter (ví), candidateId, salt — lưu an toàn, gắn chủ sở hữu.
- **JwtConfig**: secret bắt buộc từ env/secret store.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0/5 finding Critical (S1–S5) còn mở khi re-audit phần liên quan.
- **SC-002**: Quét repo: 0 private-key 64-hex, 0 JWT secret literal trong file committed.
- **SC-003**: Bộ test API: OTP không xuất hiện trong bất kỳ response nào ở chế độ non-dev; verify-otp bị chặn sau N lần thử.
- **SC-004**: Build gate xanh sau remediation: contracts compile+test pass, `dotnet build` 0 error, frontend `tsc --noEmit` active path sạch.
- **SC-005**: Không phát sinh secret mới; không tăng bề mặt legacy (Constitution III).

## Assumptions

- Có quyền rotate key/secret và cấu hình env cho môi trường dev/staging.
- History rewrite (BFG/filter-repo) là quyết định riêng của team — đợt này chỉ xử lý ở tip + tài liệu hoá; nếu team yêu cầu purge history sẽ tách spec riêng.
- Active path ElectionV1 đã modern (theo audit) — remediation là vá + xóa legacy, không viết lại.
- Backend hiện `net9.0`, build được bằng SDK 9.0.2xx trên máy; không pin về .NET 8.

## Out of Scope (đợt này)

- Các finding High/Med/Low (S6–S20) — thuộc Đợt 2+ (spec riêng).
- Git history rewrite/purge.
- Migration PostgreSQL/MinIO, dọn dependency frontend toàn diện, healthcheck Docker.
- Thêm tính năng nghiệp vụ mới.
