# REMEDIATION Đợt 1 — Critical S1–S5

- **Spec**: `.specify/specs/001-security-remediation-critical/`
- **Branch**: `001-security-remediation-critical`
- **Ngày**: 2026-05-18
- **Constitution**: Principle I (Security & Integrity First — blocker)

Tổng hợp thay đổi 5 lỗ hổng Critical. Chi tiết S1 (key) xem [REMEDIATION_S1.md](./REMEDIATION_S1.md).

## S1 — Private key bị commit → ĐÃ XỬ LÝ

- Xóa 4 file legacy chứa session/private key; `tsconfig.json` exclude `src/test`,`src/testWeb3` (interim, Đợt 3 xóa hết legacy tree).
- Toàn bộ 8 key coi như compromised; 7/8 chưa dùng & 0 ETH, 1 key đã dùng (dust 0.000008 ETH) — không tái sử dụng.
- Verify: scan `privateKey/sessionKey = 64-hex` → **0 match thật** (chỉ còn keccak/zero/placeholder, đã ghi nhận).

## S2 — OTP plaintext / echo / brute-force → ĐÃ XỬ LÝ

`Services/ElectionV1RosterService.cs` + `Models/ElectionV1StoreModels.cs`:
- **Hash**: `LastOtpCode` nay lưu `BCrypt.HashPassword(otp)` (dùng `BCrypt.Net-Next` sẵn có), verify bằng `BCrypt.Verify` (bắt `SaltParseException` → coi OTP cũ plaintext là sai).
- **Không echo**: `DevOtpCode` chỉ set khi `DevelopmentAuthSettings:Enabled` tường minh (thêm `_developmentAuthEnabled`), không còn dựa `IsDevelopment` đơn thuần.
- **Rate-limit**: thêm `OtpAttemptCount` + `OtpLockedUntil`; sai ≥ `MaxOtpAttempts=5` → khoá `OtpLockoutWindow=15` phút; verify chặn khi đang khoá; thành công/gửi lại reset counter.
- Old OTP data tự vô hiệu (hash mới khác plaintext cũ). Lưu ý: cột mới chỉ tạo bởi `EnsureCreated` trên DB fresh — DB cũ cần migration (S12/Đợt 5, đã biết).
- Verify: `dotnet build` 0 error.

## S3 — JWT secret hardcode → ĐÃ XỬ LÝ

- `Program.cs`: bỏ hằng số `holihu-local-dev-jwt-secret-…`; **fail-fast** nếu `JwtSettings:Secret` rỗng hoặc < 32 ký tự, message hướng dẫn rõ.
- `docker-compose.active.yml`: `JwtSettings__Secret` → `${JWT_SECRET:?…}` (fail-fast cấp compose). Thêm `/.env` vào `.gitignore`, tạo `.env.example` (root) + `appsettings.Development.json.example`.
- Verify: build 0 error; `docker compose config` hợp lệ khi có `JWT_SECRET`, báo lỗi rõ khi thiếu. Literal cũ chỉ còn trong docs/spec/audit (mô tả finding, không phải secret sống).

## S4 / S5 — Vote-secret localStorage / reveal không owner-check → ĐÃ XỬ LÝ

`frontend/src/pages/QuanLySmartContractPage.tsx`:
- **S4**: localStorage chỉ lưu **envelope đã mã hoá** (AES-GCM). Khoá AES dẫn xuất từ **chữ ký ví** (`signMessage` thông điệp cố định theo election+voter) → SHA-256 → AES-GCM key. Salt/candidateId/commitment không còn plaintext. Thêm cảnh báo UI: reveal cần đúng ví + đúng trình duyệt.
- **S5**: `loadStoredVoteEnvelope` loại envelope sai `electionAddress`/`voter`; `handleRevealVote` kiểm `envelope.voter === ví đang kết nối` trước khi reveal; giải mã thất bại → báo lỗi rõ, không gọi `revealVote`.
- Bản chất khoá gắn chữ ký ví ⇒ XSS/máy chung không giải mã được nếu không có ví.
- Verify: typecheck phạm vi hẹp (chỉ `QuanLySmartContractPage.tsx` + import của nó) → **0 lỗi do code S4/S5** (helpers/handlers/cảnh báo). Lỗi duy nhất trong file là `:849 {currentPositionTitle}` — code render cũ, có sẵn trước Đợt 1, không phải S4/S5.

## Trạng thái verify

| Issue | Build/Scan | Ghi chú |
|---|---|---|
| S1 | ✅ scan 0 key thật | REMEDIATION_S1.md |
| S2 | ✅ dotnet build 0 error | hash+lockout+gate |
| S3 | ✅ build 0 error · compose valid + fail-fast | |
| S4/S5 | ✅ scoped typecheck 0 lỗi do thay đổi | full `tsc` bất khả thi dưới Node 25 (S19) — đã verify hẹp |

## Giới hạn môi trường (ghi nhận)

Full `tsc --noEmit` trên toàn `src/` **không hoàn tất** dưới Node v25.9 (2 lần chạy >20 phút, ~1GB RAM, CPU 1600s+, phải kill) — đúng cảnh báo **S19** (Node 25 quá mới). Verify Đợt 1 dùng typecheck phạm vi hẹp đúng file đã sửa. Pin Node 20/22 LTS để chạy full gate là việc của **Đợt 4** (S19). Codebase còn nợ type legacy có sẵn (vd `import.meta.env` thiếu `vite/client`, `WritableDraft` ở store slices, `:849` manifest) — ngoài scope Đợt 1, thuộc **Đợt 3**.

> S1–S5 = Resolved. Đã cập nhật `AUDIT_2026-05-18.md` §2.
