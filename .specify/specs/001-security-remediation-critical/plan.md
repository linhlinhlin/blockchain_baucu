# Plan: Đợt 1 — Remediation Bảo Mật Khẩn (Critical)

**Spec**: `./spec.md` · **Constitution**: Principle I (blocker), II, IV (surgical)

## Architecture / Vùng tác động

```
S1  frontend/src/test/**           → XÓA legacy chứa key + rotate
S2  WebApplication3 ElectionV1RosterService → hash OTP + bỏ echo + rate-limit
S3  WebApplication3 Program.cs + docker-compose.active.yml → JWT secret bắt buộc
S4  frontend QuanLySmartContractPage.tsx → bỏ plaintext salt localStorage
S5  frontend QuanLySmartContractPage.tsx → check voter==connected trước reveal
```

Mỗi user story (US1–US4) độc lập, sửa được & test được riêng. Không có dependency chéo bắt buộc; làm song song được nếu đủ người.

## Tech Choices (decision log)

- **OTP hashing**: dùng `BCrypt.Net-Next` (đã có trong project, dùng cho password) để hash OTP — không thêm dependency mới (Constitution III). Lưu hash + salt + attemptCount + lockedUntil trên `OtpRecord`.
- **Rate-limit OTP**: counter per invite trong store hiện có (đơn giản, đủ); cân nhắc thêm ASP.NET built-in rate limiting middleware cho route `voter-invites/*` nếu rẻ. Không kéo lib ngoài.
- **JWT secret**: fail-fast tại `Program.cs` nếu `JwtSettings:Secret` rỗng/thiếu (rõ ràng, kiểm toán được hơn random per-process — random làm invalid token sau mỗi restart, khó vận hành). Tài liệu hoá trong `appsettings.Development.json.example`.
- **Vote-secret frontend**: ngắn hạn — giữ persistence để không vỡ UX commit→reveal cùng thiết bị, nhưng (a) đổi key lưu trữ gắn `voter`, (b) validate `voter===connected` trước reveal (S5, rẻ, làm trước), (c) cảnh báo UI. Mã hoá bằng passphrase là tùy chọn nếu chi phí UX chấp nhận được — đánh giá trong implement, không bắt buộc trong đợt này. Không đổi sang lib lưu trữ mới.
- **S1 rotate**: xóa file legacy; ghi `docs/audit/REMEDIATION_S1.md` liệt kê key đã lộ + trạng thái (rotated/không-funded). History rewrite tách spec riêng.

## Data Model

- `OtpRecord`: `inviteId`, `otpHash`, `salt`, `expiresAt`, `attemptCount`, `lockedUntil`, `consumed` — thay cho `LastOtpCode` plaintext. Dữ liệu OTP cũ vô hiệu (không migrate ngược).

## API Contracts

Không thêm/đổi shape endpoint. Chỉ thay đổi hành vi:
- `verify-otp`: trả lỗi lockout khi vượt ngưỡng; không bao giờ trả mã.
- `send-otp` / DTO: bỏ field `DevOtpCode` trừ khi `DevelopmentAuthSettings:Enabled`.
(Không sinh file `contracts/` — đây là remediation hành vi, không phải API mới.)

## Migration / Rollout

- Theo thứ tự ưu tiên: US1 (S1) → US3 (S3) → US2 (S2) → US4 (S4/S5). Mỗi story commit + verify riêng.
- Không feature flag; thay đổi bảo mật áp dụng ngay. OTP cũ bị vô hiệu (chấp nhận, người dùng xin OTP mới).
- Sau mỗi story: chạy quality gate tương ứng (build/test/scan).

## Risks

- **R1**: Xóa `src/test/**` làm vỡ import ở page legacy không-routed → mitigation: chỉ xóa file không nằm trên active route; chạy `tsc --noEmit` active path xác nhận xanh; nếu vỡ, exclude trong tsconfig thay vì giữ key.
- **R2**: Vô hiệu OTP cũ gây phiền user đang dở luồng → mitigation: chấp nhận, OTP đời ngắn (15 phút), thông báo xin lại.
- **R3**: JWT fail-fast làm môi trường thiếu cấu hình không chạy → mitigation: ship `appsettings.Development.json.example` + cập nhật runbook (Constitution V).
- **R4**: History vẫn còn key sau khi xóa ở tip → mitigation: tài liệu hoá là compromise + rotate; purge history là spec riêng (đã ghi Out of Scope).

## Quality Gate (Constitution Development Workflow)

- Contracts: `npm run compile` + `npm test` pass (không bị ảnh hưởng nhưng chạy để chắc).
- Backend: `dotnet build ...WebApplication3.sln -c Debug` → 0 error; smoke API OTP không lộ mã, lockout hoạt động.
- Frontend: `npm run typecheck` active path sạch; kiểm thủ công luồng commit→reveal cùng ví OK, khác ví bị chặn.
- Scan: 0 private-key 64-hex, 0 JWT secret literal trong file committed.
