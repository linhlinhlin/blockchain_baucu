# Docker Active Stack

## Muc tieu

Stack nay chi nham vao active path moi:

- Frontend hien tai
- WebApplication3 backend hien tai
- PostgreSQL cho active store `ElectionV1`
- `blockchain_sm` duoc copy vao backend container de doc deployments va goi helper deploy

Legacy SQL Server / Azure / Geth khong phai la dependency bat buoc cua stack nay.

## Chay stack

```powershell
cd E:\Sach\Sua\blockchain_baucu
docker compose -f .\docker-compose.active.yml up --build
```

Neu may dung CLI cu:

```powershell
docker-compose -f .\docker-compose.active.yml up --build
```

## Dia chi

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5293`
- PostgreSQL: `localhost:5432`

## Tai khoan dev

- `devadmin / Admin@123`
- `devuser / User@123`

## Cau hinh chinh

- `ConnectionStrings__DefaultConnection=` de trong:
  backend legacy fallback sang in-memory DB.
- `ConnectionStrings__ElectionV1StoreConnection`:
  dung PostgreSQL cho `roster draft / invite / OTP / wallet bind / development auth / refresh sessions`.
- `ElectionV1Settings__ContractsRootPath=/workspace/blockchain_sm`:
  backend container doc duoc `deployments` va helper scripts.
- SMTP OTP:
  them cac bien `Smtp__Host`, `Smtp__Port`, `Smtp__Username`, `Smtp__Password`,
  `Smtp__FromEmail`, `Smtp__FromName` vao `blockchain_sm/.env` neu muon gui email that.
  Gmail can app password, khong dung mat khau dang nhap thong thuong.

## Cac luong can test

1. Dang nhap tai khoan thuong.
2. Tao ballot tu `/app/tao-phien-bau-cu`.
3. Chon `Roster QR / OTP`.
4. Tao draft.
5. Cu tri mo QR chung `/verify-voter?groupKey=...`.
6. Cu tri nhap email trong roster, gui OTP, nhap OTP, bind MetaMask.
7. Admin deploy ballot.
8. Vao `/app/user-elections` va `/app/quan-ly-smart-contract`.

## Ghi chu

- Email OTP se fallback sang `development-preview` neu SMTP chua cau hinh hoac xac thuc SMTP that bai.
- QR chung chi cong khai `groupKey`; invite token rieng chi duoc lay sau buoc dinh danh email roster.
- `devadmin / devuser` duoc seed vao PostgreSQL store ngay luc startup.
- Giao dich on-chain van can Sepolia ETH.
- Frontend container dang chay bang `vite dev server` de de debug. Neu can, co the doi sang build + preview sau khi active path on dinh hon.
