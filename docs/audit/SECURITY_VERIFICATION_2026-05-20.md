# Security Verification — 2026-05-20 (JWT / Auth / "mọi thứ")

Kiểm chứng độc lập theo yêu cầu (sau Đợt 10–12). Phương pháp: đọc code `file:line`
+ grep source tracked + **test live** backend đang chạy (`localhost:5293`, container
`holihu-backend` healthy). Branch `012-legal-light-retheme`.

## Kết luận: KHÔNG có Critical mở. JWT/auth đúng & an toàn.

### JWT (S3) — RESOLVED ✅
- `Program.cs:47-55`: `configuredJwtSecret = Configuration["JwtSettings:Secret"]`; **throw** nếu rỗng/`<32` ký tự — **không fallback hardcode** (chuỗi `holihu-local-dev-jwt-secret` không còn trong source).
- `JwtService`: HMAC-SHA256, expiry từ `AccessTokenExpirationMinutes` (15′), refresh token 256-bit RNG.
- `Program.cs:150-160`: `ValidateIssuer/Audience/Lifetime/IssuerSigningKey = true`, `ClockSkew = TimeSpan.Zero`.
- `appsettings.json:22` `"Secret":""` (không commit secret); connstring = `<da_xoa>`.
- **Test live**: `POST /api/tai-khoan/refresh-token` không cookie → **401** "Không tìm thấy Refresh Token."

### Refresh token / storage — SECURE ✅
- `TaiKhoanController.TaoCookieRefreshToken`: `HttpOnly=true`, `Secure=Request.IsHttps`, `SameSite=None(HTTPS)/Lax(HTTP)`, `Expires` set.
- Access token: **chỉ memory (redux)**, không localStorage; FE interceptor refresh có cờ `isRefreshing` chống refresh đồng thời.
- **Test live**: login sai → **401** `{"success":false,"message":"Tên đăng nhập hoặc mật khẩu không đúng."}` (generic — không user-enumeration), **không Set-Cookie**, không 500, không lộ token.

### OTP (S2/S6) — RESOLVED ✅
- `ElectionV1RosterService`: `LastOtpCode = BCrypt.HashPassword(otp)` (hash, không plaintext); `BCrypt.Verify` so khớp; dev-echo chỉ khi `DevelopmentAuthSettings:Enabled`; lockout 5 lần → 15′; `Program.cs` rate-limit policy `voter-invites` 20 req/phút áp lên 5 endpoint OTP/bind.

### S1 / secrets — RESOLVED ✅
- `git ls-files` (loại test/docs/example): **0 private-key/secret hardcode**. 3 chuỗi 64-hex còn lại đã phân loại benign: `BundlerService.cs:1144` Keccak typehash EIP-4337; `ElectionV1ReadService.cs:16` ZeroBytes32; `simple-flow-election.sample.json` candidateId (hash công khai).
- `frontend/src/test`: file chứa key đã xoá (chỉ còn `components/`), 0 key.

### S4/S5 vote-secret — RESOLVED ✅
- AES-GCM, khoá dẫn xuất chữ ký ví; `loadStoredVoteEnvelope`/`handleRevealVote` kiểm `voter===connected` trước decrypt/reveal. Byte-identical HEAD (verify Đợt 10 + lại 2026-05-20).

### S8/S10 — RESOLVED ✅ (DOMPurify sanitize; CORS từ config, mặc định localhost, AllowCredentials + origin cụ thể — `:3000` OK, `:5000` chặn ⇒ "Network Error" trước đó CHÍNH LÀ CORS hoạt động đúng).

## Hành động đã làm
- Sửa `CLAUDE.md` mục "Cảnh báo bảo mật" — trước ghi sai "S1–S5 Chưa vá" (gây hiểu lầm toàn team/agent; vi phạm Principle V tài liệu-đúng). Nay phản ánh đúng: S1–S13 RESOLVED + bằng chứng.

## Còn lại (Low/Accepted — không blocker)
S14 timestamp skew (testnet, accepted) · S18 warning/RNG obsolete (Low) · S19 Node 25 vs LTS 20/22 (pin toolchain) · S20 runbook lệch path/version. Production: bật reCAPTCHA + JWT secret từ secret store. Lưu ý vận hành: login endpoint chưa có `[EnableRateLimiting]` riêng (reCAPTCHA che) — cân nhắc thêm trước mainnet.
