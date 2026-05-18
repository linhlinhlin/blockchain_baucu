# ElectionV1 QR/OTP Flow Runbook

## Muc tieu

Flow nay dung cho truong hop danh sach cu tri dong, can xac thuc email va bind vi truoc khi deploy on-chain:

1. Admin tao `roster draft` tu danh sach cu tri. Day la ban nhap xac thuc, chua phai ballot on-chain.
2. He thong tao `QR chung` theo roster draft va van giu invite token rieng cho tung cu tri o backend.
3. Cu tri quet QR chung, nhap email trong roster, nhan OTP, xac thuc email.
4. Cu tri dang nhap app, bind MetaMask.
5. Admin chi deploy `ElectionV1` khi roster da co du cac vi hop le.

Neu admin chon che do `Nhap vi truc tiep`, khong can QR/OTP trong man tao phien. Ballot duoc deploy tu danh sach vi da nhap, va QR onboarding chi nen xuat hien o che do `Roster QR / OTP` sau khi tao roster draft.

## Route chinh

- Tao ballot: `/app/tao-phien-bau-cu`
- QR scan: `/app/quet-ma-qr`
- Verify QR chung: `/verify-voter?groupKey=...`
- Verify invite rieng du phong: `/verify-voter?token=...`
- Ballot list: `/app/user-elections`
- Smart contract console: `/app/quan-ly-smart-contract`

## API chinh

- `POST /api/election-v1/roster-drafts`
- `GET /api/election-v1/roster-drafts/{groupKey}`
- `POST /api/election-v1/roster-drafts/{groupKey}/deploy`
- `GET /api/election-v1/voter-invites/groups/{groupKey}`
- `POST /api/election-v1/voter-invites/groups/{groupKey}/send-otp`
- `GET /api/election-v1/voter-invites/resolve?token=...`
- `POST /api/election-v1/voter-invites/{token}/send-otp`
- `POST /api/election-v1/voter-invites/{token}/verify-otp`
- `POST /api/election-v1/voter-invites/{token}/prepare-wallet-bind`
- `POST /api/election-v1/voter-invites/{token}/bind-wallet`

## Cach test nhanh

1. Dang nhap app bang tai khoan thuong.
2. Vao `/app/tao-phien-bau-cu`.
3. Chon `Roster QR / OTP`.
4. Nhap roster theo tung dong:

```text
Nguyen Van A,a@example.com,SV001
Tran Thi B,b@example.com,SV002
```

5. Tao draft.
6. Gui QR/link cho cu tri.
7. Cu tri mo `/verify-voter?groupKey=...`, nhap email roster, gui OTP, nhap OTP.
8. Cu tri dang nhap app, bind MetaMask Sepolia.
9. Admin quay lai draft va bam `Deploy`.
10. He thong tao 1 `ballot group` va N child `ElectionV1`.

## Quy tac nghiep vu

- Chi moi cu tri da `OTP verified` va `wallet bound` moi duoc dua vao Merkle root.
- Mot vi khong duoc bind cho hai cu tri trong cung ballot.
- Sau khi deploy, roster draft bi khoa, khong bind them vi.
- Moi chuc vu la mot child election rieng, nhung nguoi dung thao tac trong mot ballot group.

## Trang thai mong doi

- Draft moi tao: `status = draft`
- Sau OTP: `otpVerifiedCount` tang
- Sau bind vi: `walletBoundCount` tang
- Sau deploy: `status = deployed`, co `deployment.created[]`
