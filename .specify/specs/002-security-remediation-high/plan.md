# Plan: Đợt 2 — Remediation Bảo Mật Cao

**Spec**: `./spec.md` · **Constitution**: I, II, IV · Branch: `002-security-remediation-high` (stack trên 001)

## Quyết định nghiệp vụ đã chốt (S9)

Team chốt: **tham số hoá**. `ElectionV1` constructor thêm `uint256 minReveals` + `bool enforceQuorum`.
- `enforceQuorum=true` ⇒ `finalizeElection` revert nếu `totalRevealed < minReveals`.
- `enforceQuorum=false` ⇒ vẫn finalize, set `bool public lowTurnout` + emit `LowTurnout` event.
- Default `minReveals=0` ⇒ hành vi cũ, tương thích ngược.

## Vùng tác động & tech choices

| Issue | Tệp | Cách làm |
|---|---|---|
| S6 | `Program.cs` | Built-in `AddRateLimiter` (.NET 9), policy cho `voter-invites/*` (fixed window theo IP), 429. Không lib ngoài. |
| S7 | `ElectionV1RosterService.cs` (`StudentCodeMatches`) | Bỏ coi blank là khớp: roster có mã ⇒ request phải có & khớp; roster không mã ⇒ không nới thêm. |
| S8 | `frontend` | Thêm `dompurify`; bọc `dangerouslySetInnerHTML` ở **trang active** bằng `DOMPurify.sanitize`. Usage ở page legacy để Đợt 3 xoá. |
| S9 | `blockchain_sm/contracts/ElectionV1.sol`, `ElectionFactoryV1.sol`, scripts, ABI backend (`ElectionV1ReadService`) + FE inline | Thêm 2 tham số immutable; cập nhật factory create + script build/deploy + ABI 2 nơi; test mới. |
| S10 | `Program.cs` | `Cors:AllowedOrigins` từ config/env (array); bỏ origin azurewebsites hardcode; giữ AllowCredentials với danh sách cấu hình. |
| S13 | `ElectionV1RosterService.cs` | Gắn `ClaimedByUserId` ở bước OTP-verify (account xác thực); `bind-wallet` từ chối nếu caller khác account đã verify. |

## Migration / rollout

- Thứ tự: S10→S6 (Program.cs cùng vùng) → S7,S13 (RosterService) → S8 (FE) → S9 (contract ripple, lớn nhất, làm cuối + test kỹ).
- S9: election đã deploy không đổi (immutable on-chain); chỉ deploy mới nhận tham số. Backend create script truyền `minReveals=0,enforceQuorum=false` mặc định để không đổi hành vi hiện tại trừ khi cấu hình.
- Mỗi nhóm: build/test verify trước khi sang nhóm sau.

## Risks

- **R1 S9 ripple**: ABI lệch giữa contract/backend/FE ⇒ test deploy + đối chiếu ABI 3 nơi. Mitigation: thêm test Hardhat cho cả 2 nhánh enforceQuorum.
- **R2 rate-limit chặn nhầm**: đặt ngưỡng đủ rộng cho luồng hợp lệ (vd 10 req/phút/IP cho send-otp, 20 cho verify).
- **R3 dompurify** thêm dependency: chỉ thêm 1 lib chuẩn, không kéo theo nặng.
- **R4 full tsc** vẫn bất khả thi (Node 25) ⇒ verify FE bằng scoped typecheck file đụng (như Đợt 1), pin Node là Đợt 4.

## Quality gate

- Contracts: `npm run compile` + `npm test` + test mới minReveals/enforceQuorum pass.
- Backend: `dotnet build` 0 error; thử rate-limit (429) + authz bind thủ công.
- FE: scoped `tsc` file đụng → 0 lỗi do thay đổi.
- Scan: không secret mới.
