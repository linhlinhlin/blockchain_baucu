# REMEDIATION Đợt 2 — High S6,S7,S8,S9,S10,S13

- **Spec**: `.specify/specs/002-security-remediation-high/`
- **Branch**: `002-security-remediation-high` (stack trên 001)
- **Ngày**: 2026-05-18

## S6 — Endpoint OTP/bind chưa rate-limit → ĐÃ XỬ LÝ

`Program.cs` + `ElectionV1Controller.cs`: `AddRateLimiter` (built-in .NET 9), policy `voter-invites` (fixed window 20 req/phút theo IP, 429 khi vượt); `app.UseRateLimiter()` sau `UseRouting`; `[EnableRateLimiting("voter-invites")]` trên 5 action `voter-invites/*` (send-otp ×2, verify-otp, prepare-wallet-bind, bind-wallet). Bổ trợ lockout per-invite của S2.

## S7 — StudentCodeMatches coi blank là khớp → ĐÃ XỬ LÝ

`ElectionV1RosterService.StudentCodeMatches`: roster CÓ mã SV ⇒ request thiếu mã → **false** (bắt buộc khớp chính xác); roster không mã ⇒ định danh email (không nới thêm). Bỏ nhánh "request blank ⇒ true".

## S8 — Stored XSS qua dangerouslySetInnerHTML → ĐÃ XỬ LÝ

Thêm dependency `dompurify`; util `frontend/src/utils/sanitizeHtml.ts`; bọc `DOMPurify.sanitize` cho 2 renderer user-content `dieuLeCuocBauCu.noiDung` (`XemChiTietCuocBauCuPage.tsx`, `ThamGiaBauCuPage.tsx`). 2 chỗ `<style>` (Chart.tsx, TaoTaiKhoanForm.tsx) là CSS tĩnh, **không phải user content** → giữ nguyên (sanitize sẽ phá CSS, không phải lỗ hổng).

## S9 — finalize không kiểm turnout → ĐÃ XỬ LÝ (tham số hoá, team chốt)

`ElectionV1.sol`: thêm immutable `minReveals` + `enforceQuorum`, biến `lowTurnout`, error `QuorumNotReached`, event `LowTurnout`. `finalizeElection`: nếu `totalReveals < minReveals` → `enforceQuorum` ? revert : set `lowTurnout`+emit. Default `minReveals=0` ⇒ **tương thích ngược** (7 test cũ vẫn pass). `ElectionFactoryV1.sol` struct + create truyền 2 tham số. `scripts/lib/electionPackage.js` source từ input (default 0/false). Foundry test struct cập nhật.
- Test: thêm 2 ca (enforceQuorum true→revert, false→lowTurnout). **9/9 pass**.
- Follow-up (không bắt buộc đợt này): surface `lowTurnout` lên ABI backend/FE để hiển thị UI — enhancement, ghi nhận.

## S13 — Bind wallet authz gap → ĐÃ XỬ LÝ

`ElectionV1RosterService`: `PrepareWalletBinding` gán `ClaimedByUserId` cho account đầu tiên (persist) và từ chối account khác; `BindWallet` thêm guard từ chối nếu `ClaimedByUserId` khác caller. ⇒ chỉ account đã claim invite mới bind được, người đăng nhập khác có token không chiếm được slot.

## Trạng thái verify

| Issue | Verify |
|---|---|
| S6 | dotnet build 0 error; policy gắn 5 action voter-invites |
| S7 | dotnet build 0 error; logic đảo đúng |
| S8 | scoped tsc: 0 lỗi do thay đổi (util+import+line 995); dompurify trong lockfile |
| S9 | `npm run compile` OK; `npm test` **9/9 pass** (7 cũ + 2 mới) |
| S10 | dotnet build 0 error; 0 origin azurewebsites hardcode trong source |
| S13 | dotnet build 0 error; guard 2 nơi |

Giới hạn: full `tsc` vẫn bất khả thi dưới Node 25 (S19/Đợt 4) — FE verify bằng scoped typecheck file đụng. Nợ type legacy có sẵn (apiClient `import.meta.env`, store slices, XemChiTiet 510/676/686) ngoài scope, thuộc Đợt 3.
